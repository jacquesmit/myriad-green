'use strict';
const {planAcceptedJob}=require('./accepted-quote-job-plan');
const text=v=>String(v??'').trim();
/** Separate operator authentication from durable business authorization.
 * Server-side verifier must source acceptance and clearance from authoritative evidence.
 */
async function executeAcceptedJob({writer,quoteId,jobId,sourceEventId,authorityVerifier,dryRun=false}={}){
 if(!writer?.execute||!writer?.stores)throw Error('P3_WRITER_REQUIRED');
 if(typeof authorityVerifier!=='function')return {state:'REVIEW_REQUIRED',reason_code:'JOB_AUTHORITY_NOT_CONFIGURED'};
 const att=await authorityVerifier({quoteId,jobId,sourceEventId});
 if(att?.verified!==true||att.quote_id!==quoteId||att.job_id!==jobId||att.source_event_id!==sourceEventId||
 !text(att.acceptance_evidence)||att.payment_clearance!=='CLEARED')return {state:'REVIEW_REQUIRED',reason_code:att?.reason_code||'JOB_AUTHORITY_NOT_VERIFIED'};
 const result=await planAcceptedJob({stores:writer.stores,quoteId,jobId,sourceEventId,acceptanceEvidence:att.acceptance_evidence,paymentClearance:att.payment_clearance});
 if(result.state!=='READY_FOR_GOVERNED_JOB_CREATION')return result;
 if(dryRun)return {state:'DRY_RUN',job_id:jobId,readiness:result.readiness,plan:result.plan};
 const committed=await writer.execute(result.plan);
 if(committed?.state!=='COMMITTED' && committed?.state!=='DUPLICATE_NO_OP')
  return {state:committed?.state||'REVIEW_REQUIRED',job_id:jobId,transaction:committed,execution_id:result.execution_id};
 const {verifyJobReadback}=require('./job-commit-readback');
 const readback=await verifyJobReadback({stores:writer.stores,jobId,opportunityId:result.readiness.opportunity_id,executionId:result.execution_id,quoteId});
 return {state:readback.verified?committed.state:'COMMIT_READBACK_UNVERIFIED',job_id:jobId,transaction:committed,execution_id:result.execution_id,readback};
}
module.exports={executeAcceptedJob};
