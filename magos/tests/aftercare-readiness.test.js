'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessAftercare,inspectJobAftercare,addMonths}=require('../processor/aftercare-readiness');
const job={job_id:'JOB-1',client_crm_id:'CRM-1',property_id:'PROP-1',job_status:'JOB_COMPLETED'};
const execution={'Job ID':'JOB-1','Completion Status':'HANDOVER_COMPLETE',
 'Review Status':'REVIEW_REQUEST_NEEDED'};
const asset={installed_part_id:'INST-1',job_id:'JOB-1',client_id:'CRM-1',
 property_id:'PROP-1',part_id:'PART-1',
 installation_date:'2026-01-31',photo_evidence:'test://photo',
 warranty_start:'2026-01-31',warranty_end:'2027-01-31',warranty_status:'ACTIVE'};
const rule={policy_id:'MAINT-6M',part_id:'PART-1',interval_months:6,approval_state:'APPROVED'};
const run=(overrides={})=>assessAftercare({job,execution,assets:[asset],
 asOf:'2026-11-21',maintenancePolicy:[rule],...overrides});
test('aftercare prepares deterministic warranty/service candidates without sending anything',()=>{
 const result=run();
 assert.equal(result.state,'AFTERCARE_CANDIDATES_PREPARED');
 assert.equal(result.asset_count,1);
 assert.equal(result.warranties[0].warranty_active_as_of,true);
 assert.equal(result.warranties[0].policy_scope,'MYRIAD_GREEN_REPLACED_PARTS_ONLY');
 assert.equal(result.service_due_candidates.length,1);
 assert.equal(result.service_due_candidates[0].candidate_id,'SERVICE_DUE|INST-1|MAINT-6M|2027-01-31');
 assert.equal(result.client_contact_consent_verified,false);
 assert.equal(result.service_message_authorized,false);
 assert.deepEqual(result.writes,[]);
});
test('no approved policy means no recurring service candidate',()=>{
 const result=run({maintenancePolicy:[]});
 assert.equal(result.service_due_candidates.length,0);
});
test('unapproved service policy fails closed',()=>{
 const result=run({maintenancePolicy:[{...rule,approval_state:'DRAFT'}]});
 assert.equal(result.state,'REVIEW_REQUIRED');
 assert.ok(result.issues.some(x=>x.startsWith('MAINTENANCE_POLICY_NOT_VERIFIED')));
});
test('unknown asset and mismatched client/property never create follow-up',()=>{
 const result=run({assets:[{...asset,client_id:'CRM-OTHER'}]});
 assert.equal(result.service_due_candidates.length,0);
 assert.ok(result.issues.some(x=>x.startsWith('ASSET_CLIENT_PROPERTY_MISMATCH')));
});
test('duplicate installed assets require review, never duplicate outreach',()=>{
 const result=run({assets:[asset,asset]});
 assert.equal(result.service_due_candidates.length,1);
 assert.ok(result.issues.includes('DUPLICATE_OR_MISSING_INSTALLED_PART_ID'));
});
test('date arithmetic clamps to last valid day and rejects invalid dates',()=>{
 assert.equal(addMonths('2026-01-31',1),'2026-02-28');
 const result=run({assets:[{...asset,warranty_end:'2027-02-30'}]});
 assert.ok(result.issues.includes('WARRANTY_END_DATE_INVALID:INST-1'));
});
test('source reader detects duplicate jobs and does not manufacture asset records',async()=>{
 const stores={
 crm:{readObjects:async()=>[job,job]},
 commercial:{readObjects:async()=>[execution]},
 supplier:{readObjects:async()=>[asset]}
 };
 const result=await inspectJobAftercare({stores,jobId:'JOB-1',asOf:'2026-11-21'});
 assert.equal(result.state,'REVIEW_REQUIRED');
 assert.ok(result.issues.includes('JOB_EXECUTION_ID_NOT_UNIQUE_OR_MISSING'));
});

test('verified last service resets recurring schedule and retains provenance',()=>{
 const serviced={...asset,last_service_date:'2026-09-15',
   last_service_job_id:'JOB-SVC-42',last_service_evidence:'drive://verified-service-receipt'};
 const result=run({assets:[serviced],serviceReceipts:[{
   installed_part_id:'INST-1',service_job_id:'JOB-SVC-42',
   service_date:'2026-09-15',evidence_ref:'drive://verified-service-receipt',
   client_id:'CRM-1',property_id:'PROP-1',
   source:'CANONICAL_JOB_EXECUTION',state:'VERIFIED'
 }]});
 assert.equal(result.state,'AFTERCARE_CANDIDATES_PREPARED');
 assert.equal(result.service_due_candidates[0].due_date,'2027-03-15');
 assert.equal(result.service_due_candidates[0].recurrence_anchor_type,'VERIFIED_LAST_SERVICE');
 assert.equal(result.service_due_candidates[0].recurrence_anchor_date,'2026-09-15');
 assert.equal(result.service_due_candidates[0].status,'DRAFT_REVIEW_ONLY');
 assert.equal(result.service_message_authorized,false);
});
test('unverified, future and preinstallation servicing cannot change the schedule',()=>{
 for(const change of [
   {last_service_date:'2026-09-15'},
   {last_service_evidence:'receipt-only'},
   {last_service_date:'2026-12-05',last_service_job_id:'JOB-2',last_service_evidence:'proof'},
   {last_service_date:'2025-12-01',last_service_job_id:'JOB-2',last_service_evidence:'proof'},
   {last_service_date:'2026-02-30',last_service_job_id:'JOB-2',last_service_evidence:'proof'}
 ]){
   const result=run({assets:[{...asset,...change}]});
   assert.equal(result.state,'REVIEW_REQUIRED');
   assert.equal(result.service_due_candidates.length,0);
   assert.ok(result.issues.includes('LAST_SERVICE_EVIDENCE_UNVERIFIED:INST-1'));
 }
});
test('recurrence uses original anchor without cumulative month-end drift',()=>{
 const result=run({asOf:'2026-10-01',maintenancePolicy:[{...rule,interval_months:1}]});
 assert.equal(result.service_due_candidates[0].due_date,'2026-10-31');
 assert.equal(result.service_due_candidates[0].recurrence_anchor_type,'INSTALLATION');
});

test('asset self-attestation without independent service proof is blocked',()=>{
 const serviced={...asset,last_service_date:'2026-09-15',
   last_service_job_id:'JOB-SVC-42',last_service_evidence:'drive://receipt'};
 const result=run({assets:[serviced]});
 assert.equal(result.state,'REVIEW_REQUIRED');
 assert.equal(result.service_due_candidates.length,0);
 assert.ok(result.issues.includes('INDEPENDENT_SERVICE_RECEIPT_NOT_VERIFIED:INST-1'));
});
test('forged, mismatched and duplicate service receipts never unlock schedule',()=>{
 const serviced={...asset,last_service_date:'2026-09-15',
   last_service_job_id:'JOB-SVC-42',last_service_evidence:'drive://receipt'};
 const correct={installed_part_id:'INST-1',service_job_id:'JOB-SVC-42',
   service_date:'2026-09-15',evidence_ref:'drive://receipt',
   client_id:'CRM-1',property_id:'PROP-1',source:'CANONICAL_JOB_EXECUTION',state:'VERIFIED'};
 for(const receipts of [
   [{...correct,client_id:'OTHER'}],
   [{...correct,service_date:'2026-09-16'}],
   [{...correct,source:'ASSET_ROW'}],
   [{...correct,evidence_ref:'drive://other'}],
   [correct,correct]
 ]){
   const r=run({assets:[serviced],serviceReceipts:receipts});
   assert.equal(r.service_due_candidates.length,0);
   assert.ok(r.issues.includes('INDEPENDENT_SERVICE_RECEIPT_NOT_VERIFIED:INST-1'));
 }
});
test('canonical inspection invokes an independent service verifier only server side',async()=>{
 const serviced={...asset,last_service_date:'2026-09-15',
   last_service_job_id:'JOB-SVC-42',last_service_evidence:'drive://receipt'};
 const stores={
   crm:{readObjects:async()=>[job]},
   commercial:{readObjects:async()=>[execution]},
   supplier:{readObjects:async()=>[serviced]}
 };
 const receipt={installed_part_id:'INST-1',service_job_id:'JOB-SVC-42',
   service_date:'2026-09-15',evidence_ref:'drive://receipt',
   client_id:'CRM-1',property_id:'PROP-1',source:'CANONICAL_JOB_EXECUTION',state:'VERIFIED'};
 const blocked=await inspectJobAftercare({stores,jobId:'JOB-1',asOf:'2026-11-21',maintenancePolicy:[rule]});
 assert.equal(blocked.state,'REVIEW_REQUIRED');
 const allowed=await inspectJobAftercare({stores,jobId:'JOB-1',asOf:'2026-11-21',
   maintenancePolicy:[rule],verifyServiceReceipt:async()=>receipt});
 assert.equal(allowed.state,'AFTERCARE_CANDIDATES_PREPARED');
 assert.equal(allowed.service_due_candidates[0].due_date,'2027-03-15');
 const failed=await inspectJobAftercare({stores,jobId:'JOB-1',asOf:'2026-11-21',
   maintenancePolicy:[rule],verifyServiceReceipt:async()=>{throw Error('UNAVAILABLE');}});
 assert.equal(failed.state,'REVIEW_REQUIRED');
});
