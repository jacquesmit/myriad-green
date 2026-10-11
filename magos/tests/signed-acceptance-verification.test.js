'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifySignedAcceptance}=require('../processor/signed-acceptance-verification');
const {assessJobActivation}=require('../processor/job-activation-assessment');
const q={quote_id:'Q-1',opportunity_id:'OP-1','Quote Status':'ACCEPTED','Line Control State':'PASS'};
const stores={crm:{findByKey:async()=>({object:{opportunity_id:'OP-1',job_id:''}})},commercial:{
 findByKey:async()=>({object:q}),
 readObjects:async sheet=>sheet==='Payment Control'?[{'Control ID':'PC-1','Opportunity ID':'OP-1','Deposit Required (R)':'100'}]:[{control_id:'PC-1',allocation_id:'PA-1',allocation_type:'DEPOSIT',allocation_state:'CLEARED',amount:'100',evidence_link:'drive://bank'}]
}};
const verifier=async({quote_id,opportunity_id})=>({verified:true,quote_id,opportunity_id,evidence_ref:'drive://signed/1',signer_identity:'Client A',signed_at:'2026-10-11T10:00:00Z',source_event_id:'SIGN-1'});
test('provider attestation resolves exact signed acceptance and immutable provenance',async()=>{
 const r=await verifySignedAcceptance({stores,quoteId:'Q-1',evidenceVerifier:verifier});
 assert.equal(r.state,'SIGNED_ACCEPTANCE_VERIFIED');assert.equal(r.source_event_id,'SIGN-1');assert.deepEqual(r.writes,[]);
});
test('self reported signature without trusted provider verifier cannot pass',async()=>{
 const r=await verifySignedAcceptance({stores,quoteId:'Q-1'});
 assert.equal(r.state,'REVIEW_REQUIRED');
});
test('provider attestation for another quotation must be refused',async()=>{
 const r=await verifySignedAcceptance({stores,quoteId:'Q-1',evidenceVerifier:async()=>({...await verifier({quote_id:'OTHER',opportunity_id:'OP-1'})})});
 assert.equal(r.state,'REVIEW_REQUIRED');
});
test('activation combines canonical cleared funds and provider signature, but never performs a write',async()=>{
 const r=await assessJobActivation({stores,quoteId:'Q-1',evidenceVerifier:verifier});
 assert.equal(r.state,'READY_FOR_GOVERNED_AUTHORIZATION');
 assert.equal(r.checks.signed_acceptance,'VERIFIED');
 assert.equal(r.checks.financial_evidence,'EVIDENCED');
 assert.deepEqual(r.writes,[]);
});

test('operator HTTP returns 202 for unverified acceptance even when the quote and deposit qualify',async()=>{
 const http=require('node:http');
 const {createRuntimeApp}=require('../runtime/app');
 const app=createRuntimeApp({token:'operator-token',writerFactory:()=>({stores})});
 const server=http.createServer(app);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/operator/job-activation/Q-1';
  assert.equal((await fetch(url)).status,401);
  const r=await fetch(url,{headers:{Authorization:'Bearer operator-token'}});
  assert.equal(r.status,202);
  const body=await r.json();
  assert.equal(body.state,'REVIEW_REQUIRED');
  assert.equal(body.checks.signed_acceptance,'NOT_VERIFIED');
 }finally{await new Promise(ok=>server.close(ok));}
});
