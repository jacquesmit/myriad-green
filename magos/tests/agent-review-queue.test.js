'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planAgentTask}=require('../agents/agent-router');
const {AgentReviewQueue}=require('../agents/agent-review-queue');
const p=planAgentTask({
  job_type_id:'JT-002',tenant_id:'MYRIAD_GREEN',jurisdiction_id:'ZA',
  branch_id:'PRETORIA',canonical_record_id:'CRM-TEST-1',source:'GMAIL',
  source_event_id:'MSG-TEST-1',evidence_refs:['test:gmail:1'],
  effect:'WRITE_BUSINESS_RECORD'
});
function fakeLedger() {
 const records=new Map();
 return {
  records,
  async findByKey(sheet,key,value){
    assert.equal(sheet,'Sync_Exceptions');
    assert.equal(key,'idempotency_key');
    const object=records.get(value);
    return object?{object}:null;
  },
  async raiseSyncException(data){
    const id='SYNC-EXC-TEST-1';
    records.set(data.idempotencyKey,{
      exception_id:id,record_id:data.recordId,status:'OPEN',
      source_value:data.sourceValue
    });
    return id;
  }
 };
}
test('routes approval-required task into existing Sync_Exceptions review and readback',async()=>{
 const ledger=fakeLedger();
 const q=new AgentReviewQueue({ledger});
 const first=await q.enqueue(p);
 assert.equal(first.state,'REVIEW_RECORDED');
 assert.match(first.review_key,/^review:agent:/);
 assert.equal(ledger.records.size,1);
 assert.equal(JSON.parse(ledger.records.get(first.review_key).source_value).agent_id,'AG-003');
 const again=await q.enqueue(p);
 assert.equal(again.state,'DUPLICATE_NO_OP');
 assert.equal(ledger.records.size,1);
});
test('does not enqueue ordinary read-only proposals',async()=>{
 const read=planAgentTask({
  job_type_id:'JT-002',tenant_id:'MYRIAD_GREEN',jurisdiction_id:'ZA',
  branch_id:'PRETORIA',canonical_record_id:'CRM-TEST-1',source:'GMAIL',
  source_event_id:'MSG-TEST-1',evidence_refs:['test:gmail:1']
 });
 await assert.rejects(new AgentReviewQueue({ledger:fakeLedger()}).enqueue(read));
});
test('requires authoritative readback before reporting success',async()=>{
 const ledger=fakeLedger();
 ledger.findByKey=async()=>null;
 await assert.rejects(new AgentReviewQueue({ledger}).enqueue(p),/READBACK_FAILED/);
});
test('never reopens a prior resolved review on replay',async()=>{
 const ledger=fakeLedger();
 const key='review:agent:'+p.idempotency_key;
 ledger.records.set(key,{exception_id:'SYNC-EXC-RESOLVED',status:'RESOLVED'});
 const r=await new AgentReviewQueue({ledger}).enqueue(p);
 assert.equal(r.state,'DUPLICATE_NO_OP');
 assert.equal(ledger.records.get(key).status,'RESOLVED');
});
