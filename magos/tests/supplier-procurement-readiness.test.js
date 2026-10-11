'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assessSupplierProcurement}=require('../processor/supplier-procurement-readiness');
const supplier={supplier_id:'SUP-AQUADAM-GAUTENG',supplier_approval_state:'APPROVED',active_status:'ACTIVE'};
const quote={supplier_id:'SUP-AQUADAM-GAUTENG',supplier_quote_id:'SQ-1'};
test('approved supplier remains approved when quotation review is outstanding',()=>{
 const r=assessSupplierProcurement({supplier,quote});
 assert.equal(r.supplier_approval_state,'APPROVED');
 assert.equal(r.release.action_state,'REVIEW_REQUIRED');
 assert.equal(r.prepare_draft.action_state,'ALLOWED');
 assert.equal(r.request_clarification.action_state,'ALLOWED');
 assert.equal(r.side_effects,false);
});
test('evidenced and authorized procurement is ready for release but not released',()=>{
 const r=assessSupplierProcurement({supplier,quote,quoteReviewed:true,procurementAuthorized:true});
 assert.equal(r.release.action_state,'ALLOWED');
 assert.deepEqual(r.writes,[]);
});
test('excluded and inactive suppliers cannot release purchase orders',()=>{
 for(const patch of [{supplier_approval_state:'EXCLUDED'},{active_status:'INACTIVE'}]){
  const r=assessSupplierProcurement({supplier:{...supplier,...patch},quote,quoteReviewed:true,procurementAuthorized:true});
  assert.equal(r.release.action_state,'BLOCKED');
  assert.equal(r.prepare_draft.action_state,'ALLOWED');
 }
});
test('cross-supplier quotation mismatch prevents procurement release',()=>{
 const r=assessSupplierProcurement({supplier,quote:{...quote,supplier_id:'SUP-OTHER'},quoteReviewed:true,procurementAuthorized:true});
 assert.equal(r.release.action_state,'BLOCKED');
 assert.ok(r.release.blockers.includes('SUPPLIER_QUOTE_ID_MISMATCH'));
});
