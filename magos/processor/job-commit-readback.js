'use strict';
const v=x=>String(x??'').trim();
/** Independently confirm the same job ID and opportunity in both authoritative stores. */
async function verifyJobReadback({stores,jobId,opportunityId,executionId,quoteId}={}){
 if(!stores?.crm?.findByKey||!stores?.commercial?.findByKey)
  return {verified:false,reason_code:'CANONICAL_READBACK_UNAVAILABLE'};
 const [jobRecord,executionRecord]=await Promise.all([
  stores.crm.findByKey('Jobs_Opportunities','opportunity_id',opportunityId),
  stores.commercial.findByKey('Job Execution','Execution ID',executionId)
 ]);
 const job=jobRecord?.object,execution=executionRecord?.object;
 if(!job||!execution)return {verified:false,reason_code:'CANONICAL_JOB_READBACK_MISSING'};
 if(v(job.job_id)!==jobId||v(execution['Job ID'])!==jobId||
 v(execution.opportunity_id)!==opportunityId||v(execution.quote_id)!==quoteId)
  return {verified:false,reason_code:'CANONICAL_JOB_READBACK_MISMATCH'};
 return {verified:true,job_id:jobId,opportunity_id:opportunityId,execution_id:executionId,quote_id:quoteId};
}
module.exports={verifyJobReadback};
