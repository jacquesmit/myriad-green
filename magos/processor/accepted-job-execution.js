'use strict';
const {planAcceptedJob}=require('./accepted-quote-job-plan');
const {buildJobPaymentPreconditions}=require('./job-payment-commit-preconditions');
const text=v=>String(v??'').trim();
const {createHash}=require('node:crypto');
const receiptPrefix='JOB_CREATE_RECEIPT_V1:';
function receiptFingerprint({quoteId,jobId,sourceEventId,att,scope,clientId}){
 return receiptPrefix+createHash('sha256').update(JSON.stringify([
 quoteId,jobId,sourceEventId,att.opportunity_id,att.acceptance_evidence,
 att.quote_version||null,att.quote_version_verified===true,scope,clientId,
 att.payment_control_id,att.bank_clearance_confirmation_id,att.bank_confirmation_source,
 att.bank_confirmed_amount_cents,att.bank_deposit_required_cents,
 [...(att.allocation_ids||[])].sort(),[...(att.payment_event_ids||[])].sort()
 ])).digest('hex');
}
const review=reason_code=>({state:'REVIEW_REQUIRED',reason_code,writes:[],side_effects:false});
async function checkCommittedReplay({writer,quoteId,jobId,sourceEventId,att}){
 if(!writer.audit?.findByKey)return null;
 const key='MAGOS_JOB_CREATE_V1|'+sourceEventId+'|'+quoteId;
 const receipt=(await writer.audit.findByKey('Automation_Run_Log','idempotency_key',key))?.object;
 if(!receipt)return null;
 if(receipt.run_state!=='COMMITTED')return ['RUNNING','REVIEW_REQUIRED'].includes(receipt.run_state)?review('JOB_RECEIPT_NOT_COMMITTED'):null;
 if(!text(receipt.input_scope).startsWith(receiptPrefix))return review('LEGACY_JOB_RECEIPT_UNBOUND');
 const stores=writer.stores;
 const [quoteRows,jobRows,executionRows]=await Promise.all([
 stores.commercial.readObjects('Quotes',{maxRows:null}),
 stores.crm.readObjects('Jobs_Opportunities',{maxRows:null}),
 stores.commercial.readObjects('Job Execution',{maxRows:null})
 ]);
 const quotes=quoteRows.filter(r=>text(r.quote_id)===quoteId);
 const jobs=jobRows.filter(r=>text(r.opportunity_id)===att.opportunity_id||text(r.job_id)===jobId);
 const executionId='EXEC-'+jobId.slice(4);
 const executions=executionRows.filter(r=>text(r['Execution ID'])===executionId||text(r['Job ID'])===jobId||text(r.quote_id)===quoteId||text(r.opportunity_id)===att.opportunity_id);
 if(quotes.length!==1||jobs.length!==1||executions.length!==1)return review('JOB_REPLAY_CANONICAL_LINK_NOT_UNIQUE');
 const [quote]=quotes,[job]=jobs,[execution]=executions;
 const scope=text(quote['Project / Scope']),clientId=text(job.client_crm_id);
 if(!scope||!clientId||text(quote.opportunity_id)!==att.opportunity_id||
 text(job.opportunity_id)!==att.opportunity_id||text(job.job_id)!==jobId||
 text(execution['Execution ID'])!==executionId||text(execution['Job ID'])!==jobId||
 text(execution.opportunity_id)!==att.opportunity_id||text(execution.quote_id)!==quoteId||
 text(execution['CRM ID'])!==clientId||text(execution['Accepted Scope'])!==scope)
 return review('JOB_REPLAY_CANONICAL_LINK_MISMATCH');
 if(receipt.input_scope!==receiptFingerprint({quoteId,jobId,sourceEventId,att,scope,clientId})||
 text(receipt.evidence_link)!==att.acceptance_evidence)
 return review('JOB_REPLAY_RECEIPT_MISMATCH');
 const finance=await buildJobPaymentPreconditions({stores,opportunityId:att.opportunity_id,authority:att});
 if(finance.state!=='FINANCIAL_PRECONDITIONS_READY')return review(finance.reason_code);
 return {state:'DUPLICATE_NO_OP',job_id:jobId,execution_id:executionId,
 readback:{verified:true,scope:'IMMUTABLE_JOB_LINKS_ONLY'},current_job_readiness:'NOT_ASSESSED',writes:[],side_effects:false};
}
/** Separate operator authentication from durable business authorization.
 * Server-side verifier must source acceptance and clearance from authoritative evidence.
 */
async function executeAcceptedJob({writer,quoteId,jobId,sourceEventId,authorityVerifier,dryRun=false}={}){
 if(!writer?.execute||!writer?.stores)throw Error('P3_WRITER_REQUIRED');
 if(typeof authorityVerifier!=='function')return {state:'REVIEW_REQUIRED',reason_code:'JOB_AUTHORITY_NOT_CONFIGURED'};
 const att=await authorityVerifier({quoteId,jobId,sourceEventId});
 if(att?.verified!==true||att.quote_id!==quoteId||att.job_id!==jobId||att.source_event_id!==sourceEventId||
 !text(att.acceptance_evidence)||att.payment_clearance!=='CLEARED')return {state:'REVIEW_REQUIRED',reason_code:att?.reason_code||'JOB_AUTHORITY_NOT_VERIFIED'};
 if(![quoteId,jobId,sourceEventId].every(v=>typeof v==='string'&&v===v.trim()&&v.length>0&&!v.includes('|'))||!jobId.startsWith('JOB-')||jobId.length<=4)return review('INVALID_JOB_REPLAY_IDENTIFIERS');
 let replay;
 try{replay=await checkCommittedReplay({writer,quoteId,jobId,sourceEventId,att});}
 catch{return review('JOB_REPLAY_SOURCE_UNAVAILABLE');}
 if(replay)return replay;
 const result=await planAcceptedJob({stores:writer.stores,quoteId,jobId,sourceEventId,acceptanceEvidence:att.acceptance_evidence,paymentClearance:att.payment_clearance});
 if(result.state!=='READY_FOR_GOVERNED_JOB_CREATION')return result;
 if(att.opportunity_id!==result.readiness.opportunity_id)
  return {state:'REVIEW_REQUIRED',reason_code:'ATTESTED_OPPORTUNITY_MISMATCH'};
 const finance=await buildJobPaymentPreconditions({stores:writer.stores,
  opportunityId:result.readiness.opportunity_id,authority:att});
 if(finance.state!=='FINANCIAL_PRECONDITIONS_READY')
  return {state:'REVIEW_REQUIRED',reason_code:finance.reason_code};
 result.plan.preconditions.push(...finance.preconditions);
 const execution=result.plan.writes.find(w=>w.sheet==='Job Execution')?.values;
 result.plan.input_scope=receiptFingerprint({quoteId,jobId,sourceEventId,att,scope:text(execution?.['Accepted Scope']),clientId:text(execution?.['CRM ID'])});
 if(dryRun)return {state:'DRY_RUN',job_id:jobId,readiness:result.readiness,plan:result.plan};
 const committed=await writer.execute(result.plan);
 if(committed?.state==='DUPLICATE_NO_OP'){
  try{return await checkCommittedReplay({writer,quoteId,jobId,sourceEventId,att})||review('JOB_REPLAY_RECEIPT_UNAVAILABLE');}
  catch{return review('JOB_REPLAY_SOURCE_UNAVAILABLE');}
 }
 if(committed?.state!=='COMMITTED')
  return {state:committed?.state||'REVIEW_REQUIRED',job_id:jobId,transaction:committed,execution_id:result.execution_id};
 const {verifyJobReadback}=require('./job-commit-readback');
 const crmWrite=result.plan.writes?.find(w=>w.store==='crm' && w.sheet==='Jobs_Opportunities');
 const executionWrite=result.plan.writes?.find(w=>w.store==='commercial' && w.sheet==='Job Execution');
 const readback=await verifyJobReadback({stores:writer.stores,jobId,
  opportunityId:result.readiness.opportunity_id,executionId:result.execution_id,quoteId,
  expectedJobChanges:crmWrite?.changes,
  expectedExecutionValues:executionWrite?.values});
 return {state:readback.verified?committed.state:'COMMIT_READBACK_UNVERIFIED',job_id:jobId,transaction:committed,execution_id:result.execution_id,readback};
}
module.exports={executeAcceptedJob};
