'use strict';
const {inspectDepositEvidence}=require('./deposit-evidence-inspection');
const val=x=>String(x??'').trim();
const up=x=>val(x).toUpperCase();
const complete=new Set(['COMPLETED','JOB_COMPLETED','CLOSED','CANCELLED','JOB_CANCELLED']);
const booked=new Set(['SCHEDULED','CONFIRMED','APPROVED','IN_PROGRESS']);
async function inspectSchedulingReadiness({stores,jobId}={}){
 const fail=[],review=[];
 if(!val(jobId) || !stores?.crm?.readObjects ||
    !stores?.commercial?.readObjects)return {
    state:'REVIEW_REQUIRED',blockers:['JOB_OR_CANONICAL_READERS_MISSING'],
    writes:[],side_effects:false
 };
 const [jobs,executions,requirements,bookings]=await Promise.all([
  stores.crm.readObjects('Jobs_Opportunities'),
  stores.commercial.readObjects('Job Execution'),
  stores.commercial.readObjects('Procurement'),
  stores.crm.readObjects('Bookings')
 ]);
 if(![jobs,executions,requirements,bookings].every(Array.isArray))throw Error('CANONICAL_SCHEDULE_SOURCE_MISSING');
 const jobMatches=jobs.filter(r=>val(r.job_id)===jobId);
 const execMatches=executions.filter(r=>val(r['Job ID'])===jobId);
 if(jobMatches.length!==1)fail.push('JOB_ID_MISSING_OR_AMBIGUOUS');
 if(execMatches.length!==1)fail.push('EXECUTION_ID_MISSING_OR_AMBIGUOUS');
 const job=jobMatches.length===1?jobMatches[0]:null,execution=execMatches.length===1?execMatches[0]:null;
 const opportunityId=val(job?.opportunity_id);
 if(!opportunityId||opportunityId!==val(execution?.opportunity_id))fail.push('OPPORTUNITY_LINK_NOT_VERIFIED');
 if(complete.has(up(job?.job_status))||complete.has(up(execution?.['Job Status'])))fail.push('JOB_NOT_ACTIVE');
 if(!val(job?.property_id)||!val(job?.site_address)||!val(execution?.['Site Address']))
  review.push('CANONICAL_SITE_NOT_VERIFIED');
 if(!val(execution?.['Accepted Scope'])||!val(execution?.quote_id))
  review.push('ACCEPTED_SCOPE_POINTER_MISSING');
 if(!val(execution?.['Crew / Owner'])||/TO_CONFIRM|TBA|UNASSIGNED/.test(up(execution?.['Crew / Owner'])))
  review.push('CREW_NOT_ASSIGNED');
 const materialState=up(execution?.['Materials Ready']);
 if(!['READY','NOT_REQUIRED'].includes(materialState))review.push('MATERIALS_NOT_READY');
 const jobRequirements=requirements.filter(r=>val(r['Job ID'])===jobId);
 if(jobRequirements.some(r=>up(r['Procurement Gate'])!=='AUTHORISED' ||
  !['PASS','PASSED'].includes(up(r.technical_gate))))
  review.push('PROCUREMENT_RELEASE_OR_TECHNICAL_GATE_UNVERIFIED');
 if(jobRequirements.some(r=>!['RECEIVED','READY','IN_STOCK_CONFIRMED','NOT_REQUIRED'].includes(up(r['Stock Status'])) &&
  !val(r['Receipt Evidence Snapshot (Derived)'])))
  review.push('MATERIAL_STOCK_OR_RECEIPT_EVIDENCE_MISSING');
 if(!jobRequirements.length && materialState!=='NOT_REQUIRED')
  review.push('NO_PROCUREMENT_REQUIREMENTS_OR_NON_PROCUREMENT_EXEMPTION');
 const prior=bookings.filter(b=>val(b.job_id)===jobId &&
  booked.has(up(b.mgos_booking_status)) && up(b.source_system)!=='SELF_TEST');
 if(prior.length)fail.push('ACTIVE_PROVIDER_BOOKING_ALREADY_EXISTS');
 let deposit;
 if(opportunityId) {
  deposit=await inspectDepositEvidence({stores,opportunityId});
  if(deposit.state!=='CLEARED_ALLOCATION_EVIDENCED')review.push('BANK_CLEARED_DEPOSIT_NOT_VERIFIED');
 }else review.push('FINANCIAL_AUTHORITY_MISSING');
 return {
  schema_version:'MAGOS_SCHEDULING_READINESS_V1',
  job_id:jobId,opportunity_id:opportunityId,
  state:fail.length?'BLOCKED':review.length?'REVIEW_REQUIRED':'READY_FOR_PROVIDER_AVAILABILITY_CHECK',
  blockers:[...new Set(fail)],
  review_reasons:[...new Set(review)],
  procurement_requirement_count:jobRequirements.length,
  active_provider_booking_count:prior.length,
  deposit_state:deposit?.state||'UNKNOWN',
  calendar_availability_verified:false,
  booking_authorized:false,
  writes:[],side_effects:false
 };
}
module.exports={inspectSchedulingReadiness};
