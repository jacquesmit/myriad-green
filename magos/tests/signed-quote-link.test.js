'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),http=require('node:http');
const {issueSignedQuoteLink,inspectSigningPage}=require('../processor/signed-quote-link');
const {createRuntimeApp}=require('../runtime/app');
const quote={quote_id:'Q-TEST',opportunity_id:'OPP-TEST',
 'Quote Status':'ACTIVE','Workflow Stage':'SENT','Line Control State':'LINE_CONTROL_OK',
 'Drive Link':'https://drive.google.com/file/d/issued-quote-test/view',
 'Valid Until':'2026-12-15'};
const lines=[{quote_id:'Q-TEST',quote_version:'V3',line_status:'CURRENT'}];
const secret='a-very-long-test-only-WordPress-link-hmac-secret';
const stores=(q=quote,l=lines)=>({commercial:{
 findByKey:async()=>q?{object:q}:null,
 readObjects:async()=>l
}});
const params={stores:stores(),quoteId:'Q-TEST',secret,now:()=>new Date('2026-11-21T12:00:00Z'),
 random:()=> 'a'.repeat(32),readiness:async()=>true};
test('links are canonical signed tokens matching legacy WordPress HMAC structure',async()=>{
 const result=await issueSignedQuoteLink(params);
 assert.equal(result.state,'READY_TO_SEND');
 assert.equal(result.customer_message_sent,false);
 assert.equal(result.job_created,false);
 assert.deepEqual(result.writes,[]);
 const u=new URL(result.url);
 assert.equal(u.origin,'https://myriadgreen.co.za');
 const [encoded,signature]=u.searchParams.get('accept_token').split('.');
 assert.equal(crypto.createHmac('sha256',secret).update(encoded).digest('hex'),signature);
 const p=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
 assert.equal(p.quote_id,'Q-TEST');
 assert.equal(p.quote_version,undefined);
 assert.equal(p.version,'V3');
 assert.equal(p.purpose,'CLIENT_ACCEPTANCE');
 assert.equal(p.issued_pdf_ref,quote['Drive Link']);
});
test('live WP companion and published client page must both be confirmed',async()=>{
 const no=await issueSignedQuoteLink({...params,readiness:async()=>false});
 assert.equal(no.state,'BLOCKED');
 assert.equal(no.reason_code,'WORDPRESS_SIGNING_PAGE_OR_BRIDGE_NOT_LIVE');
 assert.equal(no.url,undefined);
});
test('client link is blocked for expired, draft, unsigned and superseded quote',async()=>{
 for(const [change,expected] of [
  [{'Valid Until':'2026-11-20'},'QUOTE_EXPIRED'],
  [{'Quote Status':'ACCEPTED'},'QUOTE_NOT_ACTIVE_AND_ISSUED'],
  [{'Workflow Stage':'PDF_READY'},'QUOTE_NOT_ACTIVE_AND_ISSUED'],
  [{'Line Control State':'BLOCKED_NO_CANONICAL_LINES'},'QUOTE_LINES_NOT_APPROVED'],
  [{'Drive Link':'https://example.test/wrong'},'ISSUED_PDF_NOT_IN_CANONICAL_DRIVE']
 ]) {
  const r=await issueSignedQuoteLink({...params,stores:stores({...quote,...change})});
  assert.equal(r.state,'BLOCKED');
  assert.equal(r.reason_code,expected);
 }
});
test('mismatched line versions, missing secret and invalid nonce fail closed',async()=>{
 const mismatch=await issueSignedQuoteLink({...params,stores:stores(quote,[...lines,{...lines[0],quote_version:'V4'}])});
 assert.equal(mismatch.reason_code,'CURRENT_QUOTE_LINE_VERSION_UNVERIFIED');
 const missing=await issueSignedQuoteLink({...params,secret:''});
 assert.equal(missing.reason_code,'SIGNING_SECRET_NOT_CONFIGURED');
 const nonce=await issueSignedQuoteLink({...params,random:()=> 'bad'});
 assert.equal(nonce.reason_code,'NONCE_GENERATION_FAILED');
});
test('WordPress readiness fails when signing page is still draft or verify-v2 not installed',async()=>{
 const p=async url=>({status:200,json:async()=>url.includes('/pages?')?[{id:9481,status:'draft'}]:{
  routes:{'/mgos/v1/quote-acceptance/verify-v2':{}}
 }});
 assert.equal(await inspectSigningPage({request:p}),false);
 const q=async url=>({status:200,json:async()=>url.includes('/pages?')?[{id:9481,status:'publish'}]:{
  routes:{'/mgos/v1/quote-acceptance/verify':{}}
 }});
 assert.equal(await inspectSigningPage({request:q}),false);
});
test('signing-link governance endpoint requires its own credential and never writes',async()=>{
 let writes=0;
 const app=createRuntimeApp({
  token:'runtime-token',quoteSigningToken:'separate-signing-token',
  quoteSigningSecret:secret,signingPageReadiness:async()=>true,
  writerFactory:()=>({stores:stores(),execute:async()=>{writes++;}})
 });
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const send=async token=>fetch(origin+'/v1/governance/quote-signing-link',{
   method:'POST',headers:{'content-type':'application/json',
     ...(token?{'x-magos-signing-token':token}:{})},
   body:JSON.stringify({quoteId:'Q-TEST'})});
  assert.equal((await send()).status,401);
  assert.equal((await send('runtime-token')).status,401);
  assert.equal((await send('separate-signing-token')).status,200);
  assert.equal(writes,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
