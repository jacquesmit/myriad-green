'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {executeAcceptedJob}=require('../processor/accepted-job-execution');
const {createRuntimeApp}=require('../runtime/app');
const quote={quote_id:'Q1',opportunity_id:'O1','Quote Status':'ACCEPTED','Line Control State':'PASS','Project / Scope':'Backup water'};
const opportunity={opportunity_id:'O1',job_id:'',client_crm_id:'CRM1',client_name:'Client'};
function fixture(){
 let written=0,executed=false,lastPlan;
 const evidence='https://drive.google.com/file/d/SAFE_PAYMENT_EVENT_001/view';
 const control={'Control ID':'CTRL-1','Opportunity ID':'O1','Deposit Required (R)':'100'};
 const allocation={control_id:'CTRL-1',allocation_id:'ALLOC-1',payment_event_id:'PAYEVT-1',
  allocation_type:'DEPOSIT',allocation_state:'CLEARED',amount:'100',evidence_link:evidence};
 const event={payment_event_id:'PAYEVT-1',control_id:'CTRL-1',opportunity_id:'O1',
  event_type:'PAYMENT_CLEARED',clearance_state:'CLEARED',amount:'100',evidence_link:evidence,
  idempotency_key:'BANK-1',source_system:'TEST_BANK_SOURCE'};
 const records={'Job Execution':[],'Payment Control':[control],
  'Payment_Allocations':[allocation],'Payment_Events':[event]};
 const stores={commercial:{readObjects:async sheet=>records[sheet]||[],
  findByKey:async(t,k,id)=>t==='Quotes'&&id==='Q1'?{object:quote}:t==='Job Execution'&&executed&&id==='EXEC-1'?{object:{'Execution ID':'EXEC-1','Job ID':'JOB-1',opportunity_id:'O1',quote_id:'Q1'}}:null},
  crm:{findByKey:async(t,k,id)=>t==='Jobs_Opportunities'&&id==='O1'?{object:{...opportunity,job_id:executed?'JOB-1':''}}:null}};
 const writer={stores,execute:async plan=>{written++;lastPlan=plan;executed=true;return {state:'COMMITTED',plan_id:plan.idempotency_key}}};
 return {writer,count:()=>written,plan:()=>lastPlan,records};
}
const args={quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'};
const verifier=async a=>({verified:true,quote_id:a.quoteId,job_id:a.jobId,
 opportunity_id:'O1',source_event_id:a.sourceEventId,
 acceptance_evidence:'drive://signed/1',payment_clearance:'CLEARED',
 payment_control_id:'CTRL-1',allocation_ids:['ALLOC-1'],payment_event_ids:['PAYEVT-1'],
 bank_clearance_confirmation_id:'PROVIDER-CONF-1',bank_confirmation_source:'BANK'});
test('job executor compiles and calls P3 only with server-attested facts',async()=>{
 const f=fixture();const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:verifier});
 assert.equal(r.state,'COMMITTED');assert.equal(f.count(),1);
 assert.ok(f.plan().preconditions.some(p=>p.sheet==='Payment_Allocations'&&p.expect.allocation_state==='CLEARED'));
 assert.ok(f.plan().preconditions.some(p=>p.sheet==='Payment_Events'&&p.expect.clearance_state==='CLEARED'));
 assert.ok(f.plan().preconditions.some(p=>p.sheet==='Payment Control'&&p.expect['Deposit Required (R)']==='100'));
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

test('recorded payment status changed before job commit fails closed',async()=>{
 const f=fixture();
 f.records.Payment_Allocations[0].allocation_state='REVERSED';
 const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:verifier});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(f.count(),0);
});
test('attested payment reference mismatch blocks new job without writer execution',async()=>{
 const f=fixture();
 const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:async a=>({
   ...await verifier(a),payment_event_ids:['UNRELATED-EVENT']
 })});
 assert.equal(r.state,'REVIEW_REQUIRED');assert.equal(r.reason_code,'ATTESTED_BANK_EVENT_SET_CHANGED');
 assert.equal(f.count(),0);
});
test('no independent bank receipt binding cannot release job through injectable HTTP authority',async()=>{
 const f=fixture();
 const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:async a=>({
   ...await verifier(a),bank_clearance_confirmation_id:''
 })});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(r.reason_code,'INDEPENDENT_BANK_AUTHORITY_BINDING_INCOMPLETE');
 assert.equal(f.count(),0);
});
test('snapshot includes all finance read/write CAS expectations without modifying actual rows',async()=>{
 const f=fixture();
 const before=JSON.stringify(f.records);
 const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:verifier,dryRun:true});
 assert.equal(r.state,'DRY_RUN');
 assert.equal(f.count(),0);
 assert.equal(JSON.stringify(f.records),before);
 assert.equal(r.plan.preconditions.filter(p=>p.store==='commercial'&&p.sheet.startsWith('Payment')).length,3);
});

test('bank attestation for a different opportunity cannot produce a job P3 write',async()=>{
 const f=fixture();
 const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:async a=>({
  ...await verifier(a),opportunity_id:'O-OTHER'
 })});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(r.reason_code,'ATTESTED_OPPORTUNITY_MISMATCH');
 assert.equal(f.count(),0);
});
test('P3 writer sees changed bank event and rejects commit through compare-and-swap',async()=>{
 const f=fixture();
 const original=f.writer.execute;
 f.writer.execute=async plan=>{
   f.records.Payment_Events[0].clearance_state='REVERSED';
   const status=plan.preconditions.find(p=>p.sheet==='Payment_Events');
   assert.equal(status.expect.clearance_state,'CLEARED');
   if(f.records.Payment_Events[0].clearance_state!==status.expect.clearance_state)
      return {state:'RETRY_REQUIRED',reason_code:'PRECONDITION_MISMATCH'};
   return original(plan);
 };
 const r=await executeAcceptedJob({...args,writer:f.writer,authorityVerifier:verifier});
 assert.equal(r.state,'RETRY_REQUIRED');
 assert.equal(f.count(),0);
});
