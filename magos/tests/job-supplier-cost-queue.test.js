'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {inspectJobSupplierCostQueue}=require('../processor/job-supplier-cost-queue');
const {createRuntimeApp}=require('../runtime/app');
const jobId='JOB-Q-001',opportunityId='OPP-Q-001';
const job={job_id:jobId,opportunity_id:opportunityId};
const allocation={allocation_id:'ALLOC-Q-001',job_id:jobId,opportunity_id:opportunityId,
 allocation_type:'JOB',verification_status:'VERIFIED',
 reconciliation_status:'FULLY_RECONCILED',
 supplier_document_id:'SQT-REFERENCE',source_line_id:'LINE-Q-1',
 part_id:'VALVE-1',currency:'ZAR',allocated_value_incl_vat:'199.00',
 evidence_link:'DRIVE_EVIDENCE',evidence_drive_file_id:'receipt',
 allocation_basis:'SOURCE_ANNOTATION',provenance:'RECONCILED',
 supersedes_allocation_id:'ALLOC-Q-001',reversal_of_allocation_id:'ALLOC-Q-001'};
const line={source_line_id:'LINE-Q-1',supplier_quote_id:'SQT-REFERENCE',
 canonical_part_id:'VALVE-1',evidence_link:'DRIVE_EVIDENCE'};
function stores(rows=[allocation],jobRow=job){
 return {crm:{findByKey:async()=>({object:jobRow})},
 supplier:{
  readObjects:async()=>rows,
  findByKey:async()=>({object:line})
 }};
}
test('job queue surfaces invalid document and reversal even if row says fully reconciled',async()=>{
 const r=await inspectJobSupplierCostQueue({stores:stores(),jobId});
 assert.equal(r.schema_version,'MAGOS_JOB_SUPPLIER_COST_QUEUE_V1');
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(r.counts.total,1);
 assert.equal(r.counts.review,1);
 assert.ok(r.items[0].blockers.includes('SOURCE_DOCUMENT_DRIVE_LINK_NOT_VALID'));
 assert.ok(r.items[0].blockers.includes('ALLOCATION_REVERSAL_OR_SUPERSESSION_NEEDS_RECONCILIATION'));
 assert.deepEqual(r.writes,[]);
 assert.equal(r.side_effects,false);
});
test('job queue includes allocation missing job id but matching opportunity for remediation',async()=>{
 const a={...allocation,job_id:''};
 const r=await inspectJobSupplierCostQueue({stores:stores([a]),jobId});
 assert.equal(r.counts.total,1);
 assert.ok(r.items[0].blockers.includes('ALLOCATION_JOB_OPPORTUNITY_MISMATCH'));
});
test('another client or opportunity is excluded',async()=>{
 const r=await inspectJobSupplierCostQueue({stores:stores([
  {...allocation,job_id:'JOB-OTHER',opportunity_id:'OPP-OTHER'}
 ]),jobId});
 assert.equal(r.counts.total,0);
 assert.equal(r.state,'NO_SUPPLIER_ALLOCATIONS');
});
test('duplicate allocation identities are reported and not silently treated as verified',async()=>{
 const r=await inspectJobSupplierCostQueue({stores:stores([allocation,allocation]),jobId});
 assert.equal(r.counts.review,2);
 assert.ok(r.items.every(x=>x.blockers.includes('ALLOCATION_ID_MISSING_OR_DUPLICATED')));
});
test('unknown job and source failures block queue',async()=>{
 const invalid=await inspectJobSupplierCostQueue({stores:stores([allocation],{
  job_id:'JOB-OTHER',opportunity_id:opportunityId}),jobId});
 assert.equal(invalid.state,'REVIEW_REQUIRED');
 assert.ok(invalid.blockers.includes('CANONICAL_JOB_OR_ALLOCATION_INDEX_UNVERIFIED'));
});
test('queue operator route is authenticated and does not run any writer',async()=>{
 let writes=0;
 const app=createRuntimeApp({token:'runtime-secret',operatorReadToken:'operator-secret',
  writerFactory:()=>({stores:stores(),execute:async()=>{writes++;throw Error('WRITE_FORBIDDEN')}})});
 const server=http.createServer(app);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const url='http://127.0.0.1:'+server.address().port+
    '/v1/operator/job-supplier-cost-queue/'+jobId;
  assert.equal((await fetch(url)).status,401);
  const response=await fetch(url,{headers:{'X-MAGOS-Operator-Token':'operator-secret'}});
  assert.equal(response.status,202);
  const body=await response.json();
  assert.equal(body.counts.review,1);
  assert.equal(writes,0);
 }finally{await new Promise(ok=>server.close(ok));}
});
