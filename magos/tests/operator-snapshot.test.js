'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {projectOperations,loadOperatorSnapshot}=require('../processor/operator-snapshot');
const {createRuntimeApp}=require('../runtime/app');
const stores={
 crm:{readObjects:async t=>t==='Intake_Queue'?[{source_event_id:'LEAD-1',status:'NEW'}]:[{opportunity_id:'OPP-1',job_status:'IN_PROGRESS',next_action:'Visit site'}]},
 commercial:{readObjects:async t=>t==='Quotes'?[{quote_id:'Q-1','Quote Status':'SENT','Next Action':'Follow up'}]:[{'Procurement ID':'PROC-1','Procurement Gate':'BLOCK','Next Action':'Confirm stock'}]},
 audit:{readObjects:async()=>[{exception_id:'EXC-1',status:'OPEN',next_action:'Review mapping'}]}
};
test('projects five live work queues without generating writes',async()=>{
 const snap=await loadOperatorSnapshot({stores});
 assert.deepEqual(snap.counts,{open_leads:1,pending_quotes:1,active_jobs:1,procurement_review:1,open_exceptions:1});
 assert.equal(snap.writes.length,0);
 assert.equal(snap.side_effects,false);
 assert.ok(snap.attention.some(a=>a.type==='PROCUREMENT_REVIEW'));
});
test('rejects missing authoritative readers',async()=>assert.rejects(loadOperatorSnapshot({stores:{}}),/AUTHORITATIVE_READERS_REQUIRED/));
test('deduplicates keyed rows and ignores resolved exception',()=>{
 const v=projectOperations({exceptions:[{exception_id:'X',status:'RESOLVED'},{exception_id:'X',status:'OPEN'}],quotes:[{quote_id:'Q', 'Quote Status':'SENT'},{quote_id:'Q', 'Quote Status':'SENT'}]});
 assert.equal(v.counts.open_exceptions,0);
 assert.equal(v.counts.pending_quotes,1);
});
test('HTTP operator endpoint requires runtime credential and returns authoritative projection',async()=>{
 const app=createRuntimeApp({token:'secret',writerFactory:()=>({stores})});
 const server=http.createServer(app);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const base='http://127.0.0.1:'+server.address().port+'/v1/operator/snapshot';
  assert.equal((await fetch(base)).status,401);
  const response=await fetch(base,{headers:{authorization:'Bearer secret'}});
  assert.equal(response.status,200);
  const json=await response.json();
  assert.equal(json.counts.active_jobs,1);
  assert.equal(json.authority,'READ_ONLY_DERIVED');
 }finally{await new Promise(ok=>server.close(ok));}
});

test('records preserve canonical cross-workflow links and avoid hidden writes',async()=>{
 const data=await loadOperatorSnapshot({stores});
 assert.equal(data.records.leads[0].id,'LEAD-1');
 assert.equal(data.records.quotes[0].id,'Q-1');
 assert.equal(data.records.jobs[0].id,'OPP-1');
 assert.equal(data.records.procurement[0].id,'PROC-1');
 assert.deepEqual(data.writes,[]);
});

test('live Intake_Queue canonical columns drive status, linkage and routing',()=>{
 const data=projectOperations({leads:[{source_event_id:'EV-9',processing_status:'REVIEW_REQUIRED',matched_crm_id:'CRM-9',matched_opportunity_id:'OPP-9',routing_action:'Request photos'}]});
 assert.equal(data.counts.open_leads,1);
 assert.deepEqual(data.records.leads[0],{id:'EV-9',status:'REVIEW_REQUIRED',opportunity_id:'OPP-9',client_id:'CRM-9',next_action:'Request photos'});
});
test('live Sync_Exceptions action_required and procurement PASS gate are respected',()=>{
 const data=projectOperations({exceptions:[{exception_id:'EX-9',status:'OPEN',action_required:'Resolve bank mismatch'}],procurement:[{'Procurement ID':'P-OK','Procurement Gate':'AUTHORISED',technical_gate:'PASS'},{'Procurement ID':'P-HOLD','Procurement Gate':'BLOCK',technical_gate:'PASSED'}]});
 assert.equal(data.counts.open_exceptions,1);
 assert.equal(data.records.exceptions[0].next_action,'Resolve bank mismatch');
 assert.equal(data.counts.procurement_review,1);
 assert.equal(data.records.procurement[0].id,'P-HOLD');
});
