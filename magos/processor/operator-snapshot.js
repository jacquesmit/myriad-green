'use strict';
// A read-only command-center projection, never a second source of truth.
const txt=v=>String(v??'').trim();
const upper=v=>txt(v).toUpperCase();
function projectOperations({leads=[],jobs=[],quotes=[],procurement=[],exceptions=[]}={}){
 const unique=(rows,key)=>{const seen=new Set();return rows.filter(r=>{const id=txt(r[key]);if(!id||seen.has(id))return false;seen.add(id);return true;});};
 // Only operational inbound enquiries belong in this queue. Scraper and outbound
 // prospecting stay outside active leads; other intake documents are not leads.
 const inboundTypes=new Set(['WEBSITE_FORM','WEB_FORM','CONTACT_FORM','LEAD','ENQUIRY','INQUIRY','WHATSAPP_LEAD','FACEBOOK_LEAD','BOOKING_ORDER','BOOKING','SERVICE_REQUEST']);
 const inboundSystems=new Set(['WEBSITE','WHATSAPP','FACEBOOK','FLUENT_FORMS','AMELIA']);
 const isInbound=r=>{
  const system=upper(r.source_system),type=upper(r.source_type);
  const combined=[system,type,upper(r.source),upper(r.source_category)].join('|');
  if(/SCRAPER|OUTBOUND|PROSPECTING|TODAY_OUTREACH/.test(combined))return false;
  return inboundTypes.has(type)||(inboundSystems.has(system)&&!['SUPPLIER_EMAIL','SUPPLIER_QUOTE','INVOICE','OTHER','RFQ'].includes(type));
 };
 const openLeads=unique(leads,'source_event_id').filter(r=>isInbound(r)&&!['COMPLETED','CLOSED','IGNORED','FILED','RESOLVED'].includes(upper(r.processing_status||r.status||r.intake_status)));
 const allQuotes=unique(quotes,'quote_id');
 const acceptedForJob=allQuotes.filter(r=>upper(r['Quote Status'])==='ACCEPTED'&&!txt(r.job_id));
 const pendingQuotes=allQuotes.filter(r=>!['ACCEPTED','DECLINED','EXPIRED','CANCELLED'].includes(upper(r['Quote Status'])));
 const activeJobs=unique(jobs,'opportunity_id').filter(r=>txt(r.job_id)&&!['JOB_COMPLETED','COMPLETED','CANCELLED','CLOSED','JOB_CANCELLED'].includes(upper(r.job_status)));
 const purchaseReview=unique(procurement,'Procurement ID').filter(r=>!['AUTHORISED','AUTHORIZED'].includes(upper(r['Procurement Gate']))||!['PASSED','PASS'].includes(upper(r.technical_gate)));
 const openExceptions=unique(exceptions,'exception_id').filter(r=>!['RESOLVED','CLOSED'].includes(upper(r.status)));
 return {
  schema_version:'MAGOS_OPERATOR_SNAPSHOT/V1',
  authority:'READ_ONLY_DERIVED',
  counts:{open_leads:openLeads.length,pending_quotes:pendingQuotes.length,active_jobs:activeJobs.length,procurement_review:purchaseReview.length,open_exceptions:openExceptions.length},
  records:{
   leads:openLeads.map(r=>({id:txt(r.source_event_id),status:txt(r.processing_status||r.status||r.intake_status),opportunity_id:txt(r.matched_opportunity_id||r.opportunity_id),client_id:txt(r.matched_crm_id||r.client_crm_id),next_action:txt(r.routing_action||r.next_action||r.review_reason)})),
   quotes:[...pendingQuotes,...acceptedForJob].map(r=>({id:txt(r.quote_id),status:txt(r['Quote Status']),opportunity_id:txt(r.opportunity_id),job_id:txt(r.job_id),next_action:txt(r['Next Action']),drive_link:txt(r['Drive Link'])})),
   jobs:activeJobs.map(r=>({id:txt(r.opportunity_id),status:txt(r.job_status),job_id:txt(r.job_id),client_id:txt(r.client_crm_id),next_action:txt(r.next_action)})),
   procurement:purchaseReview.map(r=>({id:txt(r['Procurement ID']),status:txt(r['Procurement Gate']),job_id:txt(r['Job ID']),supplier_id:txt(r.supplier_id),next_action:txt(r['Next Action'])})),
   exceptions:openExceptions.map(r=>({id:txt(r.exception_id),status:txt(r.status),next_action:txt(r.action_required||r.next_action||r.error_or_blocker)}))
  },
  attention:[
   ...openExceptions.map(r=>({type:'EXCEPTION',id:r.exception_id,next_action:txt(r.action_required||r.next_action||r.error_or_blocker)})),
   ...purchaseReview.map(r=>({type:'PROCUREMENT_REVIEW',id:r['Procurement ID'],next_action:txt(r['Next Action'])})),
   ...pendingQuotes.map(r=>({type:'QUOTE_FOLLOWUP',id:r.quote_id,next_action:txt(r['Next Action'])})),
   ...acceptedForJob.map(r=>({type:'ACCEPTED_QUOTE_REVIEW',id:r.quote_id,next_action:'Inspect acceptance evidence and job creation readiness'})),
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
