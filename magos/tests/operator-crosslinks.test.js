'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {canonicalRelations}=require('../processor/operator-crosslinks');
const row=(id,details={},title='')=>({id,title,status:'OPEN',next_action:'Review',details});
const live=records=>({state:'LIVE',records});
test('exact CRM, opportunity and job IDs connect the same customer workflow across modules',()=>{
 const departments={
  clients:live([row('CRM-1',{'Opportunity ID':'OP-1'})]),
  jobs:live([row('OP-1',{client_id:'CRM-1',job_id:'JOB-1'})]),
  quotes:live([row('QUOTE-1',{opportunity_id:'OP-1',job_id:'JOB-1'})]),
  finance:live([row('PAY-1',{'Opportunity ID':'OP-1','Job ID':'JOB-1'})]),
  variations:live([row('VAR-1',{'Job ID':'JOB-1'})]),
  evidence:live([row('EXEC-1',{'Job ID':'JOB-1'})]),
  labour:live([row('JOB-1',{})])
 };
 const result=canonicalRelations(departments);
 assert.ok(result.linked_records>0);
 const related=departments.jobs.records[0].related;
 for(const dept of ['clients','quotes','finance','variations','evidence','labour'])
  assert.ok(related.some(link=>link.department===dept),dept);
 assert.ok(departments.clients.records[0].related.some(link=>
  link.department==='jobs'&&link.id==='OP-1'));
 assert.equal(result.side_effects,false);
 assert.deepEqual(result.writes,[]);
});
test('similar names, loose descriptions or reused phone numbers are never linking keys',()=>{
 const departments={
  clients:live([row('CRM-1',{company:'Same Company',phone:'555'})]),
  jobs:live([row('OP-9',{client_id:'CRM-OTHER',job_id:'JOB-9',
   company:'Same Company',phone:'555'})])
 };
 canonicalRelations(departments);
 assert.deepEqual(departments.clients.records[0].related,[]);
 assert.deepEqual(departments.jobs.records[0].related,[]);
});
test('conflicting exact IDs quarantine links rather than joining contradictory jobs',()=>{
 const departments={
  jobs:live([row('OP-1',{client_id:'CRM-1',job_id:'JOB-1'})]),
  quotes:live([row('QUOTE-1',{opportunity_id:'OP-1',job_id:'JOB-2'})]),
  evidence:live([row('EXEC-1',{'Job ID':'JOB-2'})])
 };
 canonicalRelations(departments);
 assert.deepEqual(departments.jobs.records[0].related,[]);
 assert.ok(departments.quotes.records[0].related.some(r=>r.department==='evidence'));
});
test('ambiguous duplicate target IDs are excluded, unavailable departments cannot become links',()=>{
 const departments={
  jobs:live([row('OP-1',{job_id:'JOB-1'})]),
  variations:live([row('VAR-1',{'Job ID':'JOB-1'}),row('VAR-1',{'Job ID':'JOB-1'})]),
  evidence:{state:'UNAVAILABLE',records:[row('EXEC-1',{'Job ID':'JOB-1'})]}
 };
 const result=canonicalRelations(departments);
 assert.ok(result.conflicts>=1);
 assert.deepEqual(departments.jobs.records[0].related,[]);
});
test('exception records never link on fabricated source identifiers',()=>{
 const departments={
  conversions:live([row('DUPLICATE_crm_id:CRM-1',{'Client CRM ID':'CRM-1'},'Attribution reconciliation')]),
  clients:live([row('CRM-1')])
 };
 departments.conversions.records[0].status='REVIEW_REQUIRED';
 canonicalRelations(departments);
 assert.deepEqual(departments.clients.records[0].related,[]);
});
