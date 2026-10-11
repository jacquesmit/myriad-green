'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessLiveSupplierProcurement } = require('../processor/live-supplier-procurement');
const supplier={supplier_id:'SUP-AQUADAM-GAUTENG',supplier_approval_state:'APPROVED',active_status:'ACTIVE'};
const quote={supplier_quote_id:'SQT-1',supplier_id:supplier.supplier_id};
function lookup(s=supplier,q=quote) {
 return {
  findEntityByCanonicalId:async (kind,id)=>kind==='Supplier'&&s?.supplier_id===id?s:null,
  store:()=>({findByKey:async (_,field,id)=>field==='supplier_quote_id'&&q?.supplier_quote_id===id?{object:q}:null})
 };
}
test('reads approved supplier from canonical store, not caller authority',async()=>{
 const result=await assessLiveSupplierProcurement({lookupService:lookup(),supplierId:supplier.supplier_id,supplierQuoteId:quote.supplier_quote_id,quoteReviewed:true,procurementAuthorized:true});
 assert.equal(result.release.action_state,'ALLOWED');
 assert.equal(result.authoritative_lookup,true);
 assert.equal(result.verified_supplier_id,supplier.supplier_id);
 assert.deepEqual(result.writes,[]);
});
test('live approval revocation blocks even when quote and authorization are supplied',async()=>{
 const result=await assessLiveSupplierProcurement({lookupService:lookup({...supplier,supplier_approval_state:'SUSPENDED'}),supplierId:supplier.supplier_id,supplierQuoteId:quote.supplier_quote_id,quoteReviewed:true,procurementAuthorized:true});
 assert.equal(result.release.action_state,'BLOCKED');
});
test('exact quote belonging to another supplier cannot release',async()=>{
 const result=await assessLiveSupplierProcurement({lookupService:lookup(supplier,{...quote,supplier_id:'SUP-OTHER'}),supplierId:supplier.supplier_id,supplierQuoteId:quote.supplier_quote_id,quoteReviewed:true,procurementAuthorized:true});
 assert.equal(result.release.action_state,'BLOCKED');
});
test('missing authoritative quote does not fabricate quote review',async()=>{
 const result=await assessLiveSupplierProcurement({lookupService:lookup(supplier,null),supplierId:supplier.supplier_id,supplierQuoteId:quote.supplier_quote_id,quoteReviewed:true,procurementAuthorized:true});
 assert.equal(result.release.action_state,'REVIEW_REQUIRED');
 assert.equal(result.verified_supplier_quote_id,'');
});
test('requires an authoritative lookup service',async()=>{
 await assert.rejects(assessLiveSupplierProcurement({supplierId:supplier.supplier_id,supplierQuoteId:quote.supplier_quote_id}),/AUTHORITATIVE_LOOKUP_REQUIRED/);
});
