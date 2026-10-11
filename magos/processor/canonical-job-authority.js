'use strict';
const {verifySignedAcceptance}=require('./signed-acceptance-verification');
const {inspectDepositEvidence}=require('./deposit-evidence-inspection');
/**
 * Resolve server-owned financial and signing evidence for P3 job release.
 * Provider confirmation must be independently verified; this never accepts a
 * payment status or evidence reference from the HTTP caller.
 */
function createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier}={}){
 return async({quoteId,jobId,sourceEventId}={})=>{
  if(!stores?.commercial?.findByKey||typeof acceptanceVerifier!=='function')
   return {verified:false,reason_code:'CANONICAL_JOB_AUTHORITY_NOT_CONFIGURED'};
  const signed=await verifySignedAcceptance({stores,quoteId,evidenceVerifier:acceptanceVerifier});
  if(signed.state!=='SIGNED_ACCEPTANCE_VERIFIED')return {verified:false,reason_code:signed.reason_code||'SIGNED_ACCEPTANCE_NOT_VERIFIED'};
  if(signed.source_event_id!==sourceEventId)return {verified:false,reason_code:'SIGNED_EVENT_ID_MISMATCH'};
  const deposit=await inspectDepositEvidence({stores,opportunityId:signed.opportunity_id});
  if(deposit.state!=='CLEARED_ALLOCATION_EVIDENCED')
   return {verified:false,reason_code:deposit.reason_code||'DEPOSIT_NOT_CLEARED'};
  return {verified:true,quote_id:quoteId,job_id:jobId,source_event_id:sourceEventId,
   acceptance_evidence:signed.evidence_ref,payment_clearance:'CLEARED',
   payment_control_id:deposit.control_id,allocation_ids:deposit.allocation_ids};
 };
}
module.exports={createCanonicalJobAuthorityVerifier};
