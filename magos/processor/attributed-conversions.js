'use strict';
// Canonical, read-only source attribution through real opportunity/quote/job links.
// A scraped contact is NOT a lead. Job status and proof of payment are different.
const {classifyCrmProvenance}=require('./lead-provenance');
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
function inspectAttributedConversions({clients,opportunities,quotes,executions}={}){
 if(![clients,opportunities,quotes,executions].every(Array.isArray))
  return {schema_version:'MAGOS_ATTRIBUTED_CONVERSION_V1',
   state:'UNAVAILABLE',reason_code:'CANONICAL_CONVERSION_SOURCES_UNAVAILABLE',
   records:[],by_source:[],exceptions:[],writes:[],side_effects:false};
 const clientIdx=index(clients,'crm_id');
 const opportunityIdx=index(opportunities,'opportunity_id');
 const quoteIdx=index(quotes,'quote_id');
 const executionIdx=index(executions,'Execution ID');
 const exceptions=[...clientIdx.invalid,...opportunityIdx.invalid,
   ...quoteIdx.invalid,...executionIdx.invalid];
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
   source_exceptions:exceptions.length},
  by_source:[...sourceSummary.values()].map(group=>({
   ...group,linked_jobs:records.filter(r=>r.source===group.source&&r.linked_job).length
  })).sort((a,b)=>a.source.localeCompare(b.source)),
  records,exceptions:[...new Set(exceptions)],
  payment_authorized:false,revenue_verified:false,
  writes:[],side_effects:false};
}
module.exports={inspectAttributedConversions};
