'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessJobActivation}=require('../processor/job-activation-assessment');
const quote={quote_id:'Q1',opportunity_id:'O1','Quote Status':'ACCEPTED','Line Control State':'PASS'};
const opportunity={opportunity_id:'O1',job_id:'',client_crm_id:'C1'};
function stores(state='CLEARED',accepted=true){
 return {crm:{findByKey:async()=>({object:opportunity})},commercial:{
 findByKey:async()=>({object:{...quote,'Quote Status':accepted?'ACCEPTED':'SENT'}}),
 readObjects:async sheet=>({
 'Payment Control':[{'Opportunity ID':'O1','Control ID':'P1','Deposit Required (R)':'100'}],
 'Payment_Allocations':[{control_id:'P1',allocation_id:'A1',payment_event_id:'E1',allocation_type:'DEPOSIT',allocation_state:state,evidence_link:'https://drive.google.com/file/d/BANKTESTEVIDENCE001/view',amount:'100'}],
 'Payment_Events':[{payment_event_id:'E1',control_id:'P1',opportunity_id:'O1',event_type:'PAYMENT_CLEARED',clearance_state:'CLEARED',amount:'100',evidence_link:'https://drive.google.com/file/d/BANKTESTEVIDENCE001/view',idempotency_key:'BANK-E1',source_system:'BANK_CREDIT_REVIEWED'}]
 })[sheet]||[]
 }};
}
test('canonical financial evidence does not replace independently verified signed acceptance',async()=>{
 const r=await assessJobActivation({stores:stores(),quoteId:'Q1'});
 assert.equal(r.checks.canonical_quote,'PASS');
 assert.equal(r.checks.financial_evidence,'EVIDENCED');
 assert.equal(r.checks.signed_acceptance,'NOT_VERIFIED');
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.deepEqual(r.writes,[]);
});
test('LINE_CONTROL_OK quote reaches acceptance and bank evidence checks',async()=>{
 const s=stores();const lookup=s.commercial.findByKey;
 s.commercial.findByKey=async(...args)=>{
  const record=await lookup(...args);
  return record?.object?{object:{...record.object,'Line Control State':'LINE_CONTROL_OK'}}:record;
 };
 const result=await assessJobActivation({stores:s,quoteId:'Q1'});
 assert.equal(result.quote.state,'READY_FOR_EVIDENCE_REVIEW');
 assert.equal(result.deposit.state,'CLEARED_ALLOCATION_EVIDENCED');
 assert.equal(result.state,'REVIEW_REQUIRED');
});
test('uncleared deposit remains blocked from job activation',async()=>{
 const r=await assessJobActivation({stores:stores('PROOF_RECEIVED'),quoteId:'Q1'});
 assert.equal(r.checks.financial_evidence,'REVIEW_REQUIRED');
 assert.equal(r.state,'REVIEW_REQUIRED');
});
test('unaccepted quote blocks job activation before payment lookup',async()=>{
 const r=await assessJobActivation({stores:stores('CLEARED',false),quoteId:'Q1'});
 assert.equal(r.state,'BLOCKED');
 assert.equal(r.deposit,null);
});
