'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessJobActivation}=require('../processor/job-activation-assessment');
const quote={quote_id:'Q1',opportunity_id:'O1','Quote Status':'ACCEPTED','Line Control State':'PASS'};
const opportunity={opportunity_id:'O1',job_id:'',client_crm_id:'C1'};
function stores(state='CLEARED',accepted=true){
 return {crm:{findByKey:async()=>({object:opportunity})},commercial:{
 findByKey:async()=>({object:{...quote,'Quote Status':accepted?'ACCEPTED':'SENT'}}),
 readObjects:async sheet=>sheet==='Payment Control'?[{'Opportunity ID':'O1','Control ID':'P1','Deposit Required (R)':'100'}]:[{control_id:'P1',allocation_id:'A1',allocation_type:'DEPOSIT',allocation_state:state,evidence_link:'drive://bank',amount:'100'}]
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
