'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSigningProviderVerifier}=require('../adapters/signing-provider-verifier');
const input={quote_id:'Q-123',opportunity_id:'OP-456'};
const signed={verified:true,quote_id:'Q-123',opportunity_id:'OP-456',status:'COMPLETED',evidence_ref:'provider:evidence/1',source_event_id:'SIGN-789',signer_identity:'Client signer',signed_at:'2026-10-11T17:00:00Z'};
test('provider disabled without exact HTTPS origin and secret',async()=>{
 const fn=createSigningProviderVerifier({endpoint:'',token:''});
 assert.equal((await fn(input)).reason_code,'SIGNING_PROVIDER_NOT_CONFIGURED');
});
test('configured provider verifies matching completed signed evidence from authenticated HTTPS only',async()=>{
 let called=0;
 const fn=createSigningProviderVerifier({endpoint:'https://signing.example.test/api/verify',token:'secret-key',fetchImpl:async(url,options)=>{
  called++;const u=new URL(url);
  assert.equal(u.protocol,'https:');assert.equal(u.searchParams.get('quote_id'),'Q-123');
  assert.equal(u.searchParams.get('opportunity_id'),'OP-456');
  assert.equal(options.headers.authorization,'Bearer secret-key');
  assert.equal(options.redirect,'error');
  return {ok:true,json:async()=>signed};
 }});
 assert.equal((await fn(input)).verified,true);assert.equal(called,1);
});
test('rejected redirects and untrusted HTTP origins fail closed before requesting',async()=>{
 let called=0;const fn=createSigningProviderVerifier({endpoint:'http://signing.example.test/verify',token:'secret',fetchImpl:async()=>{called++;return {ok:true}}});
 assert.equal((await fn(input)).reason_code,'SIGNING_PROVIDER_URL_INVALID');assert.equal(called,0);
});
test('wrong quote, unsigned state and invalid signed dates all refuse acceptance',async()=>{
 for(const att of [{...signed,quote_id:'OTHER'}, {...signed,status:'PENDING'}, {...signed,signed_at:'sometime'}]){
  const fn=createSigningProviderVerifier({endpoint:'https://signing.example.test/verify',token:'secret',fetchImpl:async()=>({ok:true,json:async()=>att})});
  assert.equal((await fn(input)).verified,false);
 }
});
test('provider errors and missing evidence do not authorize P3',async()=>{
 const fn=createSigningProviderVerifier({endpoint:'https://signing.example.test/verify',token:'secret',fetchImpl:async()=>{throw Error('network unavailable')}});
 assert.equal((await fn(input)).reason_code,'SIGNING_PROVIDER_UNAVAILABLE');
});
