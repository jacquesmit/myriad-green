'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reconcileInvoice,inspectInvoiceReceivable}=require('../processor/receivables-reconciliation');
const invoice={
 invoice_id:'INV-1',job_id:'JOB-1',opportunity_id:'OPP-1',
 'Amount (R)':'R 1,200.00','Invoice Document Status':'ISSUED',
 'Line Control State':'LINE_CONTROL_OK','Amount Paid (R)':'1200','Balance (R)':'0'
};
const line={invoice_line_id:'IL-1',invoice_id:'INV-1',line_status:'CURRENT',
 total_inc_vat:'R 1,200.00',source_evidence:'test://line'};
const allocation={allocation_id:'ALLOC-1',invoice_id:'INV-1',payment_event_id:'PAY-1',
 amount:'1200',allocation_state:'CLEARED',evidence_link:'test://bank'};
const inspect=(i=invoice,l=[line],a=[allocation])=>reconcileInvoice({invoice:i,lines:l,allocations:a});
test('canonical cleared allocations reconcile without asserting independent bank confirmation',()=>{
 const result=inspect();
 assert.equal(result.state,'RECORDED_CLEARED_BALANCE_ZERO');
 assert.equal(result.recorded_balance_zar,0);
 assert.equal(result.independent_bank_confirmation,false);
 assert.equal(result.financial_close_authorized,false);
 assert.deepEqual(result.writes,[]);
});
test('proof received is not cleared payment',()=>{
 const result=inspect(invoice,[line],[{...allocation,allocation_state:'PROOF_RECEIVED'}]);
 assert.equal(result.state,'RECEIVABLE_OUTSTANDING');
 assert.equal(result.recorded_balance_zar,1200);
 assert.equal(result.unverified_allocations_zar,1200);
});
test('invoice line mismatch cannot reconcile silently',()=>{
 const result=inspect(invoice,[{...line,total_inc_vat:'1199'}]);
 assert.equal(result.state,'REVIEW_REQUIRED');
 assert.ok(result.issues.includes('INVOICE_LINE_TOTAL_MISMATCH'));
});
test('missing allocation evidence and duplicate allocation are blocked',()=>{
 const r=inspect(invoice,[line],[{...allocation,evidence_link:''},allocation]);
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.ok(r.issues.some(x=>x.startsWith('CLEARED_ALLOCATION_EVIDENCE_MISSING')));
 assert.ok(r.issues.includes('DUPLICATE_OR_MISSING_ALLOCATION_ID'));
});
test('overallocated invoice is flagged instead of marking paid',()=>{
 const r=inspect(invoice,[line],[{...allocation,amount:'1300'}]);
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.ok(r.issues.includes('ALLOCATION_EXCEEDS_INVOICE_AMOUNT'));
});
test('unissued document and missing current lines require review',()=>{
 const r=inspect({...invoice,'Invoice Document Status':'DRAFT'},[]);
 assert.ok(r.issues.includes('INVOICE_NOT_ISSUED'));
 assert.ok(r.issues.includes('ACTIVE_INVOICE_LINES_MISSING'));
});
test('duplicate invoice headers fail closed on source inspection',async()=>{
 const commercial={readObjects:async tab=>({
  Invoices:[invoice,invoice],Invoice_Lines:[line],Payment_Allocations:[allocation]
 })[tab]};
 const r=await inspectInvoiceReceivable({stores:{commercial},invoiceId:'INV-1'});
 assert.ok(r.issues.includes('INVOICE_ID_NOT_UNIQUE'));
});
