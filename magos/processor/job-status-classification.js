'use strict';
// Observed canonical CRM Jobs_Opportunities job_status vocabulary, Nov 2026.
// This is a READ-ONLY UI classification; it must never promote a recorded
// status to independently verified payment, field completion or job close.
const active=new Set(['JOB_IN_PROGRESS','IN_PROGRESS','JOB_BOOKED','JOB_SCHEDULED',
 'SCHEDULED','AWAITING_MATERIALS','WORK_STARTED','SITE_WORK_IN_PROGRESS']);
const closed=new Set(['JOB_COMPLETED','COMPLETED','JOB_COMPLETED_CLOSED',
 'CLOSED','HANDOVER_COMPLETE','JOB_CANCELLED','CANCELLED']);
const prospect=new Set(['NO_JOB','ASSESSMENT_NEEDED','TECHNICAL_REVIEW',
 'SITE_VISIT_BOOKED','LEAD_AWAITING_SCOPE_REVIEW','CALL_OUT_NEEDED',
 'QUOTE_SENT_AWAITING_ACCEPTANCE','DRAFT_PRICING_NOT_SENT',
 'QUOTE_PENDING','QUOTE_SENT','OPEN']);
const val=x=>String(x??'').trim();
function classifyJobStatus(row={}){
 const status=val(row.job_status).toUpperCase();
 const job=val(row.job_id);
 if(!job)return {state:'NO_RECORDED_JOB',status:status||'UNKNOWN',review:false};
 if(active.has(status))return {state:'RECORDED_ACTIVE_JOB',status,review:false};
 if(closed.has(status))return {state:'RECORDED_HISTORICAL_JOB',status,review:false};
 if(prospect.has(status))return {state:'JOB_STATUS_CONTRADICTION',status,review:true,
  reason:'JOB_ID_PRESENT_WITH_PRE_JOB_OR_UNCONFIRMED_STATUS'};
 return {state:'JOB_STATUS_UNKNOWN',status:status||'UNKNOWN',review:true,
  reason:'JOB_ID_PRESENT_WITH_UNRECOGNISED_LIFECYCLE_STATUS'};
}
function inspectJobStatusRegister(rows){
 if(!Array.isArray(rows))return {state:'UNAVAILABLE',active:[],review:[],counts:null,
  writes:[],side_effects:false};
 const seen=new Set(),duplicates=new Set();
 for(const row of rows){
  const id=val(row.opportunity_id);
  if(!id)continue;
  if(seen.has(id))duplicates.add(id);
  seen.add(id);
 }
 const activeRows=[],reviewRows=[];
 for(const row of rows){
  const id=val(row.opportunity_id),status=classifyJobStatus(row);
  if(!id||duplicates.has(id))continue; // handled by existing canonical duplicate audit
  if(status.state==='RECORDED_ACTIVE_JOB')activeRows.push(row);
  else if(status.review)reviewRows.push({opportunity_id:id,job_id:val(row.job_id),
   recorded_status:status.status,reason:status.reason});
 }
 return {state:duplicates.size?'PARTIAL':'READ_ONLY',
  active:activeRows,review:reviewRows,
  counts:{active:activeRows.length,review:reviewRows.length,
   duplicate_opportunity_ids:duplicates.size},
  writes:[],side_effects:false};
}
module.exports={classifyJobStatus,inspectJobStatusRegister};
