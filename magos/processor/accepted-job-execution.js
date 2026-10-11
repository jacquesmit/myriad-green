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
 return {state:committed.state,job_id:jobId,transaction:committed,execution_id:result.execution_id};
}
module.exports={executeAcceptedJob};
