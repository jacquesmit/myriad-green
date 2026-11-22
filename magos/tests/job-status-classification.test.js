'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyJobStatus,inspectJobStatusRegister}=require('../processor/job-status-classification');
const make=(id,status,job_id)=>({opportunity_id:id,job_status:status,job_id});
test('observed completed and closed statuses never count as active',()=>{
 for(const status of ['JOB_COMPLETED','JOB_COMPLETED_CLOSED','COMPLETED','CLOSED','HANDOVER_COMPLETE']){
  const r=classifyJobStatus(make('O-1',status,'J-1'));
  assert.equal(r.state,'RECORDED_HISTORICAL_JOB',status);
 }
});
test('recorded active job requires a real job ID and supported current work state',()=>{
 const records=[
  make('O-A','JOB_IN_PROGRESS','J-A'),
  make('O-B','JOB_BOOKED','J-B'),
  make('O-C','AWAITING_MATERIALS','J-C'),
  make('O-D','IN_PROGRESS','J-D'),
  make('O-E','JOB_COMPLETED_CLOSED','J-E'),
  make('O-F','NO_JOB','J-F'),
  make('O-G','ASSESSMENT_NEEDED','J-G'),
  make('O-H','JOB_BOOKED',''),
  make('O-I','', 'J-I'),
  make('O-K','CALL_OUT_NEEDED','J-K')
 ];
 const r=inspectJobStatusRegister(records);
 assert.deepEqual(r.active.map(x=>x.opportunity_id),['O-A','O-B','O-C','O-D']);
 assert.equal(r.counts.active,4);
 assert.equal(r.counts.review,4);
 assert.deepEqual(r.review.map(x=>x.opportunity_id),['O-F','O-G','O-I','O-K']);
 assert.equal(r.review.find(x=>x.opportunity_id==='O-F').reason,
  'JOB_ID_PRESENT_WITH_PRE_JOB_OR_UNCONFIRMED_STATUS');
 assert.deepEqual(r.writes,[]);assert.equal(r.side_effects,false);
});
test('duplicate opportunity identity cannot be counted as an active job',()=>{
 const r=inspectJobStatusRegister([
  make('O-1','JOB_IN_PROGRESS','J-1'),
  make('O-1','JOB_IN_PROGRESS','J-2'),
  make('O-2','JOB_IN_PROGRESS','J-3')
 ]);
 assert.equal(r.state,'PARTIAL');
 assert.equal(r.counts.active,1);
 assert.equal(r.counts.duplicate_opportunity_ids,1);
});
test('empty or absent source never creates an active-job PASS',()=>{
 assert.equal(inspectJobStatusRegister(null).state,'UNAVAILABLE');
 assert.equal(classifyJobStatus(make('O-1','NO_JOB','')).state,'NO_RECORDED_JOB');
});
