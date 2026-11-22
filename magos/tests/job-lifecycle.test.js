'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {inspectJobLifecycle}=require('../processor/job-lifecycle');
const {createRuntimeApp}=require('../runtime/app');

const quote={quote_id:'Q-T',opportunity_id:'OPP-T','Quote Status':'ACCEPTED',
 'Line Control State':'LINE_CONTROL_OK','Project / Scope':'Verified irrigation repair'};
const job={job_id:'JOB-T',opportunity_id:'OPP-T',client_crm_id:'CRM-T',
 property_id:'PROP-T',site_address:'Pretoria',job_status:'JOB_CREATED'};
const execution={'Execution ID':'EXEC-T','Job ID':'JOB-T','CRM ID':'CRM-T',
 opportunity_id:'OPP-T',quote_id:'Q-T','Accepted Scope':'Verified irrigation repair',
 'Job Status':'JOB_CREATED','Completion Status':'NOT_STARTED','Site Address':'Pretoria',
 'Deposit Cleared':'CLEARED','Crew / Owner':'CREW-T','Materials Ready':'NOT_REQUIRED'};
const payment={
 control:{'Control ID':'CONTROL-T','Opportunity ID':'OPP-T','Deposit Required (R)':'100'},
 allocation:{control_id:'CONTROL-T',allocation_id:'ALLOC-T',payment_event_id:'PAY-T',
  allocation_type:'DEPOSIT',allocation_state:'CLEARED',amount:'100',
  evidence_link:'https://drive.google.com/file/d/BANKRECEIPT001/view'},
 event:{payment_event_id:'PAY-T',control_id:'CONTROL-T',opportunity_id:'OPP-T',
  event_type:'PAYMENT_CLEARED',clearance_state:'CLEARED',amount:'100',
  evidence_link:'https://drive.google.com/file/d/BANKRECEIPT001/view',
  idempotency_key:'BANK-T',source_system:'BANK_REVIEWED'}
};
function fixture({jobRow=job,executionRow=execution,quoteRow=quote}={}){
 const sheets={
  Jobs_Opportunities:[jobRow],'Job Execution':[executionRow],
  'Payment Control':[payment.control],Payment_Allocations:[payment.allocation],
  Payment_Events:[payment.event],Procurement:[],Bookings:[],Installed_Parts:[],
  Variations:[],'Project Direct Costs':[],'Project Cost & Margin':[],
  Invoices:[],Invoice_Lines:[]
 };
 const readObjects=async name=>sheets[name]||[];
 return {
  crm:{readObjects},
  commercial:{readObjects,findByKey:async(name,key,id)=>name==='Quotes'&&quoteRow[key]===id?{object:quoteRow}:null},
  supplier:{readObjects}
 };
}
test('one job report binds accepted quote, canonical job and finance without claiming bank or scheduling authority',async()=>{
 const report=await inspectJobLifecycle({stores:fixture(),jobId:'JOB-T',asOf:'2026-11-22'});
 assert.equal(report.schema_version,'MAGOS_JOB_LIFECYCLE_V1');
 assert.equal(report.job_id,'JOB-T');
 assert.equal(report.stages.find(s=>s.name==='ACCEPTED_QUOTE').state,'PASS');
 assert.equal(report.stages.find(s=>s.name==='CANONICAL_JOB').state,'PASS');
 assert.equal(report.stages.find(s=>s.name==='RECORDED_DEPOSIT').state,'EVIDENCED_ONLY');
 assert.equal(report.stages.find(s=>s.name==='CLIENT_SIGNED_ACCEPTANCE').state,'REVIEW_REQUIRED');
 assert.equal(report.client_acceptance.state,'REVIEW_REQUIRED');
 assert.equal(report.client_acceptance.evidence_verified,false);
 assert.equal(report.client_acceptance.quote_version_verified,false);
 assert.ok(report.blockers.some(x=>x.startsWith('CLIENT_SIGNED_ACCEPTANCE:')));
 assert.equal(report.deposit.independent_bank_confirmation,false);
 assert.equal(report.production_complete,false);
 assert.equal(report.booking_authorized,false);
 assert.equal(report.phase,'DELIVERY');
 assert.deepEqual(report.writes,[]);
});
test('wrong client and opportunity join blocks before downstream workflow',async()=>{
 for(const mutated of [
   {executionRow:{...execution,'CRM ID':'WRONG'}},
   {executionRow:{...execution,opportunity_id:'OTHER'}}
 ]){
  const report=await inspectJobLifecycle({stores:fixture(mutated),jobId:'JOB-T'});
  assert.equal(report.state,'REVIEW_REQUIRED');
  assert.deepEqual(report.stages,[]);
  assert.ok(report.blockers.includes('CANONICAL_OPPORTUNITY_QUOTE_CLIENT_LINK_MISMATCH'));
 }
});
test('altered accepted scope remains actionable review, not accepted job success',async()=>{
 const report=await inspectJobLifecycle({stores:fixture({
  executionRow:{...execution,'Accepted Scope':'DIFFERENT WORK'}
 }),jobId:'JOB-T',asOf:'2026-11-22'});
 assert.equal(report.stages.find(s=>s.name==='ACCEPTED_QUOTE').state,'REVIEW_REQUIRED');
 assert.ok(report.blockers.some(x=>x.startsWith('ACCEPTED_QUOTE:')));
});
test('completed job is routed to operational closure instead of new scheduling',async()=>{
 const report=await inspectJobLifecycle({stores:fixture({
  jobRow:{...job,job_status:'JOB_COMPLETED'},
  executionRow:{...execution,'Completion Status':'HANDOVER_COMPLETE','Job Status':'COMPLETED'}
 }),jobId:'JOB-T',asOf:'2026-11-22'});
 assert.equal(report.phase,'CLOSEOUT');
 assert.ok(report.stages.some(s=>s.name==='CLOSEOUT'));
 assert.equal(report.job_close_authorized,false);
 assert.ok(!report.stages.some(s=>s.name==='SCHEDULING'));
});
test('HTTP operator lifecycle endpoint is authenticated and never calls writer.execute',async()=>{
 let writes=0;
 const app=createRuntimeApp({token:'runtime-secret',operatorReadToken:'operator-secret',
  writerFactory:()=>({stores:fixture(),execute:async()=>{writes++;throw Error('MUST_NOT_WRITE')}})
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/operator/job-lifecycle/JOB-T';
  assert.equal((await fetch(url)).status,401);
  const response=await fetch(url,{headers:{'X-MAGOS-Operator-Token':'operator-secret'}});
  assert.equal(response.status,202);
  const data=await response.json();
  assert.equal(data.job_id,'JOB-T');
  assert.equal(data.production_complete,false);
  assert.equal(writes,0);
 }finally{await new Promise(done=>server.close(done));}
});

test('trusted signed acceptance is separately evidenced but does not automatically release job or certify quote version',async()=>{
 const signature=async({quote_id,opportunity_id})=>({
  verified:true,quote_id,opportunity_id,
  evidence_ref:'drive://signed/quote-T',
  signer_identity:'Test signer',signed_at:'2026-11-22T08:00:00Z',
  source_event_id:'SIGNATURE-EVENT-T'
 });
 const r=await inspectJobLifecycle({stores:fixture(),jobId:'JOB-T',
  asOf:'2026-11-22',evidenceVerifier:signature});
 assert.equal(r.stages.find(x=>x.name==='ACCEPTED_QUOTE').state,'PASS');
 assert.equal(r.stages.find(x=>x.name==='CLIENT_SIGNED_ACCEPTANCE').state,'EVIDENCED_ONLY');
 assert.equal(r.client_acceptance.evidence_verified,true);
 assert.equal(r.client_acceptance.quote_version_verified,false);
 assert.equal(r.client_acceptance.source_event_id,'SIGNATURE-EVENT-T');
 assert.equal(r.independent_bank_confirmation,false);
 assert.equal(r.job_close_authorized,false);
 assert.equal(r.booking_authorized,false);
 assert.equal(r.production_complete,false);
 assert.deepEqual(r.writes,[]);
});
test('wrong quotation identity, untrusted signed acceptance and provider failures fail closed',async()=>{
 for(const evidenceVerifier of [
  async({opportunity_id})=>({verified:true,quote_id:'Q-WRONG',opportunity_id,
   evidence_ref:'drive://signed/x',signer_identity:'Someone',
   signed_at:'2026-11-22T08:00:00Z',source_event_id:'SIGNED-WRONG'}),
  async()=>({verified:false}),
  async()=>{throw Error('provider unavailable');}
 ]){
  const r=await inspectJobLifecycle({stores:fixture(),jobId:'JOB-T',
   asOf:'2026-11-22',evidenceVerifier});
  assert.equal(r.stages.find(x=>x.name==='CLIENT_SIGNED_ACCEPTANCE').state,'REVIEW_REQUIRED');
  assert.equal(r.client_acceptance.evidence_verified,false);
  assert.equal(r.production_complete,false);
  assert.deepEqual(r.writes,[]);
 }
});
test('ledger ACCEPTED quote with mismatched scope cannot be elevated by otherwise valid signature',async()=>{
 let verificationCalls=0;
 const r=await inspectJobLifecycle({stores:fixture({
   executionRow:{...execution,'Accepted Scope':'UNAPPROVED REPLACEMENT'}
  }),jobId:'JOB-T',asOf:'2026-11-22',
  evidenceVerifier:async()=>{verificationCalls++;return {verified:true};}
 });
 assert.equal(verificationCalls,0);
 assert.equal(r.client_acceptance.evidence_verified,false);
 assert.equal(r.stages.find(x=>x.name==='CLIENT_SIGNED_ACCEPTANCE').state,'REVIEW_REQUIRED');
 assert.equal(r.stages.find(x=>x.name==='ACCEPTED_QUOTE').state,'REVIEW_REQUIRED');
});
test('HTTP lifecycle with recorded accepted quote and no trusted verifier cannot claim signed acceptance',async()=>{
 const app=createRuntimeApp({
  token:'writer-secret',operatorReadToken:'operator-secret',
  writerFactory:()=>({stores:fixture(),execute:async()=>{throw Error('NO_WRITES')}})
 });
 const server=http.createServer(app);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const result=await fetch('http://127.0.0.1:'+server.address().port+'/v1/operator/job-lifecycle/JOB-T',{
   headers:{'X-MAGOS-Operator-Token':'operator-secret'}
  });
  assert.equal(result.status,202);
  const report=await result.json();
  assert.equal(report.client_acceptance.evidence_verified,false);
  assert.equal(report.stages.find(x=>x.name==='CLIENT_SIGNED_ACCEPTANCE').state,'REVIEW_REQUIRED');
  assert.equal(report.production_complete,false);
 }finally{await new Promise(ok=>server.close(ok));}
});

test('exact WordPress quote version verified in lifecycle only from trusted provider matching canonical IDs',async()=>{
 const evidenceVerifier=async({quote_id,opportunity_id})=>({
  verified:true,quote_id,opportunity_id,quote_version:'2026-11-V3',
  authority:'WP_VERIFIED_SIGNED_RECEIPT_AND_CANONICAL_COMMERCIAL_MATCH',
  evidence_ref:'drive://client/signed-quote',signer_identity:'Approved client',
  signed_at:'2026-11-22T08:00:00Z',source_event_id:'WP-RECEIPT-V3'
 });
 const r=await inspectJobLifecycle({
  stores:fixture(),jobId:'JOB-T',asOf:'2026-11-22',evidenceVerifier
 });
 assert.equal(r.client_acceptance.evidence_verified,true);
 assert.equal(r.client_acceptance.quote_version_verified,true);
 assert.equal(r.client_acceptance.quote_version,'2026-11-V3');
 assert.equal(r.client_acceptance.independent_owner_release,false);
 assert.equal(r.production_complete,false);
});
test('integrated authenticated lifecycle uses the configured provider verifier, not a status-only shortcut',async()=>{
 let calls=0;
 const app=createRuntimeApp({
  token:'writer-private',operatorReadToken:'view-private',
  signedAcceptanceVerifier:async({quote_id,opportunity_id})=>{
   calls++;
   return {verified:true,quote_id,opportunity_id,
    quote_version:'V1',
    authority:'WP_VERIFIED_SIGNED_RECEIPT_AND_CANONICAL_COMMERCIAL_MATCH',
    evidence_ref:'drive://provider/verified',signer_identity:'Client',
    signed_at:'2026-11-22T08:00:00Z',source_event_id:'VERIFIED-SIGNATURE'};
  },
  writerFactory:()=>({stores:fixture(),
   execute:async()=>{throw Error('NO_WRITER_IN_READ_ONLY_LIFECYCLE')}})
 });
 const server=http.createServer(app);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const endpoint='http://127.0.0.1:'+server.address().port+
   '/v1/operator/job-lifecycle/JOB-T';
  const response=await fetch(endpoint,{
   headers:{'X-MAGOS-Operator-Token':'view-private'}
  });
  assert.equal(response.status,202);
  const report=await response.json();
  assert.equal(calls,1);
  assert.equal(report.client_acceptance.evidence_verified,true);
  assert.equal(report.client_acceptance.quote_version_verified,true);
  assert.equal(report.client_acceptance.quote_version,'V1');
  assert.equal(report.production_complete,false);
 }finally{await new Promise(ok=>server.close(ok));}
});
