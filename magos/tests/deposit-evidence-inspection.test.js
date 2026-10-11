'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {inspectDepositEvidence}=require('../processor/deposit-evidence-inspection');
const {createRuntimeApp}=require('../runtime/app');
function stores(state='CLEARED',amount='800',required='800'){
 return {commercial:{readObjects:async sheet=>sheet==='Payment Control'?[{'Control ID':'PAY1','Opportunity ID':'OP1','Deposit Required (R)':required,'Deposit Status':'CLEARED'}]:sheet==='Payment_Allocations'?[{control_id:'PAY1',allocation_id:'ALLOC1',allocation_type:'DEPOSIT',allocation_state:state,amount,evidence_link:'drive://bank-confirmed'}]:[]}};
}
test('cleared allocation meets canonical deposit requirement without writing',async()=>{
 const r=await inspectDepositEvidence({stores:stores(),opportunityId:'OP1'});
 assert.equal(r.state,'CLEARED_ALLOCATION_EVIDENCED');
 assert.equal(r.cleared_deposit_total,800);assert.deepEqual(r.writes,[]);
});
test('client payment proof cannot establish bank clearance',async()=>{
 const r=await inspectDepositEvidence({stores:stores('PROOF_RECEIVED'),opportunityId:'OP1'});
 assert.equal(r.state,'REVIEW_REQUIRED');assert.equal(r.cleared_deposit_total,0);
});
test('insufficient and malformed bank allocations are not released',async()=>{
 assert.equal((await inspectDepositEvidence({stores:stores('CLEARED','250'),opportunityId:'OP1'})).state,'REVIEW_REQUIRED');
 assert.equal((await inspectDepositEvidence({stores:stores('CLEARED','invalid'),opportunityId:'OP1'})).reason_code,'INVALID_CLEARED_ALLOCATION');
});
test('operator deposit-evidence endpoint requires authentication and never executes writer',async()=>{
 const app=createRuntimeApp({token:'operator',writerFactory:()=>({stores:stores(),execute:()=>{throw Error('DO_NOT_WRITE')}})});
 const server=http.createServer(app);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try {
  const u='http://127.0.0.1:'+server.address().port+'/v1/operator/deposit-evidence/OP1';
  assert.equal((await fetch(u)).status,401);
  const r=await fetch(u,{headers:{Authorization:'Bearer operator'}});
  assert.equal(r.status,200);assert.equal((await r.json()).evidence_source,'Payment_Allocations');
 }finally{await new Promise(done=>server.close(done));}
});
