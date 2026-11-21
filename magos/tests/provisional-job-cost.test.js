'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {captureProvisionalJobCost,provisionalId,positiveCents}=require('../processor/provisional-job-cost');
const {createRuntimeApp}=require('../runtime/app');
const jobId='JOB-TEST-1',eventId='OWNER-EXPENSE-001';
const job={job_id:jobId,opportunity_id:'OPP-1',client_name:'Test Client'};
const execution={'Job ID':jobId,opportunity_id:'OPP-1',Client:'Test Client'};
function fixture(){
 let writes=0,line,plan;
 const writer={stores:{
  crm:{findByKey:async()=>({object:job})},
  commercial:{findByKey:async(t,k,id)=>{
   if(t==='Job Execution')return {object:execution};
   if(t==='Project Direct Costs'&&line?.direct_cost_id===id)return {object:{...line}};
   return null;
  }}
 },execute:async p=>{writes++;plan=p;line=p.writes[0].values;return {state:'COMMITTED'};}};
 return {writer,count:()=>writes,plan:()=>plan,line:()=>line};
}
const owner=async({job_id,source_event_id})=>({
 verified:true,job_id,source_event_id,authorized_owner_id:'TEST-OWNER'
});
const args={jobId,sourceEventId:eventId,category:'MATERIALS',
 description:'Job fittings collected',amountZar:'199.50',ownerAttestation:owner};
test('provisional costs write exact job id and never claim independently verified money',async()=>{
 const f=fixture();
 const r=await captureProvisionalJobCost({writer:f.writer,...args});
 assert.equal(r.state,'COMMITTED');
 assert.equal(r.amount_zar,199.5);
 assert.equal(r.verified_cost,false);
 assert.equal(f.count(),1);
 const line=f.line();
 assert.equal(line.financial_treatment,'PROVISIONAL_DIRECT_COST');
 assert.equal(line.evidence_status,'OWNER_CONFIRMED_EVIDENCE_PENDING');
 assert.equal(line.allocation_status,'TO_CONFIRM');
 assert.equal(line.evidence_link,'');
 assert.equal(f.plan().writes[0].entity_type,'Direct Job Cost');
 assert.equal(f.plan().writes[0].authority,'AUTHORITATIVE');
});
test('owner expense source-event identity is stable across retry',()=>{
 assert.equal(provisionalId(jobId,eventId),provisionalId(jobId,eventId));
 assert.notEqual(provisionalId(jobId,eventId),provisionalId(jobId,'SECOND'));
});
test('dry-run creates no expense',async()=>{
 const f=fixture();
 const r=await captureProvisionalJobCost({writer:f.writer,...args,dryRun:true});
 assert.equal(r.state,'DRY_RUN');
 assert.equal(f.count(),0);
});
test('invalid amount, scope, category and forged owner evidence fail before write',async()=>{
 const inputs=[
  {...args,amountZar:'-10'},
  {...args,amountZar:'1.456'},
  {...args,amountZar:'0'},
  {...args,amountZar:'1e8'},
  {...args,category:'CLIENT_REVENUE'},
  {...args,jobId:'OTHER'},
  {...args,ownerAttestation:async()=>({verified:false})},
  {...args,description:''}
 ];
 for(const input of inputs){
  const f=fixture();
  const r=await captureProvisionalJobCost({writer:f.writer,...input});
  assert.equal(r.state,'REVIEW_REQUIRED');
  assert.equal(f.count(),0);
 }
 assert.equal(positiveCents('12.3'),1230);
 assert.equal(positiveCents('12.34'),1234);
});
test('source job identity conflict is blocked',async()=>{
 const f=fixture();
 f.writer.stores.commercial.findByKey=async()=>({object:{...execution,opportunity_id:'OPP-X'}});
 const r=await captureProvisionalJobCost({writer:f.writer,...args});
 assert.equal(r.reason_code,'JOB_EXECUTION_LINK_NOT_VERIFIED');
 assert.equal(f.count(),0);
});
test('operator API requires distinct token, supports preview and records provisional expense',async()=>{
 const f=fixture();
 const app=createRuntimeApp({token:'runtime-token',provisionalCostToken:'owner-cost-token',
  writerFactory:()=>f.writer});
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const endpoint='http://127.0.0.1:'+server.address().port+'/v1/governance/provisional-job-cost';
  const post=async(key,dryRun=true)=>fetch(endpoint,{
   method:'POST',headers:{'content-type':'application/json',
    ...(key?{'x-magos-provisional-cost-token':key}:{})},
   body:JSON.stringify({...args,ownerAttestation:undefined,dryRun})
  });
  assert.equal((await post()).status,401);
  assert.equal((await post('runtime-token')).status,401);
  const preview=await post('owner-cost-token');
  assert.equal(preview.status,200);
  assert.equal((await preview.json()).state,'DRY_RUN');
  assert.equal(f.count(),0);
  const commit=await post('owner-cost-token',false);
  assert.equal(commit.status,200);
  assert.equal((await commit.json()).state,'COMMITTED');
  assert.equal(f.count(),1);
 }finally{await new Promise(done=>server.close(done));}
});
test('unverified provisional cost never inflates closeout evidenced cost totals',async()=>{
 const {inspectJobCloseout}=require('../processor/job-closeout-readiness');
 const line={direct_cost_id:'DP-TEST',job_id:jobId,amount:'199.50',
   financial_treatment:'PROVISIONAL_DIRECT_COST',
   evidence_status:'OWNER_CONFIRMED_EVIDENCE_PENDING',
   evidence_link:'',allocation_status:'TO_CONFIRM'};
 const stores={commercial:{readObjects:async sheet=>({
  'Job Execution':[{'Job ID':jobId,'Completion Status':'HANDOVER_COMPLETE',
   'After Evidence':'test://photos','Completion Sign-off':'test://signoff'}],
  Variations:[],'Project Direct Costs':[line],
  'Project Cost & Margin':[{job_id:jobId,contract_value_inc_vat:'1000',
   final_cost_status:'TO_CONFIRM',labour_cost_status:'TO_CONFIRM'}]
 })[sheet]}};
 const r=await inspectJobCloseout({stores,jobId});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.equal(r.evidenced_cost_sum_zar,0);
 assert.equal(r.provisional_unverified_cost_sum_zar,199.5);
 assert.ok(r.blockers.includes('PROVISIONAL_DIRECT_COST_NOT_FINAL:DP-TEST'));
});
