'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isCanonicalCustomerRfq}=require('../processor/customer-rfq-provenance');
const customer={
 intake_id:'INT-20260727-GMAIL-0008',source_system:'GMAIL',source_type:'RFQ',
 source_event_id:'19fa3fbae42b348e',match_status:'NEW_RECORD',
 matched_crm_id:'CRM-2026-01348',
 matched_opportunity_id:'OPP-20260727-JEREMY-FILTRATION-01',
 processing_status:'LINKED',supplier_id:'',business_document_type:''
};
test('live-schema customer RFQ with canonical CRM/opportunity evidence is valid inbound',()=>{
 assert.equal(isCanonicalCustomerRfq(customer),true);
});
test('supplier RFQ and arbitrary unlinked RFQs never become client enquiries',()=>{
 for(const invalid of [
  {supplier_id:'SUP-1'},
  {business_document_type:'SUPPLIER_QUOTE'},
  {processing_status:'NEW'},
  {match_status:'SELF_TEST'},
  {matched_crm_id:''},
  {matched_opportunity_id:''},
  {source_event_id:''},
  {source_system:'UNKNOWN'},
  {record_origin:'SCRAPER'},
  {lead_direction:'OUTBOUND'},
  {source_category:'SUPPLIER'},
 ]){
  assert.equal(isCanonicalCustomerRfq({...customer,...invalid}),false,JSON.stringify(invalid));
 }
 assert.equal(isCanonicalCustomerRfq({source_system:'GMAIL',source_type:'RFQ'}),false);
});
