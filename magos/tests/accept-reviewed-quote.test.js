'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {acceptReviewedQuote}=require('../processor/accept-reviewed-quote');
const {createRuntimeApp}=require('../runtime/app');

const quote={
 quote_id:'Q-ACCEPT-1',opportunity_id:'OPP-ACCEPT-1',
 'Quote Status':'ACTIVE','Workflow Stage':'SENT',
 'Line Control State':'LINE_CONTROL_OK',
 'Drive Link':'https://drive.google.com/file/d/issued-v3/view'
};
const trusted=async({quote_id,opportunity_id})=>({
 verified:true,quote_id,opportunity_id,
 quote_version:'V3',receipt_id:'WPSIG-55',
 evidence_ref:'https://drive.google.com/file/d/signed-receipt/view',
 source_event_id:'WP-FLUENT-12-55',signed_at:'2026-11-21T11:00:00Z',
 signer_identity:'Client One',
 authority:'WP_VERIFIED_SIGNED_RECEIPT_AND_CANONICAL_COMMERCIAL_MATCH'
});
function fixture(){
 let state={...quote},calls=0,lastPlan;
 const commercial={findByKey:async(sheet,key,id)=>sheet==='Quotes'&&id===state.quote_id?
   {object:{...state}}:null};
 const writer={stores:{commercial},execute:async plan=>{
  calls++;lastPlan=plan;
  if(plan.writes[0].expect['Quote Status']!==state['Quote Status'])
   return {state:'RETRY_REQUIRED'};
  state={...state,...plan.writes[0].changes};
  return {state:'COMMITTED'};
 }};
 return {writer,calls:()=>calls,plan:()=>lastPlan,state:()=>state};
}
test('independently reviewed signature changes only the canonical quote status',async()=>{
 const f=fixture();
 const result=await acceptReviewedQuote({writer:f.writer,quoteId:quote.quote_id,authorityVerifier:trusted});
 assert.equal(result.state,'COMMITTED');
 assert.equal(result.readback_verified,true);
 assert.equal(f.calls(),1);
 assert.equal(f.state()['Quote Status'],'ACCEPTED');
 const p=f.plan();
 assert.equal(p.writes.length,1);
 assert.equal(p.writes[0].operation,'PATCH_IF_MATCH');
 assert.equal(p.writes[0].entity_type,'Quote');
 assert.equal(p.writes[0].sheet,'Quotes');
 assert.deepEqual(p.writes[0].changes,{'Quote Status':'ACCEPTED'});
 assert.equal(result.payment_cleared,false);
 assert.equal(result.job_created,false);
});
test('dry-run prepares a CAS plan without any write',async()=>{
 const f=fixture();
 const r=await acceptReviewedQuote({writer:f.writer,quoteId:quote.quote_id,authorityVerifier:trusted,dryRun:true});
 assert.equal(r.state,'DRY_RUN');
 assert.equal(r.plan.event_type,'REVIEWED_QUOTE_ACCEPTANCE_CONFIRMED');
 assert.equal(f.calls(),0);
});
test('missing, forged or untrusted signed evidence never mutates the quote',async()=>{
 const variations=[
  {verified:false,reason_code:'WP_NOT_VERIFIED'},
  {...await trusted({quote_id:quote.quote_id,opportunity_id:quote.opportunity_id}),quote_id:'WRONG'},
  {...await trusted({quote_id:quote.quote_id,opportunity_id:quote.opportunity_id}),authority:'CALLER_ASSERTION'},
  {...await trusted({quote_id:quote.quote_id,opportunity_id:quote.opportunity_id}),evidence_ref:'https://evil.test/fake'}
 ];
 for(const att of variations){
  const f=fixture();
  const result=await acceptReviewedQuote({writer:f.writer,quoteId:quote.quote_id,authorityVerifier:async()=>att});
  assert.equal(result.state,'REVIEW_REQUIRED');
  assert.equal(f.calls(),0);
 }
});
test('accepted or unsent quote cannot be accepted a second time',async()=>{
 for(const [status,stage] of [['ACCEPTED','SENT'],['ACTIVE','DRAFT'],['SUPERSEDED','SENT']]){
  const f=fixture();
  f.writer.stores.commercial.findByKey=async()=>({object:{...quote,'Quote Status':status,'Workflow Stage':stage}});
  const result=await acceptReviewedQuote({writer:f.writer,quoteId:quote.quote_id,authorityVerifier:trusted});
  assert.equal(result.state,'REVIEW_REQUIRED');
  assert.equal(f.calls(),0);
 }
});
test('accepted quote endpoint has a distinct credential and requires server-side verification',async()=>{
 const f=fixture();
 const app=createRuntimeApp({
  token:'runtime-token',quoteSigningToken:'link-token',
  quoteAcceptanceToken:'accept-token',signedAcceptanceVerifier:trusted,
  writerFactory:()=>f.writer
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(key,dryRun=false)=>fetch(base+'/v1/governance/accept-reviewed-quote',{
   method:'POST',headers:{'content-type':'application/json',
    ...(key?{'x-magos-acceptance-token':key}:{})},
   body:JSON.stringify({quoteId:quote.quote_id,dryRun})
  });
  assert.equal((await post()).status,401);
  assert.equal((await post('runtime-token')).status,401);
  assert.equal((await post('accept-token',true)).status,200);
  assert.equal(f.calls(),0);
  const accepted=await post('accept-token');
  assert.equal(accepted.status,200);
  assert.equal((await accepted.json()).state,'COMMITTED');
  assert.equal(f.calls(),1);
 }finally{await new Promise(done=>server.close(done));}
});
test('generic transaction API cannot bypass quote acceptance',async()=>{
 const f=fixture();
 const app=createRuntimeApp({token:'runtime-token',writerFactory:()=>f.writer});
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/v1/transactions',{
   method:'POST',headers:{authorization:'Bearer runtime-token','content-type':'application/json'},
   body:JSON.stringify({
     idempotency_key:'fake',event_type:'MANUAL_STATUS',source_event_id:'fake',
     preconditions:[],writes:[{store:'commercial',sheet:'Quotes',
      key:{header:'quote_id',value:quote.quote_id},
      operation:'UPDATE_BY_KEY',changes:{'Quote Status':'ACCEPTED'}}]
   })
  });
  assert.equal(response.status,403);
  assert.equal(f.calls(),0);
 }finally{await new Promise(done=>server.close(done));}
});
