'use strict';
const {verifySignedAcceptance}=require('./signed-acceptance-verification');
const {inspectDepositEvidence}=require('./deposit-evidence-inspection');
/**
 * Resolve server-owned financial and signing evidence for P3 job release.
 * Provider confirmation must be independently verified; this never accepts a
 * payment status or evidence reference from the HTTP caller.
 */
function createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier,bankClearanceVerifier}={}){
 return async({quoteId,jobId,sourceEventId}={})=>{
  if(!stores?.commercial?.findByKey||typeof acceptanceVerifier!=='function')
   return {verified:false,reason_code:'CANONICAL_JOB_AUTHORITY_NOT_CONFIGURED'};
  const signed=await verifySignedAcceptance({stores,quoteId,evidenceVerifier:acceptanceVerifier});
  if(signed.state!=='SIGNED_ACCEPTANCE_VERIFIED')return {verified:false,reason_code:signed.reason_code||'SIGNED_ACCEPTANCE_NOT_VERIFIED'};
  if(signed.source_event_id!==sourceEventId)return {verified:false,reason_code:'SIGNED_EVENT_ID_MISMATCH'};
  const deposit=await inspectDepositEvidence({stores,opportunityId:signed.opportunity_id});
  if(deposit.state!=='CLEARED_ALLOCATION_EVIDENCED')
   return {verified:false,reason_code:deposit.reason_code||'DEPOSIT_NOT_CLEARED'};
  // The internal Payment_Events register is an accounting source, NOT an
  // independent bank/provider. An authenticated external settlement reviewer
  // must bind the same exact events, opportunity and confirmed cents.
  if(typeof bankClearanceVerifier!=='function')
   return {verified:false,reason_code:'INDEPENDENT_BANK_CLEARANCE_AUTHORITY_NOT_CONFIGURED'};
  let bank;
  try{
   bank=await bankClearanceVerifier({
    control_id:deposit.control_id,opportunity_id:signed.opportunity_id,
    job_id:jobId,
    payment_event_ids:[...deposit.payment_event_ids],
    allocation_ids:[...deposit.allocation_ids],
    expected_amount_cents:Math.round(deposit.cleared_deposit_total*100),
    deposit_required_cents:Math.round(deposit.deposit_required*100),
    evidence_links:[...deposit.evidence_links]
   });
  }catch{return {verified:false,reason_code:'INDEPENDENT_BANK_CLEARANCE_AUTHORITY_UNAVAILABLE'};}
  const exactEventSet=Array.isArray(bank?.payment_event_ids)&&
   bank.payment_event_ids.length===deposit.payment_event_ids.length&&
   new Set(bank.payment_event_ids).size===deposit.payment_event_ids.length&&
   bank.payment_event_ids.every(e=>deposit.payment_event_ids.includes(e));
  if(bank?.verified!==true||bank.control_id!==deposit.control_id||
   bank.opportunity_id!==signed.opportunity_id||
   bank.job_id!==jobId||bank.settlement_status!=='CLEARED'||
   !['BANK','PAYMENT_PROVIDER'].includes(bank.source_authority)||
   !String(bank.confirmation_id||'').trim()||
   bank.confirmed_amount_cents!==Math.round(deposit.cleared_deposit_total*100)||
   !exactEventSet)
   return {verified:false,reason_code:'INDEPENDENT_BANK_SETTLEMENT_AND_ALLOCATIONS_NOT_VERIFIED'};
  return {verified:true,quote_id:quoteId,job_id:jobId,opportunity_id:signed.opportunity_id,source_event_id:sourceEventId,
   acceptance_evidence:signed.evidence_ref,quote_version:signed.quote_version,quote_version_verified:signed.quote_version_verified,payment_clearance:'CLEARED',
   bank_clearance_confirmation_id:bank.confirmation_id,
   bank_confirmation_source:bank.source_authority,
   bank_confirmed_amount_cents:bank.confirmed_amount_cents,
   bank_deposit_required_cents:Math.round(deposit.deposit_required*100),
   payment_control_id:deposit.control_id,allocation_ids:deposit.allocation_ids,
   payment_event_ids:deposit.payment_event_ids};
 };
}
module.exports={createCanonicalJobAuthorityVerifier};
