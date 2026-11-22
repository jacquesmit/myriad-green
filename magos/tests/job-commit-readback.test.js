'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyJobReadback}=require('../processor/job-commit-readback');
const input={jobId:'JOB-1',opportunityId:'OP-1',executionId:'EXEC-1',quoteId:'Q-1',
 expectedJobChanges:{job_id:'JOB-1',job_status:'JOB_CREATED'},
 expectedExecutionValues:{'Execution ID':'EXEC-1','Job ID':'JOB-1',
  opportunity_id:'OP-1',quote_id:'Q-1','CRM ID':'CRM-1',
  'Accepted Scope':'Irrigation Repair','Deposit Cleared':'CLEARED',
  'Job Status':'JOB_CREATED','Schedule Status':'TO_SCHEDULE'}};
const job={job_id:'JOB-1',job_status:'JOB_CREATED',opportunity_id:'OP-1',client_crm_id:'CRM-1'};
const execution={...input.expectedExecutionValues};
function stores(j=job,e=execution){
 return {crm:{findByKey:async()=>({object:j})},
  commercial:{findByKey:async()=>({object:e})}};
}
test('readback verifies exact planned job, accepted scope, payment and CRM link',async()=>{
 assert.equal((await verifyJobReadback({...input,stores:stores()})).verified,true);
});
test('readback rejects wrong client, accepted scope and clearance field',async()=>{
 for(const [field,value] of [['CRM ID','CRM-OTHER'],['Accepted Scope','Other scope'],
  ['Deposit Cleared','PROOF_RECEIVED'],['Schedule Status','SCHEDULED']]){
  const result=await verifyJobReadback({...input,stores:stores(job,{...execution,[field]:value})});
  assert.equal(result.verified,false);
  assert.equal(result.reason_code,'CANONICAL_EXECUTION_READBACK_FIELD_MISMATCH');
  assert.equal(result.field,field);
 }
});
test('readback rejects wrong CRM client identity and job status',async()=>{
 const crm=await verifyJobReadback({...input,stores:stores({...job,client_crm_id:'OTHER'})});
 assert.equal(crm.verified,false);
 assert.equal(crm.reason_code,'CANONICAL_CLIENT_LINK_READBACK_MISMATCH');
 const state=await verifyJobReadback({...input,stores:stores({...job,job_status:'CANCELLED'})});
 assert.equal(state.reason_code,'CANONICAL_JOB_READBACK_FIELD_MISMATCH');
});
test('missing compiled write contract or missing identity refuses success',async()=>{
 assert.equal((await verifyJobReadback({...input,stores:stores(),expectedJobChanges:undefined})).verified,false);
 assert.equal((await verifyJobReadback({...input,stores:stores(),executionId:''})).verified,false);
});
test('missing execution identity and missing records cannot assert job success',async()=>{
 const missing=await verifyJobReadback({...input,stores:stores(job,{...execution,'Execution ID':''})});
 assert.equal(missing.reason_code,'CANONICAL_JOB_READBACK_MISMATCH');
 const empty=await verifyJobReadback({...input,stores:{commercial:{findByKey:async()=>null},
  crm:{findByKey:async()=>null}}});
 assert.equal(empty.reason_code,'CANONICAL_JOB_READBACK_MISSING');
});
test('source read failure fails closed without pretending payment or job success',async()=>{
 const r=await verifyJobReadback({...input,stores:{crm:{findByKey:async()=>{throw Error('down')}},
  commercial:{findByKey:async()=>null}}});
 assert.equal(r.reason_code,'CANONICAL_READBACK_SOURCE_ERROR');
});
