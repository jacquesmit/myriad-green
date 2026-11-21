'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareProcurementDraft,prepareProcurementDraftPlan}=require('../processor/procurement-draft-transaction');
const supplier={supplier_id:'SUP-AQUADAM-GAUTENG',supplier_name:'Aquadam',supplier_approval_state:'APPROVED',active_status:'ACTIVE'};
const quote={supplier_quote_id:'SQT-01',supplier_id:supplier.supplier_id};
function deps(s=supplier,q=quote){
 const rows=new Map();
 const lookupService={
   findEntityByCanonicalId:async(t,id)=>t==='Supplier'&&s?.supplier_id===id?s:null,
   store:()=>({findByKey:async(_,k,id)=>q&&q[k]===id?{object:q}:null})
 };
 const writer={execute:async plan=>{
   const id=plan.writes[0].key.value;
   if(rows.has(id))return {state:'DUPLICATE_NO_OP',duplicate:true};
   rows.set(id,plan.writes[0].values);
   return {state:'COMMITTED',audit:{run_state:'COMMITTED'},affected_record_ids:[id]};
 }};
 return {lookupService,writer,rows};
}
const args={supplierId:supplier.supplier_id,supplierQuoteId:quote.supplier_quote_id,poId:'PO-TEST-01',sourceEventId:'TEST-PO-01',evidenceRef:'drive://quote/1',projectId:'JOB-1'};
test('canonical supplier and quote create unreleased draft through P3 with duplicate no-op',async()=>{
 const d=deps();
 const first=await prepareProcurementDraft({...d,...args});
 assert.equal(first.state,'COMMITTED');
 const row=d.rows.get(args.poId);
 assert.equal(row.order_status,'DRAFT');
 assert.equal(row.payment_status,'NOT_PAID');
 assert.equal(row.approved_by,'');
 const second=await prepareProcurementDraft({...d,...args});
 assert.equal(second.state,'DUPLICATE_NO_OP');
 assert.equal(d.rows.size,1);
});
test('dry run has no writes',async()=>{
 const d=deps();
 const result=await prepareProcurementDraft({...d,...args,dryRun:true});
 assert.equal(result.state,'DRY_RUN');
 assert.equal(d.rows.size,0);
 assert.equal(result.plan.writes[0].authority,'AUTHORITATIVE');
});
test('supplier identity conflict blocks P3 execution',async()=>{
 const d=deps({...supplier,supplier_approval_state:'EXCLUDED'});
 const result=await prepareProcurementDraft({...d,...args});
 assert.equal(result.state,'BLOCKED');
 assert.equal(d.rows.size,0);
});
test('missing authoritative quote requires review and does not write',async()=>{
 const d=deps(supplier,null);
 const result=await prepareProcurementDraft({...d,...args});
 assert.equal(result.state,'REVIEW_REQUIRED');
 assert.equal(d.rows.size,0);
});
test('quote supplier mismatch blocks and does not write',async()=>{
 const d=deps(supplier,{...quote,supplier_id:'SUP-OTHER'});
 const result=await prepareProcurementDraft({...d,...args});
 assert.equal(result.state,'BLOCKED');
 assert.equal(d.rows.size,0);
});
test('cannot create a draft without project link or evidence',()=>{
 assert.throws(()=>prepareProcurementDraftPlan({supplier,quote,poId:'P',sourceEventId:'E',evidenceRef:'X'}),/PROJECT_LINK_REQUIRED/);
 assert.throws(()=>prepareProcurementDraftPlan({supplier,quote,poId:'P',sourceEventId:'E',projectId:'JOB'}),/EVIDENCE_REF_REQUIRED/);
});
