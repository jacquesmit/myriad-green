'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planPurchaseOrderIssueApproval}=require('../processor/procurement-issue-approval');
const po={po_id:'PO-1',supplier_id:'SUP-1',supplier_quote_id:'SQ-1',job_id:'JOB-1',order_status:'DRAFT',payment_status:'NOT_PAID'};
const supplier={supplier_id:'SUP-1',supplier_approval_state:'APPROVED',active_status:'ACTIVE'};
const quote={supplier_quote_id:'SQ-1',supplier_id:'SUP-1'};
const line={po_line_id:'POL-1',po_id:'PO-1',procurement_line_id:'PROC-1',part_id:'PART-1',quantity_ordered:'2',unit_price_ex_vat:'100',line_total_ex_vat:'200',line_total_inc_vat:'230'};
const procurement={'Procurement ID':'PROC-1','Job ID':'JOB-1',supplier_id:'SUP-1','Procurement Gate':'AUTHORISED',technical_gate:'PASSED','Deposit Status':'CLEARED',boq_line_id:'BOQ-1','Material / Part ID':'PART-1'};
const args={poId:'PO-1',sourceEventId:'EV-1',approvalEvidence:'drive://approval/1',approverId:'owner-1'};
function fixture({p=po,s=supplier,q=quote,lines=[line],requirements=[procurement]}={}){
 return {store:(which)=>which==='supplier'?{
  findByKey:async(tab,key,id)=>({Purchase_Orders:p,Supplier_Quotes:q}[tab]?.[key]===id?{object:{Purchase_Orders:p,Supplier_Quotes:q}[tab]}:null),
  readObjects:async()=>lines
 }:{readObjects:async()=>requirements},
 findEntityByCanonicalId:async()=>s};
}
test('complete canonical PO creates governed P3 approval plan, never dispatches or clears payment',async()=>{
 const r=await planPurchaseOrderIssueApproval({lookupService:fixture(),...args});
 assert.equal(r.state,'READY_FOR_APPROVAL');
 assert.equal(r.computed_total_inc_vat,230);
 assert.equal(r.plan.writes[0].operation,'STATE_TRANSITION');
 assert.equal(r.plan.writes[0].to_state,'APPROVED_FOR_ISSUE');
 assert.equal(r.external_order_sent,false);
 assert.equal(r.payment_authorized,false);
});
for(const [name,change,reason] of [
 ['unapproved supplier',{s:{...supplier,supplier_approval_state:'VETTING'}},'SUPPLIER_NOT_APPROVED_ACTIVE'],
 ['missing lines',{lines:[]},'PURCHASE_ORDER_LINES_MISSING'],
 ['uncleared deposit',{requirements:[{...procurement,'Deposit Status':'PROOF_RECEIVED'}]},'DEPOSIT_NOT_CLEARED'],
 ['wrong job',{requirements:[{...procurement,'Job ID':'JOB-OTHER'}]},'PROCUREMENT_JOB_OR_SUPPLIER_MISMATCH'],
 ['wrong part',{lines:[{...line,part_id:'PART-OTHER'}]},'BOQ_PART_LINK_NOT_VERIFIED'],
 ['missing procurement key',{lines:[{...line,procurement_line_id:''}]},'PROCUREMENT_LINE_NOT_EXACT'],
 ['bad totals',{lines:[{...line,line_total_ex_vat:'90'}]},'PO_LINE_TOTALS_NOT_VERIFIED'],
 ['already issued',{p:{...po,order_status:'ISSUED'}},'PO_NOT_DRAFT']
])test(name+' fails closed without writes',async()=>{
 const r=await planPurchaseOrderIssueApproval({lookupService:fixture(change),...args});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(r.reason_code,reason);
 assert.deepEqual(r.writes,[]);
});
