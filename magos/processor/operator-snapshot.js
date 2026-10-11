'use strict';
// A read-only command-center projection, never a second source of truth.
const txt=v=>String(v??'').trim();
const upper=v=>txt(v).toUpperCase();
function projectOperations({leads=[],jobs=[],quotes=[],procurement=[],exceptions=[]}={}){
 const unique=(rows,key)=>{const seen=new Set();return rows.filter(r=>{const id=txt(r[key]);if(!id||seen.has(id))return false;seen.add(id);return true;});};
 const openLeads=unique(leads,'source_event_id').filter(r=>!['COMPLETED','CLOSED','IGNORED'].includes(upper(r.status||r.intake_status)));
 const pendingQuotes=unique(quotes,'quote_id').filter(r=>!['ACCEPTED','DECLINED','EXPIRED','CANCELLED'].includes(upper(r['Quote Status'])));
 const activeJobs=unique(jobs,'opportunity_id').filter(r=>!['JOB_COMPLETED','CANCELLED','CLOSED'].includes(upper(r.job_status)));
 const purchaseReview=unique(procurement,'Procurement ID').filter(r=>upper(r['Procurement Gate'])!=='AUTHORISED'||upper(r.technical_gate)!=='PASSED');
 const openExceptions=unique(exceptions,'exception_id').filter(r=>!['RESOLVED','CLOSED'].includes(upper(r.status)));
 return {
  schema_version:'MAGOS_OPERATOR_SNAPSHOT/V1',
  authority:'READ_ONLY_DERIVED',
  counts:{open_leads:openLeads.length,pending_quotes:pendingQuotes.length,active_jobs:activeJobs.length,procurement_review:purchaseReview.length,open_exceptions:openExceptions.length},
  attention:[
   ...openExceptions.map(r=>({type:'EXCEPTION',id:r.exception_id,next_action:txt(r.next_action||r.error_or_blocker)})),
   ...purchaseReview.map(r=>({type:'PROCUREMENT_REVIEW',id:r['Procurement ID'],next_action:txt(r['Next Action'])})),
   ...pendingQuotes.map(r=>({type:'QUOTE_FOLLOWUP',id:r.quote_id,next_action:txt(r['Next Action'])})),
   ...activeJobs.filter(r=>txt(r.next_action)).map(r=>({type:'JOB_ACTION',id:r.opportunity_id,next_action:txt(r.next_action)}))
  ],
  writes:[],side_effects:false
 };
}
async function loadOperatorSnapshot({stores}={}){
 if(!stores?.crm?.readObjects||!stores?.commercial?.readObjects||!stores?.audit?.readObjects)throw Error('AUTHORITATIVE_READERS_REQUIRED');
 // Named datasets remain in existing MGOS workbooks.
 const [leads,jobs,quotes,procurement,exceptions]=await Promise.all([
  stores.crm.readObjects('Intake_Queue'),
  stores.crm.readObjects('Jobs_Opportunities'),
  stores.commercial.readObjects('Quotes'),
  stores.commercial.readObjects('Procurement'),
  stores.audit.readObjects('Sync_Exceptions')
 ]);
 return projectOperations({leads,jobs,quotes,procurement,exceptions});
}
module.exports={projectOperations,loadOperatorSnapshot};
