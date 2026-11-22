'use strict';
// Canonical, read-only source attribution through real opportunity/quote/job links.
// A scraped contact is NOT a lead. Job status and proof of payment are different.
const {classifyCrmProvenance}=require('./lead-provenance');
const {isCanonicalCustomerRfq}=require('./customer-rfq-provenance');
const v=x=>String(x??'').trim();
const up=x=>v(x).toUpperCase();
function index(rows,key){
 const found=new Map(),invalid=new Set();
 for(const row of rows){
  const id=v(row[key]);
  if(!id){invalid.add('MISSING_'+key);continue;}
  if(found.has(id)){invalid.add('DUPLICATE_'+key+':'+id);found.delete(id);}
  else if(!invalid.has('DUPLICATE_'+key+':'+id))found.set(id,row);
 }
 return {found,invalid};
}
function inspectAttributedConversions({clients,opportunities,quotes,executions,intakes=[]}={}){
 if(![clients,opportunities,quotes,executions,intakes].every(Array.isArray))
  return {schema_version:'MAGOS_ATTRIBUTED_CONVERSION_V1',
   state:'UNAVAILABLE',reason_code:'CANONICAL_CONVERSION_SOURCES_UNAVAILABLE',
   records:[],by_source:[],exceptions:[],writes:[],side_effects:false};
 const clientIdx=index(clients,'crm_id');
 const opportunityIdx=index(opportunities,'opportunity_id');
 const quoteIdx=index(quotes,'quote_id');
 const executionIdx=index(executions,'Execution ID');
 const exceptions=[...clientIdx.invalid,...opportunityIdx.invalid,
   ...quoteIdx.invalid,...executionIdx.invalid];
 // Inbound contact is separate from original acquisition. Link source events
 // only through exact canonical CRM and opportunity IDs; never by name/phone.
 const inboundSystems=new Set(['WEBSITE','WORDPRESS','GMAIL','WHATSAPP','FACEBOOK',
  'FLUENT_FORMS','AMELIA','PHONE','GOOGLE_BUSINESS','GOOGLE_ADS',
  'REFERRAL','ORGANIC_SEARCH','DIRECT_EMAIL']);
 const inboundTypes=new Set(['WEBSITE_FORM','WEB_FORM','CONTACT_FORM','LEAD',
  'LEAD_SUBMISSION','ENQUIRY','INQUIRY','WHATSAPP_LEAD','FACEBOOK_LEAD',
  'BOOKING_ORDER','BOOKING','SERVICE_REQUEST']);
 const inboundEventLinks=new Map();
 const seenEventKeys=new Set(),conflictEventKeys=new Set();
 for(const intake of intakes){
  const source=up(intake.source_system),type=up(intake.source_type),
   event=v(intake.source_event_id);
  const outboundMarkers=[source,type,up(intake.record_origin),up(intake.lead_direction),
   up(intake.acquisition_source)].join('|');
  if(/SCRAPER|OUTBOUND|PROSPECTING|TODAY_OUTREACH|GOOGLE_PLACES/.test(outboundMarkers) ||
     !inboundSystems.has(source)||(!inboundTypes.has(type)&&!isCanonicalCustomerRfq(intake)))continue;
  if(!event){exceptions.push('INBOUND_SOURCE_EVENT_MISSING');continue;}
  const eventKey=source+'|'+event;
  if(seenEventKeys.has(eventKey)){
   conflictEventKeys.add(eventKey);
   exceptions.push('DUPLICATE_INBOUND_SOURCE_EVENT:'+eventKey);
   continue;
  }
  seenEventKeys.add(eventKey);
  const crm=v(intake.matched_crm_id),opportunity=v(intake.matched_opportunity_id);
  if(!crm||!opportunity)continue; // captured enquiry without verified conversion
  const links=inboundEventLinks.get(opportunity)||[];
  links.push({event_key:eventKey,crm_id:crm});
  inboundEventLinks.set(opportunity,links);
 }
 const quotesByOpportunity=new Map(),executionsByJob=new Map(),jobOwner=new Map();
 for(const row of quoteIdx.found.values()){
  const opportunity=v(row.opportunity_id);
  if(!opportunity){exceptions.push('QUOTE_OPPORTUNITY_MISSING:'+v(row.quote_id));continue;}
  const items=quotesByOpportunity.get(opportunity)||[];
  items.push(row);quotesByOpportunity.set(opportunity,items);
 }
 for(const row of executionIdx.found.values()){
  const job=v(row['Job ID']);
  if(!job){exceptions.push('EXECUTION_JOB_MISSING:'+v(row['Execution ID']));continue;}
  const items=executionsByJob.get(job)||[];
  items.push(row);executionsByJob.set(job,items);
 }
 const sourceSummary=new Map();
 const records=[];
 const addCount=(source,field)=>{
  const item=sourceSummary.get(source)||{source,opportunities:0,quoted:0,accepted:0,linked_jobs:0};
  item[field]+=1;sourceSummary.set(source,item);
 };
 for(const op of opportunityIdx.found.values()){
  const opportunity=v(op.opportunity_id),crm=v(op.client_crm_id);
  const client=clientIdx.found.get(crm);
  if(!crm||!client){
   exceptions.push('OPPORTUNITY_CLIENT_UNVERIFIED:'+opportunity);continue;
  }
  const provenance=classifyCrmProvenance(client);
  const source=provenance.kind==='PROVENANCE_REVIEW'?'UNKNOWN':
    provenance.kind==='OUTBOUND_PROSPECT'||provenance.kind==='CONVERTED_OUTBOUND'?
     (up(client.record_origin)==='SCRAPER'||up(client.acquisition_source)==='OUTBOUND_PROSPECTING'?'OUTBOUND_SCRAPER':'OUTBOUND_OTHER'):
     up(client.acquisition_source)||'UNKNOWN';
  const inboundLinks=inboundEventLinks.get(opportunity)||[];
  const linkedInbound=inboundLinks.filter(link=>
   link.crm_id===crm&&!conflictEventKeys.has(link.event_key));
  if(inboundLinks.some(link=>link.crm_id!==crm))
   exceptions.push('INBOUND_CLIENT_LINK_CONFLICT:'+opportunity);
  const quoteMatches=quotesByOpportunity.get(opportunity)||[];
  const validQuotes=quoteMatches.filter(q=>v(q.opportunity_id)===opportunity);
  const quoted=validQuotes.length>0;
  const accepted=validQuotes.some(q=>up(q['Quote Status'])==='ACCEPTED');
  const job=v(op.job_id);
  const executionsForJob=job?executionsByJob.get(job)||[]:[];
  const execution=executionsForJob.length===1?executionsForJob[0]:null;
  const matchingQuotes=validQuotes.filter(q=>up(q['Quote Status'])==='ACCEPTED' &&
   v(execution?.quote_id)===v(q.quote_id));
  let linkedJob=!!job&&executionsForJob.length===1&&matchingQuotes.length===1&&
   v(execution.opportunity_id)===opportunity&&v(execution['CRM ID'])===crm;
  if(job&&jobOwner.has(job)){
   exceptions.push('JOB_ID_REUSED_ACROSS_OPPORTUNITIES:'+job);
   linkedJob=false;
   const prior=records.find(r=>r.id===jobOwner.get(job));
   if(prior){prior.linked_job=false;prior.status='REVIEW_REQUIRED';
    prior.next_action='Reconcile shared Job ID across canonical opportunities';}
  } else if(job)jobOwner.set(job,opportunity);
  if(job&&!linkedJob)exceptions.push('JOB_LINK_UNVERIFIED:'+opportunity);
  if(executionsForJob.length>1)exceptions.push('DUPLICATE_JOB_EXECUTION:'+job);
  if(accepted&&matchingQuotes.length>1)exceptions.push('AMBIGUOUS_ACCEPTED_QUOTE:'+opportunity);
  if(quoteMatches.some(q=>v(q.job_id)&&job&&v(q.job_id)!==job))
   exceptions.push('QUOTE_JOB_LINK_CONFLICT:'+opportunity);
  // Every opportunity is counted once; no unrelated row can create a conversion.
  addCount(source,'opportunities');
  if(quoted)addCount(source,'quoted');
  if(accepted)addCount(source,'accepted');
  if(linkedJob)addCount(source,'linked_jobs');
  records.push({
   id:opportunity,client_crm_id:crm,source,
   matched_inbound_events:linkedInbound.length,
   inbound_link_state:linkedInbound.length?'MATCHED':'NOT_VERIFIED',
   original_origin:v(client.record_origin),
   provenance:provenance.kind,quote_count:validQuotes.length,
   quoted,accepted,job_id:job,linked_job:linkedJob,
   status:job&&!linkedJob?'REVIEW_REQUIRED':linkedJob?'LINKED_JOB':
    accepted?'ACCEPTED_NO_VERIFIED_JOB':quoted?'QUOTED':'OPPORTUNITY_ONLY',
   next_action:job&&!linkedJob?'Reconcile quote, client, job and execution links':
    accepted&&!linkedJob?'Inspect signed acceptance and independently verified bank settlement':
    quoted&&!accepted?'Review quotation follow-up':'Qualify opportunity and confirm next commercial step',
   payment_status:'NOT_VERIFIED',profit_status:'NOT_VERIFIED'
  });
 }
 return {schema_version:'MAGOS_ATTRIBUTED_CONVERSION_V1',
  state:exceptions.length?'REVIEW_REQUIRED':'READ_ONLY_ATTRIBUTION',
  counts:{opportunities:records.length,quoted:records.filter(r=>r.quoted).length,
   accepted:records.filter(r=>r.accepted).length,linked_jobs:records.filter(r=>r.linked_job).length,
   source_exceptions:exceptions.length,
   inbound_linked_opportunities:records.filter(r=>r.inbound_link_state==='MATCHED').length},
  by_source:[...sourceSummary.values()].map(group=>({
   ...group,linked_jobs:records.filter(r=>r.source===group.source&&r.linked_job).length
  })).sort((a,b)=>a.source.localeCompare(b.source)),
  records,exceptions:[...new Set(exceptions)],
  payment_authorized:false,revenue_verified:false,
  writes:[],side_effects:false};
}
module.exports={inspectAttributedConversions};
