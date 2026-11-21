'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {verifyProvisionalCost}=require('../processor/verify-provisional-cost');
const {createRuntimeApp}=require('../runtime/app');
const jobId='JOB-TEST-1',receiptEvent='SUPPLIER-RECEIPT-7';
const provisionalId='DP-0123456789ABCDEFABCDEF';
const job={job_id:jobId,opportunity_id:'OPP-1'};
const execution={'Job ID':jobId,opportunity_id:'OPP-1'};
const provisional={
 direct_cost_id:provisionalId,job_id:jobId,opportunity_id:'OPP-1',
 amount:'199.50',cost_category:'MATERIALS',
 financial_treatment:'PROVISIONAL_DIRECT_COST',
 evidence_status:'OWNER_CONFIRMED_EVIDENCE_PENDING',
 allocation_status:'TO_CONFIRM',evidence_link:'',
 notes:'Original declaration'
};
const receipt={
 verified:true,job_id:jobId,opportunity_id:'OPP-1',source_event_id:receiptEvent,
 provisional_cost_id:provisionalId,amount_cents:19950,cost_category:'MATERIALS',
 evidence_status:'SUPPLIER_INVOICE_EVIDENCED',
 allocation_status:'ALLOCATED_TO_JOB',stock_split_verified:true,
 evidence_link:'https://drive.google.com/file/d/test-supplier-invoice/view',
 source_authority:'SUPPLIER_INVOICE_VERIFIED',independent_reviewer_id:'REVIEWER-1'
};
function fixture(){
 let row={...provisional},commits=0,plan;
 const stores={
  crm:{findByKey:async()=>({object:job})},
  commercial:{findByKey:async(sheet,key,id)=>{
   if(sheet==='Job Execution')return {object:execution};
   if(sheet==='Project Direct Costs'&&id===provisionalId)return {object:{...row}};
   return null;
  }}
 };
 const writer={stores,execute:async p=>{
  commits++;plan=p;
  assert.equal(p.writes.length,1);
  assert.equal(p.writes[0].operation,'PATCH_IF_MATCH');
  assert.deepEqual(p.writes[0].expect,
    Object.fromEntries(Object.keys(p.writes[0].expect).map(k=>[k,row[k]])));
  row={...row,...p.writes[0].changes};
  return {state:'COMMITTED'};
 }};
 return {writer,commits:()=>commits,plan:()=>plan,row:()=>row};
}
const args={jobId,sourceEventId:receiptEvent,provisionalCostId:provisionalId,
 evidenceVerifier:async()=>({...receipt})};
test('receipt upgrades exactly one canonical provisional row without duplicating costs',async()=>{
 const f=fixture();
 const res=await verifyProvisionalCost({...args,writer:f.writer});
 assert.equal(res.state,'COMMITTED');
 assert.equal(f.commits(),1);
 assert.equal(f.plan().writes[0].entity_type,'Direct Job Cost');
 assert.equal(f.plan().writes[0].sheet,'Project Direct Costs');
 assert.equal(f.plan().writes[0].key.value,provisionalId);
 assert.equal(res.additional_cost_rows,0);
 assert.equal(res.profit_final,false);
 assert.equal(f.row().financial_treatment,'DIRECT_JOB_COST');
 assert.equal(f.row().amount,'199.50');
 assert.equal(f.row().evidence_link,receipt.evidence_link);
});
test('preview validates evidence and prepares CAS without mutating source',async()=>{
 const f=fixture();
 const res=await verifyProvisionalCost({...args,writer:f.writer,dryRun:true});
 assert.equal(res.state,'DRY_RUN');
 assert.equal(res.plan.writes.length,1);
 assert.equal(f.commits(),0);
});
test('revised amount, wrong row, missing split or untrusted review are refused',async()=>{
 for(const invalid of [
  {...receipt,amount_cents:19951},
  {...receipt,provisional_cost_id:'DP-DIFFERENT'},
  {...receipt,stock_split_verified:false},
  {...receipt,allocation_status:'TO_CONFIRM'},
  {...receipt,evidence_status:'OWNER_CONFIRMED_EVIDENCE_PENDING'},
  {...receipt,evidence_link:'https://evil.example/receipt'},
  {...receipt,independent_reviewer_id:''},
  {...receipt,source_event_id:'OTHER'},
  {...receipt,verified:false}
 ]){
  const f=fixture();
  const res=await verifyProvisionalCost({...args,writer:f.writer,
   evidenceVerifier:async()=>invalid});
  assert.equal(res.state,'REVIEW_REQUIRED');
  assert.equal(f.commits(),0);
 }
});
test('already verified row cannot be re-promoted or overwritten',async()=>{
 const f=fixture();
 const original=f.writer.stores.commercial.findByKey;
 f.writer.stores.commercial.findByKey=async(...params)=>{
  const found=await original(...params);
  if(params[0]==='Project Direct Costs'&&found)
   return {object:{...found.object,financial_treatment:'DIRECT_JOB_COST'}};
  return found;
 };
 const res=await verifyProvisionalCost({...args,writer:f.writer});
 assert.equal(res.reason_code,'PROVISIONAL_RECORD_NOT_PENDING');
 assert.equal(f.commits(),0);
});
test('same source event already recorded as independent cost is refused',async()=>{
 const {deterministicCostId}=require('../processor/record-direct-job-cost');
 const duplicate=deterministicCostId(jobId,receiptEvent);
 const f=fixture(),original=f.writer.stores.commercial.findByKey;
 f.writer.stores.commercial.findByKey=async(...params)=>{
  if(params[0]==='Project Direct Costs'&&params[2]===duplicate)
   return {object:{direct_cost_id:duplicate}};
  return original(...params);
 };
 const res=await verifyProvisionalCost({...args,writer:f.writer});
 assert.equal(res.reason_code,'RECEIPT_ALREADY_RECORDED_AS_SEPARATE_COST');
 assert.equal(f.commits(),0);
});
test('P3 failure cannot claim a verified expense',async()=>{
 const f=fixture();
 f.writer.execute=async()=>{throw Error('WRITER_AUTHORITY_UNREGISTERED')};
 const res=await verifyProvisionalCost({...args,writer:f.writer});
 assert.equal(res.state,'REVIEW_REQUIRED');
 assert.equal(res.reason_code,'P3_VERIFICATION_TRANSACTION_FAILED');
});
test('protected endpoint denies wrong token and dry run does not write',async()=>{
 const f=fixture();
 const app=createRuntimeApp({
  token:'runtime-token',directCostToken:'cost-token',
  directCostEvidenceVerifier:async()=>({...receipt}),
  writerFactory:()=>f.writer
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/governance/verify-provisional-cost';
  const post=async(token,dryRun)=>fetch(url,{
   method:'POST',headers:{'content-type':'application/json',
    ...(token?{'x-magos-direct-cost-token':token}:{})},
   body:JSON.stringify({...args,evidenceVerifier:undefined,dryRun})
  });
  assert.equal((await post(null,true)).status,401);
  assert.equal((await post('runtime-token',true)).status,401);
  const preview=await post('cost-token',true);
  assert.equal(preview.status,200);
  assert.equal((await preview.json()).state,'DRY_RUN');
  assert.equal(f.commits(),0);
  const commit=await post('cost-token',false);
  assert.equal(commit.status,200);
  assert.equal((await commit.json()).readback_verified,true);
  assert.equal(f.commits(),1);
 }finally{await new Promise(done=>server.close(done));}
});
