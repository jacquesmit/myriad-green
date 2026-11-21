'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {inspectDepositEvidence}=require('../processor/deposit-evidence-inspection');
const {createRuntimeApp}=require('../runtime/app');
function stores(state='CLEARED',amount='800',required='800'){
 const control={'Control ID':'PAY1','Opportunity ID':'OP1','Deposit Required (R)':required,
  'Deposit Status':'CLEARED',deposit_id:'DEP1'};
 const allocation={control_id:'PAY1',allocation_id:'ALLOC1',payment_event_id:'EV1',
  deposit_id:'DEP1',allocation_type:'DEPOSIT',allocation_state:state,
  amount,evidence_link:'https://drive.google.com/file/d/BANKTESTEVIDENCE001/view'};
 const event={payment_event_id:'EV1',control_id:'PAY1',opportunity_id:'OP1',
  event_type:'PAYMENT_CLEARED',clearance_state:'CLEARED',amount,
  evidence_link:'https://drive.google.com/file/d/BANKTESTEVIDENCE001/view',source_system:'BANK_EVIDENCE_REVIEWED',idempotency_key:'EV1-UNIQUE'};
 return {commercial:{readObjects:async sheet=>({
  'Payment Control':[control],'Payment_Allocations':[allocation],
  'Payment_Events':[event]
 })[sheet]||[]}};
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
  assert.equal(r.status,200);assert.equal((await r.json()).evidence_source,'Payment_Allocations_AND_Payment_Events');
 }finally{await new Promise(done=>server.close(done));}
});

test('duplicate cleared allocation ID cannot inflate a deposit',async()=>{
 const s=stores(),read=s.commercial.readObjects;
 s.commercial.readObjects=async sheet=>{
  const rows=await read(sheet);
  return sheet==='Payment_Allocations'?[...rows,...rows]:rows;
 };
 const r=await inspectDepositEvidence({stores:s,opportunityId:'OP1'});
 assert.equal(r.reason_code,'DUPLICATE_OR_MISSING_CLEARED_ALLOCATION_ID');
});
test('missing or non-cleared bank event cannot release the job',async()=>{
 for(const variation of [null,{clearance_state:'PROOF_RECEIVED'},
   {amount:'799.99'},{opportunity_id:'OP-OTHER'},
   {evidence_link:'https://example.com/bogus'},{event_type:'PAYMENT_PENDING'}]){
  const s=stores(),read=s.commercial.readObjects;
  s.commercial.readObjects=async sheet=>{
   const rows=await read(sheet);
   if(sheet!=='Payment_Events')return rows;
   return variation===null?[]:rows.map(r=>({...r,...variation}));
  };
  const r=await inspectDepositEvidence({stores:s,opportunityId:'OP1'});
  assert.equal(r.state,'REVIEW_REQUIRED');
 }
});
test('payment event may not be counted twice under distinct allocation IDs',async()=>{
 const s=stores(),read=s.commercial.readObjects;
 s.commercial.readObjects=async sheet=>{
  const rows=await read(sheet);
  if(sheet==='Payment_Allocations')return [...rows,{...rows[0],allocation_id:'ALLOC2'}];
  return rows;
 };
 const r=await inspectDepositEvidence({stores:s,opportunityId:'OP1'});
 assert.equal(r.reason_code,'MISSING_OR_REUSED_BANK_CLEARANCE_EVENT');
});
test('zero-deposit requirement is explicitly not reported as bank-cleared funds',async()=>{
 const r=await inspectDepositEvidence({stores:stores('CLEARED','800','0'),opportunityId:'OP1'});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(r.reason_code,'NO_DEPOSIT_REQUIRED_NOT_BANK_CLEARED');
});
test('cleared snapshot without an actual payment event is not independent bank confirmation',async()=>{
 const r=await inspectDepositEvidence({stores:stores(),opportunityId:'OP1'});
 assert.equal(r.state,'CLEARED_ALLOCATION_EVIDENCED');
 assert.equal(r.independent_bank_confirmation,false);
 assert.deepEqual(r.payment_event_ids,['EV1']);
});
