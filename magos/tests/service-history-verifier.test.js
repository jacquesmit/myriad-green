'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyCanonicalServiceReceipts}=require('../processor/service-history-verifier');
const {inspectJobAftercare}=require('../processor/aftercare-readiness');
const job={job_id:'JOB-INSTALL',client_crm_id:'CRM-1',property_id:'PROP-1',job_status:'COMPLETED'};
const install={'Job ID':'JOB-INSTALL','Completion Status':'HANDOVER_COMPLETE'};
const service={'Job ID':'JOB-SVC','CRM ID':'CRM-1','Completion Status':'HANDOVER_COMPLETE','Completion Sign-off':'SIGNED'};
const asset={job_id:'JOB-INSTALL',installed_part_id:'PART-I1',client_id:'CRM-1',property_id:'PROP-1',
 part_id:'P-1',photo_evidence:'drive://installation',installation_date:'2026-01-31',
 last_service_date:'2026-09-15',last_service_job_id:'JOB-SVC',last_service_evidence:'drive://service'};
const history={service_event_id:'SVC-1',installed_part_id:'PART-I1',service_job_id:'JOB-SVC',
 service_date:'2026-09-15',evidence_ref:'drive://service',client_id:'CRM-1',
 property_id:'PROP-1',verification_state:'VERIFIED',reviewed_by:'OWNER',reviewed_at:'2026-09-16T10:00:00Z'};
const receipts=(h=[history],e=[install,service])=>verifyCanonicalServiceReceipts({
 job,assets:[asset],executionRows:e,historyRows:h
});
test('exact reviewed canonical service history and completed job yield one receipt',()=>{
 const r=receipts();
 assert.equal(r.length,1);assert.equal(r[0].service_event_id,'SVC-1');
 assert.equal(r[0].source,'CANONICAL_JOB_EXECUTION');
});
test('missing review, mismatched date/client/evidence, duplicate ID and incomplete work fail closed',()=>{
 const cases=[
  [[],[install,service]], [[{...history,reviewed_by:''}],[install,service]],
  [[{...history,service_date:'2026-09-17'}],[install,service]],
  [[{...history,evidence_ref:'drive://wrong'}],[install,service]],
  [[{...history,client_id:'CRM-OTHER'}],[install,service]],
  [[history,history],[install,service]],
  [[history],[install,{...service,'Completion Sign-off':''}]],
  [[history],[install,{...service,'Completion Status':'IN_PROGRESS'}]],
  [[history],[install,service,service]]
 ];
 for(const [h,e] of cases)assert.equal(receipts(h,e).length,0);
});
test('canonical read-only aftercare uses source records, no fabricated communication',async()=>{
 const stores={
  crm:{readObjects:async()=>[job]},
  commercial:{readObjects:async()=>[install,service]},
  supplier:{readObjects:async(name)=>name==='Installed_Parts'?[asset]:[history]}
 };
 const r=await inspectJobAftercare({stores,jobId:'JOB-INSTALL',asOf:'2026-11-22',
  maintenancePolicy:[{part_id:'P-1',policy_id:'M6',interval_months:6,approval_state:'APPROVED'}]});
 assert.equal(r.state,'AFTERCARE_CANDIDATES_PREPARED');
 assert.equal(r.service_due_candidates[0].due_date,'2027-03-15');
 assert.equal(r.service_message_authorized,false);
 assert.deepEqual(r.writes,[]);
});
test('missing canonical Service_History tab never converts a claim to verified',async()=>{
 const stores={
  crm:{readObjects:async()=>[job]},
  commercial:{readObjects:async()=>[install,service]},
  supplier:{readObjects:async(name)=>{
   if(name==='Installed_Parts')return [asset];
   throw Error('TAB_NOT_FOUND');
  }}
 };
 const r=await inspectJobAftercare({stores,jobId:'JOB-INSTALL',asOf:'2026-11-22',
  maintenancePolicy:[{part_id:'P-1',policy_id:'M6',interval_months:6,approval_state:'APPROVED'}]});
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.ok(r.issues.includes('INDEPENDENT_SERVICE_RECEIPT_NOT_VERIFIED:PART-I1'));
});
