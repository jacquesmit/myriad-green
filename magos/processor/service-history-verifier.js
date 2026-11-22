'use strict';

// Server-owned, read-only corroboration of service history.
// Do not accept a caller's "verified" flag or a note on Installed_Parts.
// Service_History is a proposed canonical tab: until it exists, fail closed.
const v=x=>String(x??'').trim();
const up=x=>v(x).toUpperCase();
const complete=new Set(['COMPLETED','HANDOVER_COMPLETE','CLOSED']);
function verifyCanonicalServiceReceipts({job,assets=[],executionRows=[],historyRows=[]}={}){
 if(!Array.isArray(assets)||!Array.isArray(executionRows)||!Array.isArray(historyRows))
   throw Error('CANONICAL_SERVICE_SOURCE_UNAVAILABLE');
 const receipts=[];
 for(const asset of assets){
   const partId=v(asset.installed_part_id),jobId=v(asset.last_service_job_id);
   const date=v(asset.last_service_date),evidence=v(asset.last_service_evidence);
   if(!partId||!jobId||!date||!evidence)continue;
   const histories=historyRows.filter(r=>
     v(r.installed_part_id)===partId && v(r.service_job_id)===jobId);
   const executions=executionRows.filter(r=>v(r['Job ID'])===jobId);
   if(histories.length!==1||executions.length!==1)continue;
   const h=histories[0],x=executions[0];
   if(up(h.verification_state)!=='VERIFIED'||
     !v(h.reviewed_by)||!v(h.reviewed_at)||!v(h.service_event_id)||
     v(h.installed_part_id)!==partId||v(h.service_job_id)!==jobId||
     v(h.service_date)!==date||v(h.evidence_ref)!==evidence||
     v(h.client_id)!==v(job.client_crm_id)||
     v(h.property_id)!==v(job.property_id)||
     v(x['CRM ID'])!==v(job.client_crm_id)||
     !complete.has(up(x['Completion Status']))||
     !v(x['Completion Sign-off']))continue;
   const receiptId=v(h.service_event_id);
   if(historyRows.filter(r=>v(r.service_event_id)===receiptId).length!==1)continue;
   receipts.push({
     installed_part_id:partId, service_job_id:jobId,service_date:date,
     evidence_ref:evidence,client_id:v(job.client_crm_id),
     property_id:v(job.property_id),source:'CANONICAL_JOB_EXECUTION',
     service_event_id:receiptId,state:'VERIFIED'
   });
 }
 return receipts;
}
module.exports={verifyCanonicalServiceReceipts};
