'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEventEnvelope}=require('../processor/event-envelope');
const {WorkflowRunner,WorkflowInputError}=require('../workflows/runner');
const {listWorkflows}=require('../workflows/catalog');

function event(type='LEAD_SUBMITTED', overrides={}) {
  return createEventEnvelope({
    source:'TEST',source_event_id:'TEST-SOURCE-1',event_type:type,
    guards:{spam:'CLEAR',phishing:'CLEAR',explicit_content:'CLEAR',
      malware:'CLEAR',irrelevant:'CLEAR'},
    evidence:[{type:'TEST',ref:'test://provider/1'}],
    payload:{},...overrides
  },{now:()=>new Date('2026-11-21T08:00:00Z')});
}
test('catalogue exposes six human workflow names and legacy ids only as metadata',()=>{
 const found=listWorkflows();
 assert.equal(found.length,6);
 assert.ok(found.every(x=>x.name && x.event_type && x.legacy_agent_id));
 assert.equal(found.find(x=>x.id==='lead-intake').name,'Lead Intake');
});
test('lead workflow invokes existing governed dispatcher unchanged',async()=>{
 let calls=0;let received;
 const runner=new WorkflowRunner({dispatcher:{run:async e=>{
  calls++;received=e;return {state:'COMMITTED',writer:{transaction_id:'TXN-TEST'}};
 }}});
 const envelope=event();
 const result=await runner.run({workflow_id:'lead-intake',envelope});
 assert.equal(calls,1);
 assert.equal(received,envelope);
 assert.equal(result.state,'COMMITTED');
 assert.equal(result.writer.transaction_id,'TXN-TEST');
});
test('duplicate replay retains deterministic event identity',async()=>{
 const seen=new Set();let writes=0;
 const runner=new WorkflowRunner({dispatcher:{run:async e=>{
  if(seen.has(e.idempotency_key))return {state:'DUPLICATE'};
  seen.add(e.idempotency_key);writes++;return {state:'COMMITTED'};
 }}});
 const input={workflow_id:'lead-intake',envelope:event()};
 assert.equal((await runner.run(input)).state,'COMMITTED');
 assert.equal((await runner.run(input)).state,'DUPLICATE');
 assert.equal(writes,1);
});
test('payment and supplier workflows are attached to registered governed event types',async()=>{
 for(const [workflow_id,event_type] of [
  ['payment-evidence','PAYMENT_OBSERVED'],
  ['supplier-inbox','SUPPLIER_EMAIL_RECEIVED'],
  ['supplier-pricing','SUPPLIER_PRICE_OBSERVED'],
  ['document-intake','DOCUMENT_RECEIVED'],
  ['document-filing','DOCUMENT_FILED']]) {
  const runner=new WorkflowRunner({dispatcher:{run:async()=>({state:'REVIEW_REQUIRED'})}});
  const result=await runner.run({workflow_id,envelope:event(event_type)});
  assert.equal(result.state,'REVIEW_REQUIRED');
 }
});
test('unknown workflow and event-type substitution are rejected without dispatch',async()=>{
 let calls=0;
 const runner=new WorkflowRunner({dispatcher:{run:async()=>{calls++;return {state:'COMMITTED'};}}});
 await assert.rejects(runner.run({workflow_id:'payroll-auto',envelope:event()}),e=>e.code==='UNKNOWN_WORKFLOW');
 await assert.rejects(runner.run({workflow_id:'lead-intake',envelope:event('PAYMENT_OBSERVED')}),e=>e.code==='WORKFLOW_EVENT_TYPE_MISMATCH');
 assert.equal(calls,0);
});
test('forged idempotency/event ids are rejected',async()=>{
 let calls=0;const runner=new WorkflowRunner({dispatcher:{run:async()=>{calls++;}}});
 for(const forged of [
  {idempotency_key:'MAGOS_EVENT_V1|ATTACK'},
  {event_id:'EVT-FORGED'}
 ]) {
  await assert.rejects(runner.run({workflow_id:'lead-intake',
    envelope:{...event(),...forged}}),e=>e.code==='EVENT_IDENTITY_MISMATCH');
 }
 assert.equal(calls,0);
});
test('missing evidence rejected before any dispatch',async()=>{
 const runner=new WorkflowRunner({dispatcher:{run:async()=>{throw Error('must not execute');}}});
 await assert.rejects(runner.run({workflow_id:'lead-intake',
  envelope:event('LEAD_SUBMITTED',{evidence:[]})}),e=>e.code==='MISSING_SOURCE_EVIDENCE');
});
test('unknown/blocked safety guards are preserved for the governed processor',async()=>{
 const e=event('LEAD_SUBMITTED',{guards:{spam:'UNKNOWN',
  phishing:'CLEAR',explicit_content:'CLEAR',malware:'CLEAR',irrelevant:'CLEAR'}});
 let forwarded;
 const runner=new WorkflowRunner({dispatcher:{run:async input=>{
  forwarded=input;return {state:'REVIEW_REQUIRED'};
 }}});
 assert.equal((await runner.run({workflow_id:'lead-intake',envelope:e})).state,'REVIEW_REQUIRED');
 assert.equal(forwarded.guards.spam,'UNKNOWN');
});
test('unexpected dispatcher state is not reported as complete',async()=>{
 const runner=new WorkflowRunner({dispatcher:{run:async()=>({state:'SUCCESS_BUT_UNVERIFIED'})}});
 await assert.rejects(runner.run({workflow_id:'lead-intake',envelope:event()}),/INVALID_RESULT/);
});
