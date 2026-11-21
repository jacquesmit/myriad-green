'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createRuntimeApp}=require('../runtime/app');
const b={
 supplier_id:'SUP-TEST',from_state:'VETTING',to_state:'APPROVED',
 source_event_id:'SUP-GOV-TEST',actor_id:'UNVERIFIED-CALLER',
 evidence_ref:'test:approval:1',
 guards:{spam:'CLEAR',phishing:'CLEAR',explicit_content:'CLEAR',malware:'CLEAR',irrelevant:'CLEAR'}
};
const post=async(base,body=b,token='supplier-secret')=>fetch(base+'/v1/governance/supplier-approval',{
 method:'POST',
 headers:{'content-type':'application/json','x-magos-supplier-approval-token':token},
 body:JSON.stringify(body)
});
test('supplier governance token alone cannot authorize a business mutation',async()=>{
 let calls=0;
 const app=createRuntimeApp({
  token:'runtime-secret',supplierApprovalToken:'supplier-secret',
  eventDispatcherFactory:()=>({run:async()=>{calls++;return {state:'COMMITTED'};}}),
  writerFactory:()=>({audit:{}})
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  const r=await post(url);
  assert.equal(r.status,202);
  assert.equal((await r.json()).state,'REVIEW_REQUIRED');
  assert.equal(calls,0);
 } finally {await new Promise(done=>server.close(done));}
});
test('server-owned verifier must attest same supplier, transition, provider event and evidence',async()=>{
 let calls=0,received;
 const verified={
  verified:true,supplier_id:b.supplier_id,from_state:b.from_state,
  to_state:b.to_state,source_event_id:b.source_event_id,
  evidence_ref:b.evidence_ref,authorized_actor_id:'OWNER-VERIFIED'
 };
 const app=createRuntimeApp({
  token:'runtime-secret',supplierApprovalToken:'supplier-secret',
  supplierApprovalAuthorityVerifier:async()=>({...verified}),
  writerFactory:()=>({audit:{}}),
  eventDispatcherFactory:()=>({run:async event=>{
   calls++;received=event;return {state:'COMMITTED'};
  }})
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  assert.equal((await post(url,b,'wrong')).status,401);
  const r=await post(url);
  assert.equal(r.status,200);
  assert.equal(calls,1);
  assert.equal(received.actor.id,'OWNER-VERIFIED');
  assert.equal(received.event_type,'SUPPLIER_APPROVAL_CHANGED');
 }finally{await new Promise(done=>server.close(done));}
});
test('cross-supplier attestation cannot authorize caller requested mutation',async()=>{
 let calls=0;
 const app=createRuntimeApp({token:'runtime-secret',supplierApprovalToken:'supplier-secret',
  supplierApprovalAuthorityVerifier:async()=>({verified:true,supplier_id:'OTHER'}),
  writerFactory:()=>({audit:{}}),
  eventDispatcherFactory:()=>({run:async()=>{calls++;return {state:'COMMITTED'};}})
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const r=await post('http://127.0.0.1:'+server.address().port);
  assert.equal(r.status,202);
  assert.equal(calls,0);
 }finally{await new Promise(done=>server.close(done));}
});
