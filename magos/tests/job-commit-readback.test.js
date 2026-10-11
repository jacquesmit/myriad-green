'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyJobReadback}=require('../processor/job-commit-readback');
const input={jobId:'JOB-1',opportunityId:'OP-1',executionId:'EXEC-1',quoteId:'Q-1'};
function stores(mismatch=false){
 return {crm:{findByKey:async()=>({object:{job_id:mismatch?'JOB-WRONG':'JOB-1'}})},commercial:{findByKey:async()=>({object:{'Job ID':'JOB-1',opportunity_id:'OP-1',quote_id:'Q-1'}})}};
}
test('job readback verifies both canonical linked records',async()=>{
 assert.equal((await verifyJobReadback({...input,stores:stores()})).verified,true);
});
test('job readback rejects a mismatched CRM ID',async()=>{
 const r=await verifyJobReadback({...input,stores:stores(true)});
 assert.equal(r.verified,false);assert.equal(r.reason_code,'CANONICAL_JOB_READBACK_MISMATCH');
});
test('unavailable canonical readback cannot assert job success',async()=>{
 assert.equal((await verifyJobReadback({...input,stores:{}})).verified,false);
});
