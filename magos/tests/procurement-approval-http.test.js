'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createRuntimeApp } = require('../runtime/app');
function data() {
 const po={po_id:'PO-1',supplier_id:'SUP-1',supplier_quote_id:'SQ-1',job_id:'JOB-1',order_status:'DRAFT',payment_status:'NOT_PAID'};
 const quote={supplier_quote_id:'SQ-1',supplier_id:'SUP-1'};
 const lines=[{po_line_id:'POL-1',po_id:'PO-1',procurement_line_id:'PROC-1',part_id:'PART-1',quantity_ordered:'2',unit_price_ex_vat:'100',line_total_ex_vat:'200',line_total_inc_vat:'230'}];
 const requirements=[{'Procurement ID':'PROC-1','Job ID':'JOB-1',supplier_id:'SUP-1','Procurement Gate':'AUTHORISED',technical_gate:'PASSED','Deposit Status':'CLEARED',boq_line_id:'BOQ-1','Material / Part ID':'PART-1'}];
 const lookup={findEntityByCanonicalId:async()=>({supplier_id:'SUP-1',supplier_approval_state:'APPROVED',active_status:'ACTIVE'}),
 store:name=>name==='supplier'?{
  findByKey:async(sheet,key,id)=>{const row=sheet==='Purchase_Orders'?po:sheet==='Supplier_Quotes'?quote:null;return row?.[key]===id?{object:row}:null;},
  readObjects:async()=>lines
 }:{readObjects:async()=>requirements}};
 return {lookup,po};
}
async function send(app,token,body,url='/v1/governance/procurement-approve') {
 const srv=http.createServer(app);
 await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 try {
  const res=await fetch('http://127.0.0.1:'+srv.address().port+url,{
   method:'POST',headers:{'content-type':'application/json',...(token?{'x-magos-procurement-token':token}:{}),authorization:'Bearer runtime-token'},
   body:JSON.stringify(body)});
  return {status:res.status,body:await res.json()};
 } finally { await new Promise(ok=>srv.close(ok)); }
}
const payload={poId:'PO-1',sourceEventId:'APPROVAL-1',approvalEvidence:'drive://acceptance/1',approverId:'owner'};
test('PO issue approval needs a unique dedicated credential, not runtime token',async()=>{
 const d=data();let called=0;
 const app=createRuntimeApp({token:'runtime-token',procurementLookupFactory:()=>d.lookup,
 writerFactory:()=>({execute:async()=>{called++;return {state:'COMMITTED'};}})});
 assert.equal((await send(app,null,payload)).status,503);
 assert.equal(called,0);
});
test('authorized release approval invokes P3 exactly once and does not dispatch',async()=>{
 const d=data();let called=0;let written;
 const app=createRuntimeApp({token:'runtime-token',procurementApprovalToken:'purchase-token',
 procurementLookupFactory:()=>d.lookup,
 procurementAuthorityVerifier:async b=>({verified:true,po_id:b.poId,source_event_id:b.sourceEventId,evidence_ref:b.evidenceRef,authorized_actor_id:'owner-verified'}),
 writerFactory:()=>({execute:async plan=>{called++;written=plan;return {state:'COMMITTED'};}})});
 assert.equal((await send(app,'wrong',payload)).status,401);
 assert.equal((await send(app,'purchase-token',{})).status,400);
 const result=await send(app,'purchase-token',payload);
 assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(result.body.external_order_sent,false);
 assert.equal(result.body.payment_authorized,false);
 assert.equal(written.writes[0].to_state,'APPROVED_FOR_ISSUE');
 assert.equal(called,1);
});
test('runtime token cannot perform generic Purchase_Orders writes',async()=>{
 let called=0;
 const app=createRuntimeApp({token:'runtime-token',writerFactory:()=>({execute:async()=>{called++;return {state:'COMMITTED'};}})});
 const plan={idempotency_key:'E1',event_type:'TEST',source_event_id:'S1',preconditions:[],writes:[{store:'supplier',sheet:'Purchase_Orders',operation:'STATE_TRANSITION',key:{header:'po_id',value:'PO-1'}}]};
 const srv=http.createServer(app);await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 try{
  const res=await fetch('http://127.0.0.1:'+srv.address().port+'/v1/transactions',{method:'POST',headers:{authorization:'Bearer runtime-token','content-type':'application/json'},body:JSON.stringify(plan)});
  assert.equal(res.status,403);
  assert.equal(called,0);
 } finally {await new Promise(ok=>srv.close(ok));}
});
test('an unapproved supplier returns review with no writer mutation',async()=>{
 const d=data();d.lookup.findEntityByCanonicalId=async()=>({supplier_id:'SUP-1',supplier_approval_state:'VETTING',active_status:'ACTIVE'});
 let called=0;
 const app=createRuntimeApp({token:'runtime-token',procurementApprovalToken:'purchase-token',procurementLookupFactory:()=>d.lookup,procurementAuthorityVerifier:async b=>({verified:true,po_id:b.poId,source_event_id:b.sourceEventId,evidence_ref:b.evidenceRef,authorized_actor_id:'owner-verified'}),writerFactory:()=>({execute:async()=>{called++;return {state:'COMMITTED'};}})});
 const result=await send(app,'purchase-token',payload);
 assert.equal(result.status,202);
 assert.equal(result.body.reason_code,'SUPPLIER_NOT_APPROVED_ACTIVE');
 assert.equal(called,0);
});

test('token and asserted approval evidence alone cannot execute writer',async()=>{
 const d=data();let writes=0;
 const app=createRuntimeApp({token:'runtime-token',procurementApprovalToken:'purchase-token',
   procurementLookupFactory:()=>d.lookup,
   writerFactory:()=>({execute:async()=>{writes++;return {state:'COMMITTED'};}})
 });
 const result=await send(app,'purchase-token',payload);
 assert.equal(result.status,202);
 assert.equal(result.body.reason_code,'APPROVAL_AUTHORITY_NOT_VERIFIED');
 assert.equal(writes,0);
});
test('mismatched trusted authority attestation cannot authorize a different PO',async()=>{
 const d=data();let writes=0;
 const app=createRuntimeApp({token:'runtime-token',procurementApprovalToken:'purchase-token',
   procurementLookupFactory:()=>d.lookup,
   procurementAuthorityVerifier:async()=>({verified:true,po_id:'PO-OTHER',source_event_id:payload.sourceEventId,evidence_ref:payload.approvalEvidence,authorized_actor_id:'owner'}),
   writerFactory:()=>({execute:async()=>{writes++;return {state:'COMMITTED'};}})
 });
 const result=await send(app,'purchase-token',payload);
 assert.equal(result.status,202);
 assert.equal(writes,0);
});
