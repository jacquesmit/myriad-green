'use strict';

// One business-transaction view of the existing canonical MAGOS records.
// Reads only: never creates jobs, bookings, clearance, invoices, or messages.
const {inspectDepositEvidence}=require('./deposit-evidence-inspection');
const {inspectSchedulingReadiness}=require('./scheduling-readiness');
const {inspectOperationalClosure}=require('./operational-closure');
const v=x=>String(x??'').trim();
const up=x=>v(x).toUpperCase();
const complete=new Set(['COMPLETED','JOB_COMPLETED','HANDOVER_COMPLETE','CLOSED']);
const fail=(jobId,reason)=>({
 schema_version:'MAGOS_JOB_LIFECYCLE_V1',job_id:v(jobId),state:'REVIEW_REQUIRED',
 next_action:'Reconcile exact canonical job, execution and quotation identities',
 blockers:[reason],stages:[],production_complete:false,
 independent_bank_confirmation:false,writes:[],side_effects:false
});

async function inspectJobLifecycle({stores,jobId,asOf}={}){
 if(!v(jobId)||!stores?.crm?.readObjects||!stores?.commercial?.readObjects||
    !stores?.commercial?.findByKey||!stores?.supplier?.readObjects)
   return fail(jobId,'CANONICAL_LIFECYCLE_SOURCE_UNAVAILABLE');
 let jobs,executions;
 try{
  [jobs,executions]=await Promise.all([
   stores.crm.readObjects('Jobs_Opportunities',{maxRows:null}),
   stores.commercial.readObjects('Job Execution',{maxRows:null})
  ]);
 }catch{return fail(jobId,'CANONICAL_LIFECYCLE_SOURCE_UNAVAILABLE');}
 if(!Array.isArray(jobs)||!Array.isArray(executions))
  return fail(jobId,'CANONICAL_LIFECYCLE_SOURCE_INVALID');
 const matchingJobs=jobs.filter(r=>v(r.job_id)===jobId);
 const matchingExecutions=executions.filter(r=>v(r['Job ID'])===jobId);
 if(matchingJobs.length!==1||matchingExecutions.length!==1)
  return fail(jobId,'CANONICAL_JOB_EXECUTION_NOT_UNIQUE');
 const job=matchingJobs[0],execution=matchingExecutions[0];
 const opportunityId=v(job.opportunity_id),quoteId=v(execution.quote_id);
 if(!opportunityId||!quoteId||v(execution.opportunity_id)!==opportunityId||
    !v(job.client_crm_id)||v(execution['CRM ID'])!==v(job.client_crm_id))
   return fail(jobId,'CANONICAL_OPPORTUNITY_QUOTE_CLIENT_LINK_MISMATCH');
 let quote;
 try{
  quote=(await stores.commercial.findByKey('Quotes','quote_id',quoteId))?.object;
 }catch{return fail(jobId,'CANONICAL_QUOTE_UNAVAILABLE');}
 if(!quote||v(quote.opportunity_id)!==opportunityId)
  return fail(jobId,'CANONICAL_QUOTE_LINK_MISMATCH');
 const stages=[],blockers=[],actions=[];
 const record=(name,state,reason,nextAction)=>{
  stages.push({name,state,reason_code:reason||null});
  if(state!=='PASS'){
   blockers.push(name+':'+(reason||'UNVERIFIED'));
   if(nextAction)actions.push(nextAction);
  }
 };
 const quoteReady=up(quote['Quote Status'])==='ACCEPTED' &&
    ['PASS','LINE_CONTROL_OK'].includes(up(quote['Line Control State'])) &&
    v(execution['Accepted Scope'])!=='' &&
    v(execution['Accepted Scope'])===v(quote['Project / Scope']);
 record('ACCEPTED_QUOTE',quoteReady?'PASS':'REVIEW_REQUIRED',
  quoteReady?'':'ACCEPTED_QUOTE_VERSION_OR_SCOPE_UNVERIFIED',
  'Resolve accepted quote, approved line control and matching execution scope');
 const jobReady=up(job.job_status)!=='CANCELLED' &&
    ['JOB_CREATED','SCHEDULED','IN_PROGRESS','COMPLETED','JOB_COMPLETED','CLOSED'].includes(up(job.job_status));
 record('CANONICAL_JOB',jobReady?'PASS':'REVIEW_REQUIRED',
  jobReady?'':'JOB_STATUS_UNVERIFIED','Reconcile CRM job lifecycle state');
 let deposit;
 try{deposit=await inspectDepositEvidence({stores,opportunityId});}
 catch{deposit={state:'REVIEW_REQUIRED',reason_code:'DEPOSIT_SOURCE_UNAVAILABLE'};}
 const ledgerEvidenced=deposit.state==='CLEARED_ALLOCATION_EVIDENCED';
 record('RECORDED_DEPOSIT',ledgerEvidenced?'EVIDENCED_ONLY':'REVIEW_REQUIRED',
  ledgerEvidenced?'INDEPENDENT_BANK_CONFIRMATION_NOT_INCLUDED':
    deposit.reason_code||'DEPOSIT_NOT_RECONCILED',
  'Reconcile payment events and obtain independently verified bank settlement');
 const isComplete=complete.has(up(job.job_status))||
    complete.has(up(execution['Completion Status']));
 let next;
 if(isComplete){
  try{next=await inspectOperationalClosure({stores,jobId,asOf});}
  catch{next={state:'REVIEW_REQUIRED',blockers:['OPERATIONAL_CLOSEOUT_SOURCE_UNAVAILABLE']};}
  record('CLOSEOUT',next.state==='READY_FOR_OWNER_CLOSURE_REVIEW'?'OWNER_REVIEW':'REVIEW_REQUIRED',
   next.state==='READY_FOR_OWNER_CLOSURE_REVIEW'?'INDEPENDENT_OWNER_RELEASE_REQUIRED':
    (next.blockers||[]).join(',')||'CLOSEOUT_UNVERIFIED',
   'Resolve field evidence, true costs, issued invoice, receivables and owner closeout');
 }else{
  try{next=await inspectSchedulingReadiness({stores,jobId});}
  catch{next={state:'REVIEW_REQUIRED',blockers:['SCHEDULING_SOURCE_UNAVAILABLE']};}
  record('SCHEDULING',next.state==='READY_FOR_PROVIDER_AVAILABILITY_CHECK'?'PROVIDER_CHECK_REQUIRED':'REVIEW_REQUIRED',
    next.state==='READY_FOR_PROVIDER_AVAILABILITY_CHECK'?'PROVIDER_CALENDAR_AVAILABILITY_NOT_VERIFIED':
    [...(next.blockers||[]),...(next.review_reasons||[])].join(',')||'SCHEDULING_UNVERIFIED',
    'Resolve deposit, procurement, stock, crew and provider availability before booking');
 }
 return {
  schema_version:'MAGOS_JOB_LIFECYCLE_V1',job_id:jobId,quote_id:quoteId,
  opportunity_id:opportunityId,client_crm_id:v(job.client_crm_id),
  state:'REVIEW_REQUIRED',phase:isComplete?'CLOSEOUT':'DELIVERY',
  next_action:actions[0]||'Obtain independent bank confirmation and owner release',
  blockers,stages,
  deposit:{state:deposit.state,independent_bank_confirmation:false},
  operational:{state:next.state},
  production_complete:false,independent_bank_confirmation:false,
  job_close_authorized:false,booking_authorized:false,
  writes:[],side_effects:false
 };
}
module.exports={inspectJobLifecycle};
