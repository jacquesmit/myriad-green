'use strict';
const v=x=>String(x??'').trim();

/** Read-back of the exact CRM and Commercial write contract; never infer
 * completion or clearance from a P3 COMMITTED response alone.
 */
async function verifyJobReadback({stores,jobId,opportunityId,executionId,quoteId,
 expectedJobChanges,expectedExecutionValues}={}){
 if(!stores?.crm?.findByKey||!stores?.commercial?.findByKey)
  return {verified:false,reason_code:'CANONICAL_READBACK_UNAVAILABLE'};
 if(![jobId,opportunityId,executionId,quoteId].every(v))
  return {verified:false,reason_code:'CANONICAL_READBACK_IDENTIFIERS_REQUIRED'};
 let jobRecord,executionRecord;
 try{
  [jobRecord,executionRecord]=await Promise.all([
   stores.crm.findByKey('Jobs_Opportunities','opportunity_id',opportunityId),
   stores.commercial.findByKey('Job Execution','Execution ID',executionId)
  ]);
 }catch{
  return {verified:false,reason_code:'CANONICAL_READBACK_SOURCE_ERROR'};
 }
 const job=jobRecord?.object,execution=executionRecord?.object;
 if(!job||!execution)return {verified:false,reason_code:'CANONICAL_JOB_READBACK_MISSING'};
 if(v(job.job_id)!==jobId||v(job.opportunity_id)!==opportunityId||
    v(execution['Execution ID'])!==executionId||
    v(execution['Job ID'])!==jobId||
    v(execution.opportunity_id)!==opportunityId||
    v(execution.quote_id)!==quoteId)
  return {verified:false,reason_code:'CANONICAL_JOB_READBACK_MISMATCH'};

 // Bind the read-back to the actual previously compiled writer inputs:
 // approved scope, CRM ID, deposit status and scheduling state cannot drift.
 if(!expectedJobChanges || !expectedExecutionValues ||
    typeof expectedJobChanges!=='object'||typeof expectedExecutionValues!=='object')
  return {verified:false,reason_code:'CANONICAL_WRITE_EXPECTATIONS_MISSING'};
 const jobFields=['job_id','job_status'];
 const executionFields=['Execution ID','Job ID','opportunity_id','quote_id','CRM ID',
  'Accepted Scope','Deposit Cleared','Job Status','Schedule Status'];
 for(const field of jobFields){
  if(!v(expectedJobChanges[field])||v(job[field])!==v(expectedJobChanges[field]))
   return {verified:false,reason_code:'CANONICAL_JOB_READBACK_FIELD_MISMATCH',field};
 }
 for(const field of executionFields){
  if(!v(expectedExecutionValues[field])||
      v(execution[field])!==v(expectedExecutionValues[field]))
   return {verified:false,reason_code:'CANONICAL_EXECUTION_READBACK_FIELD_MISMATCH',field};
 }
 if(!v(job.client_crm_id)||
    v(job.client_crm_id)!==v(execution['CRM ID']))
  return {verified:false,reason_code:'CANONICAL_CLIENT_LINK_READBACK_MISMATCH'};
 return {verified:true,job_id:jobId,opportunity_id:opportunityId,
  execution_id:executionId,quote_id:quoteId};
}
module.exports={verifyJobReadback};
