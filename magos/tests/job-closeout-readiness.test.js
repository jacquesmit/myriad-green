'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectJobCloseout,money}=require('../processor/job-closeout-readiness');
const execution={'Execution ID':'EX-T1','Job ID':'JOB-T1','Job Status':'COMPLETED',
 'Completion Status':'HANDOVER_COMPLETE','Variation Required':'YES',
 'After Evidence':'test:photos','Completion Sign-off':'test:signoff'};
const variation={'Variation ID':'VAR-T1','Job ID':'JOB-T1',
 'Approval Status':'APPROVED','Approval Evidence':'test:client-consent',
 'Execution Status':'WORK_COMPLETED'};
const cost={direct_cost_id:'COST-T1',job_id:'JOB-T1',
 financial_treatment:'DIRECT_JOB_COST',amount:'R 200.00',
 evidence_link:'test:supplier:invoice',evidence_status:'SUPPLIER_INVOICE_EVIDENCED',
 allocation_status:'ALLOCATED_TO_JOB'};
const margin={margin_record_id:'MARG-T1',job_id:'JOB-T1',
 contract_value_inc_vat:'1000',final_cost_status:'FINAL',
 labour_cost_status:'CONFIRMED',overhead_allocation_status:'PASS'};
function stores(e=execution,v=[variation],c=[cost],m=[margin]){
 return {commercial:{readObjects:async tab=>({
  'Job Execution':e?[e]:[],Variations:v,
  'Project Direct Costs':c,'Project Cost & Margin':m
 })[tab]}};
}
test('read-only closeout computes traceable provisional known-direct-cost contribution',async()=>{
 const x=await inspectJobCloseout({stores:stores(),jobId:'JOB-T1'});
 assert.equal(x.state,'READY_FOR_INDEPENDENT_FINANCIAL_CLOSE_REVIEW');
 assert.equal(x.evidenced_cost_sum_zar,200);
 assert.equal(x.contract_value_zar,1000);
 assert.equal(x.provisional_contribution_before_unverified_costs_zar,800);
 assert.equal(x.final_profit_verified,false);
 assert.equal(x.operational_close_authorized,false);
 assert.deepEqual(x.writes,[]);
});
test('variation under review blocks closeout, even when work is finished',async()=>{
 const x=await inspectJobCloseout({stores:stores(execution,[{...variation,'Approval Status':'TO_CONFIRM'}]),jobId:'JOB-T1'});
 assert.equal(x.state,'REVIEW_REQUIRED');
 assert.ok(x.blockers.some(b=>b.startsWith('VARIATION_APPROVAL_UNVERIFIED')));
});
test('reported cost without receipt and direct allocation does not count as verified',async()=>{
 const x=await inspectJobCloseout({stores:stores(execution,[variation],[{
  ...cost,evidence_link:'',evidence_status:'OWNER_CONFIRMED_EVIDENCE_PENDING',
  allocation_status:'ALLOCATED_TO_JOB_PENDING_LINE_AND_STOCK_SPLIT'
 }]),jobId:'JOB-T1'});
 assert.equal(x.state,'REVIEW_REQUIRED');
 assert.ok(x.blockers.some(b=>b.startsWith('DIRECT_COST_EVIDENCE_UNVERIFIED')));
 assert.ok(x.blockers.some(b=>b.startsWith('DIRECT_COST_ALLOCATION_UNVERIFIED')));
});
test('completion evidence is mandatory and cannot be inferred from status text',async()=>{
 const x=await inspectJobCloseout({stores:stores({...execution,'After Evidence':'','Completion Sign-off':''}),jobId:'JOB-T1'});
 assert.ok(x.blockers.includes('AFTER_EVIDENCE_MISSING'));
 assert.ok(x.blockers.includes('COMPLETION_SIGNOFF_MISSING'));
});
test('duplicate execution, cost and variation identities fail closed',async()=>{
 const x=await inspectJobCloseout({stores:{commercial:{readObjects:async t=>({
  'Job Execution':[execution,execution],Variations:[variation,variation],
  'Project Direct Costs':[cost,cost],'Project Cost & Margin':[margin]
 })[t]}},jobId:'JOB-T1'});
 assert.ok(x.blockers.includes('DUPLICATE_JOB_EXECUTION'));
 assert.ok(x.blockers.includes('DUPLICATE_OR_MISSING_VARIATION_ID'));
 assert.ok(x.blockers.includes('DUPLICATE_OR_MISSING_DIRECT_COST_ID'));
});
test('missing job or financial cost reconciliation does not complete',async()=>{
 const x=await inspectJobCloseout({stores:stores(null,[],[],[]),jobId:'JOB-T1'});
 assert.equal(x.state,'REVIEW_REQUIRED');
 assert.ok(x.blockers.includes('JOB_EXECUTION_NOT_FOUND'));
 assert.ok(x.blockers.includes('ACTUAL_COST_LINES_MISSING'));
});
test('malformed money and missing data rejected, not treated as zero',()=>{
 assert.equal(money('R 1,234.50'),1234.5);
 assert.equal(money('TO_CONFIRM'),null);
 assert.equal(money(''),null);
 assert.equal(money('-100'),null);
});
