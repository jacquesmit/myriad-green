'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectSchedulingReadiness}=require('../processor/scheduling-readiness');
const job={job_id:'JOB-T1',opportunity_id:'OPP-T1',property_id:'PROP-T1',
 site_address:'Test property',job_status:'READY'};
const exec={'Job ID':'JOB-T1',opportunity_id:'OPP-T1','Site Address':'Test property',
 'Accepted Scope':'Accepted irrigation repair',quote_id:'Q-T1',
 'Crew / Owner':'Crew A','Materials Ready':'NOT_REQUIRED', 'Job Status':'READY'};
const control={'Control ID':'PAY-T1','Opportunity ID':'OPP-T1','Deposit Required (R)':'250'};
const allocation={control_id:'PAY-T1',allocation_id:'ALLOC-T1',allocation_type:'DEPOSIT',
 allocation_state:'CLEARED',amount:'250',evidence_link:'test:bank'};
function stores({j=[job],e=[exec],r=[],b=[],payments=[control],allocations=[allocation]}={}){
 return {crm:{readObjects:async name=>name==='Jobs_Opportunities'?j:name==='Bookings'?b:[]},
 commercial:{readObjects:async name=>({
  'Job Execution':e,Procurement:r,'Payment Control':payments,
  'Payment_Allocations':allocations
 })[name]}};
}
test('ready job may proceed only to actual provider availability check',async()=>{
 const result=await inspectSchedulingReadiness({stores:stores(),jobId:'JOB-T1'});
 assert.equal(result.state,'READY_FOR_PROVIDER_AVAILABILITY_CHECK');
 assert.equal(result.calendar_availability_verified,false);
 assert.equal(result.booking_authorized,false);
 assert.deepEqual(result.writes,[]);
});
test('payment proof without cleared deposit blocks schedule readiness',async()=>{
 const result=await inspectSchedulingReadiness({stores:stores({
  allocations:[{...allocation,allocation_state:'PROOF_RECEIVED'}]
 }),jobId:'JOB-T1'});
 assert.equal(result.state,'REVIEW_REQUIRED');
 assert.ok(result.review_reasons.includes('BANK_CLEARED_DEPOSIT_NOT_VERIFIED'));
});
test('unassigned crew and missing materials block readiness',async()=>{
 const result=await inspectSchedulingReadiness({stores:stores({
  e:[{...exec,'Crew / Owner':'TO_CONFIRM','Materials Ready':'PART_READY'}]
 }),jobId:'JOB-T1'});
 assert.ok(result.review_reasons.includes('CREW_NOT_ASSIGNED'));
 assert.ok(result.review_reasons.includes('MATERIALS_NOT_READY'));
});
test('booked job cannot be double-booked by a replay',async()=>{
 const result=await inspectSchedulingReadiness({stores:stores({
  b:[{booking_id:'B-T1',job_id:'JOB-T1',mgos_booking_status:'CONFIRMED',source_system:'AMELIA'}]
 }),jobId:'JOB-T1'});
 assert.equal(result.state,'BLOCKED');
 assert.ok(result.blockers.includes('ACTIVE_PROVIDER_BOOKING_ALREADY_EXISTS'));
});
test('unsupported procurement release or missing receipt is visible',async()=>{
 const requirement={'Procurement ID':'PROC-T1','Job ID':'JOB-T1',
  'Procurement Gate':'BLOCK',technical_gate:'TO_CONFIRM','Stock Status':'OUT_OF_STOCK'};
 const result=await inspectSchedulingReadiness({stores:stores({
  e:[{...exec,'Materials Ready':'READY'}],r:[requirement]
 }),jobId:'JOB-T1'});
 assert.ok(result.review_reasons.includes('PROCUREMENT_RELEASE_OR_TECHNICAL_GATE_UNVERIFIED'));
 assert.ok(result.review_reasons.includes('MATERIAL_STOCK_OR_RECEIPT_EVIDENCE_MISSING'));
});
test('duplicate job identity and completed job are denied',async()=>{
 const duplicate=await inspectSchedulingReadiness({stores:stores({j:[job,job]}),jobId:'JOB-T1'});
 assert.ok(duplicate.blockers.includes('JOB_ID_MISSING_OR_AMBIGUOUS'));
 const finished=await inspectSchedulingReadiness({stores:stores({
  j:[{...job,job_status:'JOB_COMPLETED'}]
 }),jobId:'JOB-T1'});
 assert.ok(finished.blockers.includes('JOB_NOT_ACTIVE'));
});

test('schedule readiness endpoint is view-only with separate operator credential',async()=>{
 const http=require('node:http');
 const {createRuntimeApp}=require('../runtime/app');
 const app=createRuntimeApp({
  token:'runtime-token',operatorReadToken:'view-token',
  writerFactory:()=>({stores:stores(),execute:async()=>{throw Error('DO_NOT_BOOK')}})
 });
 const server=http.createServer(app);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/operator/scheduling-readiness/JOB-T1';
  assert.equal((await fetch(url)).status,401);
  const r=await fetch(url,{headers:{'X-MAGOS-Operator-Token':'view-token'}});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.booking_authorized,false);
  assert.equal(body.state,'READY_FOR_PROVIDER_AVAILABILITY_CHECK');
 }finally{await new Promise(ok=>server.close(ok));}
});
