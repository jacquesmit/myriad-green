'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeWordPressAcceptanceVerifier}=require('../processor/wordpress-acceptance-verifier');
const quote={quote_id:'Q-1',opportunity_id:'OPP-1','Quote Status':'ACCEPTED',
 'Drive Link':'https://drive.google.com/file/d/issued-1/view'};
const lines=[{quote_id:'Q-1',quote_version:'V2',line_status:'CURRENT'}];
const sha='a'.repeat(64);
const signed={
 verified:true,purpose:'CLIENT_ACCEPTANCE',approval_status:'INDEPENDENTLY_APPROVED',
 consent_verified:true,quote_id:'Q-1',opportunity_id:'OPP-1',quote_version:'V2',
 issued_pdf_ref:quote['Drive Link'],evidence_ref:'https://drive.google.com/file/d/signed-1/view',
 signer_identity:'client-signature-1',signed_at:'2026-11-20T13:00:00Z',
 source_event_id:'WP-FLUENT-42',receipt_id:'WP-42',signature_sha256:sha,
 independent_reviewer_id:'finance-manager-1'
};
const stores=(q=quote,l=lines)=>({commercial:{
 findByKey:async()=>q?{object:q}:null,
 readObjects:async()=>l
}});
const date=()=>new Date('2026-11-21T13:00:00Z');
const args={stores:stores(),secret:'super-long-test-secret-that-has-more-than-32-characters',
 now:date};
const verifier=(payload=signed,overrides={})=>makeWordPressAcceptanceVerifier({
 ...args,...overrides,
 request:async url=>({status:200,json:async()=>payload})
});
test('currently deployed WordPress test-only verification can never authorize accepted job',async()=>{
 const r=await verifier({verified:false,status:'PENDING_REVIEW',
  reason_code:'CANONICAL_QUOTE_AND_SIGNATURE_VERIFICATION_NOT_CONNECTED'})({
   quote_id:'Q-1',opportunity_id:'OPP-1'});
 assert.equal(r.verified,false);
 assert.equal(r.reason_code,'CANONICAL_QUOTE_AND_SIGNATURE_VERIFICATION_NOT_CONNECTED');
});
test('independently approved matching receipt passes server-side quote/version checks',async()=>{
 const r=await verifier()({quote_id:'Q-1',opportunity_id:'OPP-1'});
 assert.equal(r.verified,true);
 assert.equal(r.source_event_id,'WP-FLUENT-42');
 assert.equal(r.quote_version,'V2');
});
for(const [label,payload,code] of [
 ['wrong version',{...signed,quote_version:'V1'},'SIGNED_QUOTE_VERSION_OR_DOCUMENT_MISMATCH'],
 ['changed PDF',{...signed,issued_pdf_ref:'https://example.com/other'},'SIGNED_QUOTE_VERSION_OR_DOCUMENT_MISMATCH'],
 ['wrong opportunity',{...signed,opportunity_id:'OPP-OTHER'},'SIGNED_QUOTE_VERSION_OR_DOCUMENT_MISMATCH'],
 ['client without review',{...signed,approval_status:'PENDING_REVIEW'},'INDEPENDENT_CLIENT_APPROVAL_MISSING'],
 ['missing consent',{...signed,consent_verified:false},'INDEPENDENT_CLIENT_APPROVAL_MISSING'],
 ['test purpose',{...signed,purpose:'OWNER_TEST'},'INDEPENDENT_CLIENT_APPROVAL_MISSING'],
 ['bad signature',{...signed,signature_sha256:'bad'},'SIGNATURE_RECEIPT_INCOMPLETE'],
 ['self-approval',{...signed,independent_reviewer_id:'client-signature-1'},'SELF_APPROVAL_NOT_ACCEPTED'],
 ['future signature',{...signed,signed_at:'2027-01-01T00:00:00Z'},'SIGNATURE_TIME_UNVERIFIED']
]) test(label+' fails closed',async()=>{
 const r=await verifier(payload)({quote_id:'Q-1',opportunity_id:'OPP-1'});
 assert.equal(r.verified,false,label);
 assert.equal(r.reason_code,code);
});
test('draft quote and ambiguous current line versions fail before contacting WP',async()=>{
 let calls=0;
 const request=async()=>{calls++;throw Error('network not allowed');};
 const first=makeWordPressAcceptanceVerifier({...args,
  stores:stores({...quote,'Quote Status':'DRAFT'}),request});
 const a=await first({quote_id:'Q-1',opportunity_id:'OPP-1'});
 assert.equal(a.reason_code,'CURRENT_CANONICAL_QUOTE_NOT_ACCEPTED');
 const second=makeWordPressAcceptanceVerifier({...args,
  stores:stores(quote,[...lines,{...lines[0],quote_version:'V3'}]),request});
 const b=await second({quote_id:'Q-1',opportunity_id:'OPP-1'});
 assert.equal(b.reason_code,'CURRENT_QUOTE_VERSION_AMBIGUOUS');
 assert.equal(calls,0);
});
test('redirected WP endpoint, missing secret and arbitrary site origin rejected',async()=>{
 const argsCall={quote_id:'Q-1',opportunity_id:'OPP-1'};
 assert.equal((await makeWordPressAcceptanceVerifier({...args,secret:''})(argsCall)).verified,false);
 assert.equal((await makeWordPressAcceptanceVerifier({...args,siteUrl:'https://evil.example.test'})(argsCall)).reason_code,'WP_VERIFY_ORIGIN_NOT_APPROVED');
 const v=makeWordPressAcceptanceVerifier({...args,request:async()=>{throw Error('redirect rejected')}});
 assert.equal((await v(argsCall)).reason_code,'WORDPRESS_VERIFY_UNAVAILABLE');
});
test('WordPress GET request pins origin, uses bearer secret and carries only immutable record IDs',async()=>{
 let captured;
 const v=makeWordPressAcceptanceVerifier({...args,request:async(url,options)=>{
  captured={url,options};return {status:200,json:async()=>signed};
 }});
 await v({quote_id:'Q-1',opportunity_id:'OPP-1'});
 const u=new URL(captured.url);
 assert.equal(u.origin,'https://myriadgreen.co.za');
 assert.equal(u.searchParams.get('quote_id'),'Q-1');
 assert.equal(captured.options.redirect,'error');
 assert.ok(captured.options.headers.Authorization.startsWith('Bearer '));
});
