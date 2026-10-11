'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {executeAcceptedJob}=require('../processor/accepted-job-execution');
const {createRuntimeApp}=require('../runtime/app');
const quote={quote_id:'Q1',opportunity_id:'O1','Quote Status':'ACCEPTED','Line Control State':'PASS','Project / Scope':'Backup water'};
const opportunity={opportunity_id:'O1',job_id:'',client_crm_id:'CRM1',client_name:'Client'};
function fixture(){
 let written=0;
 const stores={commercial:{findByKey:async(t,k,id)=>t==='Quotes'&&id==='Q1'?{object:quote}:null},crm:{findByKey:async(t,k,id)=>t==='Jobs_Opportunities'&&id==='O1'?{object:opportunity}:null}};
 const writer={stores,execute:async plan=>{written++;return {state:'COMMITTED',plan_id:plan.idempotency_key}}};
 return {writer,count:()=>written};
}
const args={quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'};
const verifier=async a=>({verified:true,quote_id:a.quoteId,job_id:a.jobId,source_event_id:a.sourceEventId,acceptance_evidence:'drive://signed/1',payment_clearance:'CLEARED'});
test('job executor compiles and calls P3 only with server-attested facts',async()=>{
 const f=fixture();const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:verifier});
 assert.equal(r.state,'COMMITTED');assert.equal(f.count(),1);
});
test('caller identity without server attestation cannot write',async()=>{
 const f=fixture();const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:async()=>({verified:false})});
 assert.equal(r.state,'REVIEW_REQUIRED');assert.equal(f.count(),0);
});
test('proof received is never payment clearance',async()=>{
 const f=fixture();const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:async a=>({...await verifier(a),payment_clearance:'PROOF_RECEIVED'})});
 assert.equal(r.state,'REVIEW_REQUIRED');assert.equal(f.count(),0);
});
test('dry run does not mutate CRM or execution',async()=>{
 const f=fixture();const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:verifier,dryRun:true});
 assert.equal(r.state,'DRY_RUN');assert.equal(f.count(),0);
});
test('HTTP job creation enforces separate token, attestation and canonical writer',async()=>{
 const f=fixture();const app=createRuntimeApp({token:'runtime',jobCreationToken:'job-token',jobAuthorityVerifier:verifier,writerFactory:()=>f.writer});
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const post=async(token,body)=>fetch(base+'/v1/governance/create-job',{method:'POST',headers:{'content-type':'application/json',...(token?{'x-magos-job-token':token}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await post(null,args)).status,401);
  assert.equal((await post('job-token',{quoteId:'Q1'})).status,400);
  const r=await post('job-token',args);assert.equal(r.status,200);assert.equal((await r.json()).state,'COMMITTED');assert.equal(f.count(),1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
