'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {inspectJobRelease}=require('../processor/job-release-inspection');
const {createRuntimeApp}=require('../runtime/app');
function fixture({accepted=true,existing=false}={}){
 const quote={quote_id:'Q-ACCEPTED',opportunity_id:'OPP-1','Quote Status':accepted?'ACCEPTED':'SENT','Line Control State':'PASS'};
 const job={opportunity_id:'OPP-1',job_id:existing?'JOB-OLD':'',client_crm_id:'CRM-1'};
 const stores={commercial:{findByKey:async(t,k,v)=>t==='Quotes'&&quote[k]===v?{object:quote}:null},
 crm:{findByKey:async(t,k,v)=>t==='Jobs_Opportunities'&&job[k]===v?{object:job}:null}};
 return stores;
}
test('canonical inspection resolves accepted quote without asserting cleared money',async()=>{
 const r=await inspectJobRelease({stores:fixture(),quoteId:'Q-ACCEPTED'});
 assert.equal(r.state,'READY_FOR_EVIDENCE_REVIEW');
 assert.ok(r.evidence_requirements.includes('SIGNED_ACCEPTANCE'));
 assert.equal(r.side_effects,false);
 assert.deepEqual(r.writes,[]);
});
test('unaccepted quote and existing job cannot be released',async()=>{
 for(const opts of [{accepted:false},{existing:true}]){
  const r=await inspectJobRelease({stores:fixture(opts),quoteId:'Q-ACCEPTED'});
  assert.equal(r.state,'REVIEW_REQUIRED');
 }
});
test('authenticated job readiness HTTP endpoint accesses canonical readers only',async()=>{
 const app=createRuntimeApp({token:'secret',writerFactory:()=>({stores:fixture(),execute:async()=>{throw Error('MUST_NOT_WRITE')}})});
 const server=http.createServer(app);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/operator/job-readiness/Q-ACCEPTED';
  assert.equal((await fetch(url)).status,401);
  const res=await fetch(url,{headers:{authorization:'Bearer secret'}});
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.quote_id,'Q-ACCEPTED');
  assert.equal(data.state,'READY_FOR_EVIDENCE_REVIEW');
 }finally{await new Promise(done=>server.close(done));}
});
