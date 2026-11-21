'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {inspectSupplierAllocation,makeSupplierCostEvidenceVerifier}=require('../processor/supplier-cost-evidence');
const {createRuntimeApp}=require('../runtime/app');
const id='ALLOC-TEST-001',job='JOB-TEST-1',opp='OPP-TEST-1';
const allocation={
 allocation_id:id,allocation_type:'JOB',job_id:job,opportunity_id:opp,
 supplier_document_id:'INVOICE-123',source_line_id:'LINE-123',
 part_id:'PART-123',allocated_qty:'2',allocated_value_incl_vat:'259.99',currency:'ZAR',
 evidence_link:'https://drive.google.com/file/d/receipt-test-123/view',
 evidence_drive_file_id:'receipt-test-123',
 verification_status:'VERIFIED',reconciliation_status:'FULLY_RECONCILED',
 allocation_basis:'EXACT_SUPPLIER_INVOICE',provenance:'SOURCE_DOCUMENT_AND_STOCK_ALLOCATION',
 supersedes_allocation_id:'',reversal_of_allocation_id:''
};
const line={
 source_line_id:'LINE-123',supplier_quote_id:'INVOICE-123',
 canonical_part_id:'PART-123',source_description:'Two repair valves',
 evidence_link:allocation.evidence_link
};
const authority=async()=>({
 verified:true,allocation_id:id,reviewer_id:'FINANCE-REVIEWER',
 source_document_checked:true,receipt_type:'SUPPLIER_INVOICE',
 document_id:'INVOICE-123',reviewed_amount_cents:25999
});
const stock=async()=>({
 verified:true,allocation_id:id,job_id:job,part_id:'PART-123',
 allocated_quantity:2,stock_split_verified:true
});
function stores(rows=[allocation],source=line){
 return {supplier:{
  readObjects:async name=>name==='Cost_Allocations'?rows:[],
  findByKey:async(name,key,value)=>name==='Supplier_Source_Lines'&&
     source?.source_line_id===value?{object:source}:null
 }};
}
const args={stores:stores(),jobId:job,opportunityId:opp,
 sourceEventId:id,reviewAuthority:authority,stockAuthority:stock};
test('approved allocation and exact invoice + physical stock attestation produce verified cost for one job',async()=>{
 const r=await inspectSupplierAllocation(args);
 assert.equal(r.verified,true);
 assert.equal(r.source_event_id,id);
 assert.equal(r.amount_cents,25999);
 assert.equal(r.evidence_status,'SUPPLIER_INVOICE_EVIDENCED');
 assert.equal(r.cost_category,'MATERIALS');
 assert.equal(r.stock_split_verified,true);
 assert.equal(r.source_authority,'SUPPLIER_COST_ALLOCATION_AND_RECEIPT');
 assert.deepEqual(r.writes,[]);
});
test('existing live contradictory allocation is not approved even if status says fully reconciled',async()=>{
 const broken={...allocation,source_event_id:undefined,
  evidence_link:'DRIVE_EVIDENCE + QUOTE',reversal_of_allocation_id:id,
  supersedes_allocation_id:id};
 const r=await inspectSupplierAllocation({...args,stores:stores([broken],{...line,evidence_link:broken.evidence_link})});
 assert.equal(r.verified,false);
 assert.ok(r.blockers.includes('SOURCE_DOCUMENT_DRIVE_LINK_NOT_VALID'));
 assert.ok(r.blockers.includes('ALLOCATION_REVERSAL_OR_SUPERSESSION_NEEDS_RECONCILIATION'));
});
test('partially reconciled allocation with missing job id cannot pass',async()=>{
 const a={...allocation,job_id:'',reconciliation_status:'PARTIALLY_RECONCILED'};
 const r=await inspectSupplierAllocation({...args,stores:stores([a])});
 assert.equal(r.verified,false);
 assert.ok(r.blockers.includes('ALLOCATION_NOT_FULLY_RECONCILED'));
 assert.ok(r.blockers.includes('ALLOCATION_JOB_OPPORTUNITY_MISMATCH'));
});
test('reverse or superseding allocation elsewhere blocks the source',async()=>{
 const r=await inspectSupplierAllocation({...args,
  stores:stores([allocation,{...allocation,allocation_id:'ALLOC-REV',reversal_of_allocation_id:id}])});
 assert.ok(r.blockers.includes('ALLOCATION_HAS_DOWNSTREAM_REVERSAL_OR_SUPERSESSION'));
});
test('duplicate allocation id is never implicitly resolved',async()=>{
 const r=await inspectSupplierAllocation({...args,stores:stores([allocation,allocation])});
 assert.equal(r.verified,false);
 assert.equal(r.reason_code,'ALLOCATION_ID_MISSING_OR_DUPLICATED');
});
test('reviewer and stock attestations must independently bind receipt, cents, part and quantity',async()=>{
 const cases=[
  {reviewAuthority:async()=>({...await authority(),reviewed_amount_cents:26000})},
  {reviewAuthority:async()=>({...await authority(),receipt_type:'SUPPLIER_QUOTE'})},
  {reviewAuthority:async()=>({...await authority(),document_id:'WRONG'})},
  {reviewAuthority:async()=>({verified:true,allocation_id:id})},
  {stockAuthority:async()=>({...await stock(),allocated_quantity:3})},
  {stockAuthority:async()=>({...await stock(),part_id:'OTHER-PART'})},
  {stockAuthority:async()=>({...await stock(),stock_split_verified:false})},
  {reviewAuthority:null},{stockAuthority:null}
 ];
 for(const item of cases){
  const r=await inspectSupplierAllocation({...args,...item});
  assert.equal(r.verified,false);
 }
});
test('no caller-provided proof can substitute for existing canonical allocation',async()=>{
 const v=makeSupplierCostEvidenceVerifier({stores:stores([]),reviewAuthority:authority,stockAuthority:stock});
 const r=await v({job_id:job,opportunity_id:opp,source_event_id:id,
  verified:true,amount_cents:25999});
 assert.equal(r.verified,false);
 assert.ok(r.blockers.includes('ALLOCATION_ID_MISSING_OR_DUPLICATED'));
});
test('operator supplier allocation inspection never writes and requires operator token',async()=>{
 let writes=0;
 const app=createRuntimeApp({
  token:'runtime-test',operatorReadToken:'operator-test',
  supplierCostReviewAuthority:authority,supplierStockSplitAuthority:stock,
  writerFactory:()=>({stores:{...stores(),crm:{},commercial:{}},
    execute:async()=>{writes++;throw Error('UNEXPECTED_WRITE')}})
 });
 const server=http.createServer(app);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try {
  const endpoint='http://127.0.0.1:'+server.address().port+
   '/v1/operator/supplier-cost-allocation/'+id+'?jobId='+job+'&opportunityId='+opp;
  assert.equal((await fetch(endpoint)).status,401);
  const result=await fetch(endpoint,{headers:{'X-MAGOS-Operator-Token':'operator-test'}});
  assert.equal(result.status,200);
  assert.equal((await result.json()).verified,true);
  assert.equal(writes,0);
 }finally{await new Promise(ok=>server.close(ok));}
});
