'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createRuntimeApp}=require('../runtime/app');

function fixture(){
 let writes=0;
 const supplier={supplier_id:'SUP-T1',supplier_name:'Supplier Test',supplier_approval_state:'APPROVED',active_status:'ACTIVE'};
 const quote={supplier_quote_id:'SQ-T1',supplier_id:'SUP-T1'};
 const lookup={
  findEntityByCanonicalId:async(type,id)=>type==='Supplier'&&id==='SUP-T1'?supplier:null,
  store:()=>({findByKey:async(tab,key,id)=>tab==='Supplier_Quotes'&&id==='SQ-T1'?{object:quote}:null})
 };
 const writer={execute:async()=>{writes++;return {state:'COMMITTED'}}};
 return {lookup,writer,count:()=>writes};
}
const b={supplierId:'SUP-T1',supplierQuoteId:'SQ-T1',poId:'PO-T1',
 sourceEventId:'TEST-E1',evidenceRef:'test:evidence:1',jobId:'JOB-T1'};
test('procurement draft endpoint requires separate token and live source IDs',async()=>{
 const f=fixture();
 const app=createRuntimeApp({token:'writer-token',procurementApprovalToken:'procurement-token',
  procurementLookupFactory:()=>f.lookup,writerFactory:()=>f.writer});
 const server=http.createServer(app);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const send=async(token,body)=>fetch(origin+'/v1/governance/procurement-draft',{
   method:'POST',headers:{'content-type':'application/json',
    ...(token?{'x-magos-procurement-token':token}:{})},body:JSON.stringify(body)});
  assert.equal((await send(null,b)).status,401);
  assert.equal((await send('writer-token',b)).status,401);
  assert.equal(f.count(),0);
  const dry=await send('procurement-token',{...b,dryRun:true});
  assert.equal(dry.status,200);
  const planned=await dry.json();
  assert.equal(planned.state,'DRY_RUN');
  assert.equal(planned.plan.writes[0].values.order_status,'DRAFT');
  assert.equal(f.count(),0);
  const result=await send('procurement-token',b);
  assert.equal(result.status,200);
  assert.equal((await result.json()).external_order_sent,false);
  assert.equal(f.count(),1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('no source quote means no procurement draft or writer invocation',async()=>{
 let count=0;
 const app=createRuntimeApp({token:'runtime',procurementApprovalToken:'procurement',
  procurementLookupFactory:()=>({
   findEntityByCanonicalId:async()=>null,store:()=>({findByKey:async()=>null})
  }),writerFactory:()=>({execute:async()=>{count++}})});
 const server=http.createServer(app);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const response=await fetch(origin+'/v1/governance/procurement-draft',{
   method:'POST',headers:{'content-type':'application/json','x-magos-procurement-token':'procurement'},
   body:JSON.stringify(b)});
  assert.equal(response.status,202);
  assert.equal((await response.json()).state,'REVIEW_REQUIRED');
  assert.equal(count,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
