'use strict';
const {assessQuoteToJob}=require('./quote-to-job-readiness');
const {createJobFromAcceptedScope}=require('../writer/operations');
const v=x=>String(x??'').trim();
/* Canonical read-only planning; no caller assertion can establish acceptance or payment. */
async function planAcceptedJob({stores,quoteId,jobId,sourceEventId,acceptanceEvidence,paymentClearance}={}){
 if(!stores?.commercial?.findByKey||!stores?.crm?.findByKey)throw Error('CANONICAL_STORES_REQUIRED');
 if(![quoteId,jobId,sourceEventId].every(v))return {state:'REVIEW_REQUIRED',reason_code:'CANONICAL_IDENTIFIERS_REQUIRED'};
 const quote=(await stores.commercial.findByKey('Quotes','quote_id',quoteId))?.object;
 if(!quote)return {state:'REVIEW_REQUIRED',reason_code:'QUOTE_NOT_FOUND'};
 if(!v(quote.opportunity_id))return {state:'REVIEW_REQUIRED',reason_code:'QUOTE_OPPORTUNITY_ID_MISSING'};
 const opportunity=(await stores.crm.findByKey('Jobs_Opportunities','opportunity_id',quote.opportunity_id))?.object;
 const readiness=assessQuoteToJob({quote,job:opportunity,acceptanceEvidence,paymentClearance});
 if(readiness.decision!=='READY_FOR_GOVERNED_JOB_CREATION')return {state:readiness.decision,readiness};
 if(!v(jobId).startsWith('JOB-'))return {state:'REVIEW_REQUIRED',reason_code:'INVALID_JOB_ID'};
 const existing=(await stores.commercial.findByKey('Job Execution','Job ID',jobId))?.object;
 const existingOpportunityExecution=typeof stores.commercial.readObjects==='function'?(await stores.commercial.readObjects('Job Execution')).find(r=>v(r.opportunity_id)===v(quote.opportunity_id)||v(r.quote_id)===v(quoteId)):null;
 if(existingOpportunityExecution)return {state:'REVIEW_REQUIRED',reason_code:'OPPORTUNITY_EXECUTION_ALREADY_EXISTS'};
 if(existing)return {state:'REVIEW_REQUIRED',reason_code:'JOB_EXECUTION_ALREADY_EXISTS'};
 const executionId='EXEC-'+jobId.slice(4);
 const plan=createJobFromAcceptedScope({
   idempotency_key:'MAGOS_JOB_CREATE_V1|'+sourceEventId+'|'+quoteId,
   source_event_id:sourceEventId,evidence_link:acceptanceEvidence,
   quote_preconditions:[{store:'commercial',sheet:'Quotes',key:{header:'quote_id',value:quoteId},expect:{'Quote Status':'ACCEPTED','Line Control State':'PASS',opportunity_id:quote.opportunity_id}}],
   job_target:{store:'crm',workbook_role:'CRM_MASTER',sheet:'Jobs_Opportunities',key:{header:'opportunity_id',value:quote.opportunity_id},authority:'AUTHORITATIVE',entity_type:'Job'},
   job_changes:{job_id:jobId,job_status:'JOB_CREATED'},
   execution_target:{store:'commercial',workbook_role:'COMMERCIAL',sheet:'Job Execution',key:{header:'Execution ID',value:executionId},link_id:quote.opportunity_id},
   execution_values:{'Execution ID':executionId,'Job ID':jobId,opportunity_id:quote.opportunity_id,quote_id:quoteId,'CRM ID':v(opportunity.client_crm_id),'Client':v(opportunity.client_name),'Site Address':v(opportunity.site_address),'Service':v(opportunity.primary_service),'Accepted Scope':v(quote['Project / Scope']),'Deposit Cleared':'CLEARED','Job Status':'JOB_CREATED','Schedule Status':'TO_SCHEDULE','Next Action':'Confirm date and crew'}
 });
 return {state:'READY_FOR_GOVERNED_JOB_CREATION',readiness,job_id:jobId,execution_id:executionId,plan};
}
module.exports={planAcceptedJob};
