'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {recordVerifiedDirectCost,deterministicCostId}=require('../processor/record-direct-job-cost');
const {createRuntimeApp}=require('../runtime/app');
const jobId='JOB-TEST-1',eventId='INVOICE-TEST-001';
const job={job_id:jobId,opportunity_id:'OPP-TEST-1',client_name:'Example Customer'};
const execution={'Job ID':jobId,opportunity_id:'OPP-TEST-1',Client:'Example Customer'};
const att={verified:true,job_id:jobId,opportunity_id:'OPP-TEST-1',
 source_event_id:eventId,cost_category:'MATERIALS',description:'Verified fittings',
 amount_cents:25999,evidence_link:'https://drive.google.com/file/d/receipt-1/view',
 source_authority:'INDEPENDENT_SUPPLIER_INVOICE',
 independent_reviewer_id:'OWNER-VERIFIED-01',
 evidence_status:'SUPPLIER_INVOICE_EVIDENCED',
 allocation_status:'ALLOCATED_TO_JOB',stock_split_verified:true};
function fixture(){
 let calls=0,lastPlan,receipt;
 const commercial={findByKey:async(s,k,id)=>{
  if(s==='Job Execution'&&id===jobId)return {object:execution};
  if(s==='Project Direct Costs'&&receipt&&id===receipt.direct_cost_id)return {object:{...receipt}};
  return null;
 }};
 const writer={stores:{crm:{findByKey:async()=>({object:job})},commercial},
  execute:async plan=>{calls++;lastPlan=plan;receipt=plan.writes[0].values;
   return {state:'COMMITTED'};}};
 return {writer,calls:()=>calls,plan:()=>lastPlan};
}
const verification=async()=>({...att});
test('verified direct cost is appended through canonical P3 plan and independently read back',async()=>{
 const f=fixture();
 const result=await recordVerifiedDirectCost({writer:f.writer,jobId,sourceEventId:eventId,
  evidenceVerifier:verification,now:()=>new Date('2026-11-21T12:00:00Z')});
 assert.equal(result.state,'COMMITTED');
 assert.equal(result.recorded_amount_zar,259.99);
 assert.equal(result.margin_final,false);
 assert.equal(f.calls(),1);
 const op=f.plan().writes[0];
 assert.equal(op.sheet,'Project Direct Costs');
 assert.equal(op.entity_type,'Direct Job Cost');
 assert.equal(op.operation,'CREATE_IF_ABSENT');
 assert.equal(op.values.evidence_status,'SUPPLIER_INVOICE_EVIDENCED');
 assert.equal(op.values.financial_treatment,'DIRECT_JOB_COST');
 assert.equal(op.values.allocation_status,'ALLOCATED_TO_JOB');
 assert.equal(op.values.amount,'259.99');
});
test('retries share deterministic cost ID and source event idempotency key',()=>{
 const a=deterministicCostId(jobId,eventId),b=deterministicCostId(jobId,eventId);
 assert.equal(a,b);
 assert.notEqual(a,deterministicCostId(jobId,'DIFFERENT-RECEIPT'));
});
test('dry-run never mutates business registers',async()=>{
 const f=fixture();
 const result=await recordVerifiedDirectCost({writer:f.writer,jobId,sourceEventId:eventId,
  evidenceVerifier:verification,dryRun:true});
 assert.equal(result.state,'DRY_RUN');
 assert.equal(f.calls(),0);
 assert.equal(result.plan.writes.length,1);
});
test('missing receipt evidence and unallocated stock are denied before writer',async()=>{
 const invalid=[
  {...att,verified:false},
  {...att,stock_split_verified:false},
  {...att,allocation_status:'ALLOCATED_TO_JOB_PENDING_STOCK_SPLIT'},
  {...att,evidence_status:'OWNER_CONFIRMED_EVIDENCE_PENDING'},
  {...att,evidence_link:'https://evil.example/forged'},
  {...att,amount_cents:0},
  {...att,source_event_id:'OTHER-EVENT'},
  {...att,job_id:'OTHER-JOB'},
  {...att,independent_reviewer_id:''}
 ];
 for(const bad of invalid){
  const f=fixture();
  const result=await recordVerifiedDirectCost({writer:f.writer,jobId,sourceEventId:eventId,
   evidenceVerifier:async()=>bad});
  assert.equal(result.state,'REVIEW_REQUIRED');
  assert.equal(f.calls(),0);
 }
});
test('wrong job execution opportunity prevents cost allocation',async()=>{
 const f=fixture();
 f.writer.stores.commercial.findByKey=async()=>({object:{...execution,opportunity_id:'OPP-OTHER'}});
 const r=await recordVerifiedDirectCost({writer:f.writer,jobId,sourceEventId:eventId,
  evidenceVerifier:verification});
 assert.equal(r.reason_code,'JOB_OR_EXECUTION_LINK_NOT_VERIFIED');
 assert.equal(f.calls(),0);
});
test('write authority remains with P3: governance or source failure cannot be silently bypassed',async()=>{
 const f=fixture();
 f.writer.execute=async()=>{throw Error('OWNER_NOT_FOUND')};
 const r=await recordVerifiedDirectCost({writer:f.writer,jobId,sourceEventId:eventId,
  evidenceVerifier:verification});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(r.reason_code,'DIRECT_COST_P3_WRITE_OR_GOVERNANCE_FAILED');
});
test('cost-capture HTTP route is isolated and cannot use runtime token',async()=>{
 let calls=0;
 const f=fixture();
 const app=createRuntimeApp({
  token:'runtime-token',directCostToken:'cost-authority-token',
  directCostEvidenceVerifier:verification,
  writerFactory:()=>({...f.writer,execute:async p=>{calls++;return f.writer.execute(p)}})
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/governance/direct-job-cost';
  const post=async (token,dryRun=true)=>fetch(url,{method:'POST',
   headers:{'content-type':'application/json',...(token?{'x-magos-direct-cost-token':token}:{})},
   body:JSON.stringify({jobId,sourceEventId:eventId,dryRun})});
  assert.equal((await post(null)).status,401);
  assert.equal((await post('runtime-token')).status,401);
  assert.equal((await post('cost-authority-token')).status,200);
  assert.equal(calls,0);
  const result=await post('cost-authority-token',false);
  assert.equal(result.status,200);
  assert.equal(calls,1);
 }finally{await new Promise(done=>server.close(done));}
});
test('generic transaction route cannot bypass direct-cost governance',async()=>{
 const f=fixture();let writes=0;
 const app=createRuntimeApp({token:'runtime-token',writerFactory:()=>({
  ...f.writer,execute:async()=>{writes++;return {state:'COMMITTED'}}
 })});
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/v1/transactions',{
   method:'POST',headers:{authorization:'Bearer runtime-token','content-type':'application/json'},
   body:JSON.stringify({event_type:'COST_OVERRIDE',idempotency_key:'fake',
    source_event_id:'fake',preconditions:[],writes:[{store:'commercial',sheet:'Project Direct Costs',
      operation:'CREATE_IF_ABSENT',values:{amount:'1000'}}]})});
  assert.equal(response.status,403);
  assert.equal(writes,0);
 }finally{await new Promise(done=>server.close(done));}
});

test('a receipt referencing an existing provisional cost must upgrade that row, not append another',async()=>{
 const f=fixture();
 const r=await recordVerifiedDirectCost({
   writer:f.writer,jobId,sourceEventId:eventId,
   evidenceVerifier:async()=>({...att,provisional_cost_id:'DP-0123456789ABCDEFABCDEF'})
 });
 assert.equal(r.reason_code,'USE_IN_PLACE_PROVISIONAL_COST_VERIFICATION');
 assert.equal(f.calls(),0);
});
test('exact provisional expense source already exists: no double-counted verified expense',async()=>{
 const f=fixture();
 const {provisionalId}=require('../processor/provisional-job-cost');
 const original=f.writer.stores.commercial.findByKey;
 f.writer.stores.commercial.findByKey=async(sheet,key,id)=>{
   if(sheet==='Project Direct Costs'&&id===provisionalId(jobId,eventId))
     return {object:{direct_cost_id:id,job_id:jobId,financial_treatment:'PROVISIONAL_DIRECT_COST'}};
   return original(sheet,key,id);
 };
 const r=await recordVerifiedDirectCost({
   writer:f.writer,jobId,sourceEventId:eventId,evidenceVerifier:verification
 });
 assert.equal(r.reason_code,'PROVISIONAL_COST_ALREADY_EXISTS_FOR_SOURCE_EVENT');
 assert.equal(f.calls(),0);
});
