'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectLabourCostRegister}=require('../processor/labour-reconciliation');
const rateRows=[
 {labour_rate_id:'RATE-OWNER',person_role:'OWNER_TECHNICIAN',rate_basis:'PER_DAY',
  rate:'350',currency:'ZAR',effective_from:'2026-08-02'},
 {labour_rate_id:'RATE-HELPER',person_role:'HELPER',rate_basis:'PER_DAY',
  rate:'350',currency:'ZAR',effective_from:'2026-08-02'}
];
const marginRows=[
 {margin_record_id:'M-1',job_id:'JOB-1',
  crew_daily_rate_total:'700',crew_days:'2',provisional_labour_cost:'1400'}
];
test('matching crew-day arithmetic is never confused with independently verified actual labour',()=>{
 const result=inspectLabourCostRegister({rateRows,marginRows});
 assert.equal(result.counts.jobs,1);
 assert.equal(result.counts.provisional_calculations_matched,1);
 assert.equal(result.counts.actual_labour_verified,0);
 assert.equal(result.records[0].calculated_crew_cost_zar,1400);
 assert.equal(result.records[0].final_actual_labour_verified,false);
 assert.ok(result.records[0].blockers.includes('WORKER_ASSIGNMENT_AND_ACTUAL_TIME_NOT_VERIFIED'));
 assert.deepEqual(result.writes,[]);
});
test('crew calculation mismatch and missing days fail closed',()=>{
 const wrong=inspectLabourCostRegister({rateRows,marginRows:[
  {...marginRows[0],provisional_labour_cost:'1200'}]});
 assert.ok(wrong.records[0].blockers.includes('CREW_RATE_DAYS_COST_MISMATCH'));
 const missing=inspectLabourCostRegister({rateRows,marginRows:[
  {...marginRows[0],crew_days:'TO_CONFIRM'}]});
 assert.ok(missing.records[0].blockers.includes('CREW_DAYS_UNVERIFIED'));
 assert.equal(missing.records[0].calculated_crew_cost_zar,null);
});
test('unsupported rate, duplicate identifiers and invalid currency are review flags',()=>{
 const result=inspectLabourCostRegister({rateRows:[
  rateRows[0],{...rateRows[0],currency:'USD',rate:'INVALID',rate_basis:'MONTH'}],
  marginRows});
 assert.ok(result.rate_issues.some(x=>x.startsWith('DUPLICATE_OR_MISSING_LABOUR_RATE_ID')));
 assert.ok(result.rate_issues.some(x=>x.startsWith('INVALID_LABOUR_RATE')));
 assert.ok(result.rate_issues.some(x=>x.startsWith('UNSUPPORTED_LABOUR_RATE_CURRENCY')));
 assert.equal(result.state,'PARTIAL');
});
test('no rate/time source is unavailable, not a zero-cost job',()=>{
 const result=inspectLabourCostRegister({rateRows:null,marginRows});
 assert.equal(result.state,'UNAVAILABLE');
 assert.equal(result.counts,undefined);
});
test('empty margins do not imply proven payroll or profitability',()=>{
 const result=inspectLabourCostRegister({rateRows,marginRows:[]});
 assert.equal(result.counts.jobs,0);
 assert.equal(result.counts.actual_labour_verified,0);
});
