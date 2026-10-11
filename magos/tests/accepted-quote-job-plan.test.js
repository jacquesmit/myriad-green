'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {planAcceptedJob}=require('../processor/accepted-quote-job-plan');
function fixture({accepted=true,cleared=true,existing=false,existingOpportunity=false}={}){
 const quote={quote_id:'Q-1',opportunity_id:'OPP-1','Quote Status':accepted?'ACCEPTED':'SENT','Line Control State':'PASS','Project / Scope':'Irrigation'};
 const job={opportunity_id:'OPP-1',client_crm_id:'CRM-1',client_name:'Test Client',job_id:'',site_address:'Pretoria',primary_service:'Irrigation'};
 const records={Quotes:quote,Jobs_Opportunities:job,'Job Execution':existing?{'Job ID':'JOB-1'}:null};
 return {stores:{commercial:{findByKey:async(t,k,v)=>records[t]?.[k]===v?{object:records[t]}:null,readObjects:async t=>t==='Job Execution'&&existingOpportunity?[{opportunity_id:'OPP-1','Job ID':'JOB-DIFFERENT'}]:[]},crm:{findByKey:async(t,k,v)=>records[t]?.[k]===v?{object:records[t]}:null}},args:{quoteId:'Q-1',jobId:'JOB-1',sourceEventId:'EV-1',acceptanceEvidence:'https://drive.google.com/acceptance',paymentClearance:cleared?'CLEARED':'PROOF_RECEIVED'}};
}
test('accepted quote yields linked P3 job and execution writes without execution',async()=>{
 const f=fixture();const r=await planAcceptedJob({...f.args,stores:f.stores});
 assert.equal(r.state,'READY_FOR_GOVERNED_JOB_CREATION');assert.equal(r.plan.writes.length,2);
 assert.equal(r.plan.writes[0].changes.job_id,'JOB-1');
 assert.equal(r.plan.writes[1].values['Job ID'],'JOB-1');
 assert.equal(r.plan.preconditions[0].expect['Quote Status'],'ACCEPTED');
});
test('unaccepted quote cannot plan job mutation',async()=>{const f=fixture({accepted:false});const r=await planAcceptedJob({...f.args,stores:f.stores});assert.equal(r.state,'BLOCKED');assert.equal(r.plan,undefined);});
test('proof received is not clearance',async()=>{const f=fixture({cleared:false});const r=await planAcceptedJob({...f.args,stores:f.stores});assert.equal(r.state,'REVIEW_REQUIRED');});
test('existing execution blocks another job',async()=>{const f=fixture({existing:true});const r=await planAcceptedJob({...f.args,stores:f.stores});assert.equal(r.reason_code,'JOB_EXECUTION_ALREADY_EXISTS');});

test('existing execution for same opportunity prevents alternate job ID',async()=>{
 const f=fixture({existingOpportunity:true});
 const r=await planAcceptedJob({...f.args,stores:f.stores});
 assert.equal(r.reason_code,'OPPORTUNITY_EXECUTION_ALREADY_EXISTS');
 assert.equal(r.plan,undefined);
});

test('CRM existing job ID must remain empty at P3 commit time',async()=>{
 const f=fixture();
 const r=await planAcceptedJob({...f.args,stores:f.stores});
 assert.equal(r.state,'READY_FOR_GOVERNED_JOB_CREATION');
 assert.ok(r.plan.preconditions.some(p=>p.store==='crm'&&p.sheet==='Jobs_Opportunities'&&p.expect.job_id===''));
});
test('unavailable execution index fails closed, not create duplicate job',async()=>{
 const f=fixture();
 delete f.stores.commercial.readObjects;
 const r=await planAcceptedJob({...f.args,stores:f.stores});
 assert.equal(r.reason_code,'EXECUTION_INDEX_UNAVAILABLE');
 assert.equal(r.plan,undefined);
});

test('job execution write uses registered active cross-system link instead of opportunity ID',async()=>{
 const f=fixture(); const r=await planAcceptedJob({...f.args,stores:f.stores});
 assert.equal(r.state,'READY_FOR_GOVERNED_JOB_CREATION');
 assert.equal(r.plan.writes[1].link_id,'LNK-009');
 assert.equal(r.plan.writes[1].sheet,'Job Execution');
});
