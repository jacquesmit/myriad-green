'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectVariationRow,inspectVariationRegister}=require('../processor/variation-review');
const row={'Variation ID':'VAR-1','Job ID':'JOB-1',Client:'Client',
 'Original Scope Ref':'QUOTE-1','New Finding':'Additional leaking valve',
 'Additional Work':'Replace additional valve','Cost Impact (R)':'250',
 'Selling Price Impact (R)':'700','Approval Status':'APPROVED',
 'Approval Evidence':'https://drive.google.com/file/d/approval/view',
 'Execution Status':'WORK_COMPLETED','Drive Evidence':'https://drive.google.com/file/d/after/view',
 'Invoice Ref':'INV-1'};
test('approved documented variation remains subject to downstream financial clearance',()=>{
 const v=inspectVariationRow(row);
 assert.equal(v.state,'EVIDENCED_VARIATION');assert.equal(v.approved_for_scope,true);
 assert.equal(v.financial_close_authorized,false);
 assert.equal(v.payment_clearance,'NOT_VERIFIED');
 assert.deepEqual(v.blockers,[]);
});
test('completed work cannot overwrite missing signed client variation approval',()=>{
 const v=inspectVariationRow({...row,'Approval Status':'DRAFT','Approval Evidence':''});
 assert.equal(v.state,'REVIEW_REQUIRED');
 assert.ok(v.blockers.includes('RETROSPECTIVE_CLIENT_APPROVAL_REQUIRED'));
 assert.ok(v.blockers.includes('CLIENT_VARIATION_APPROVAL_UNVERIFIED'));
});
test('zero-price substituted scope still needs client signoff',()=>{
 const v=inspectVariationRow({...row,'Cost Impact (R)':'0',
  'Selling Price Impact (R)':'0','Approval Status':'TO_CONFIRM','Approval Evidence':''});
 assert.equal(v.price_impact_zar,0);
 assert.ok(v.blockers.includes('RETROSPECTIVE_CLIENT_APPROVAL_REQUIRED'));
});
test('price/cost omissions, unbilled extra work and undocumented scope fail closed',()=>{
 const v=inspectVariationRow({...row,'Cost Impact (R)':'',
  'Selling Price Impact (R)':'1200','Invoice Ref':'',
  'New Finding':'','Additional Work':''});
 assert.ok(v.blockers.includes('COST_IMPACT_UNVERIFIED'));
 assert.ok(v.blockers.includes('BILLABLE_VARIATION_INVOICE_LINK_MISSING'));
 assert.ok(v.blockers.includes('SCOPE_DELTA_NOT_DOCUMENTED'));
});
test('duplicate variation identity is quarantined and not silently counted as approved',()=>{
 const r=inspectVariationRegister([row,{...row}]);
 assert.equal(r.counts.total,2);assert.equal(r.counts.review,2);
 assert.equal(r.state,'PARTIAL');
 assert.ok(r.records.every(v=>v.blockers.includes('DUPLICATE_VARIATION_ID')));
 assert.deepEqual(r.writes,[]);assert.equal(r.side_effects,false);
});
