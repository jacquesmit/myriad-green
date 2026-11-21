'use strict';

// Preparation-only approval gate for integration with existing MAGOS audit/authority.
// A caller must supply receipts read independently from the canonical approval source.
// No AI payload may become the authoritative approval. NO execution occurs here.
const { timingSafeEqual } = require('node:crypto');

function same(a,b) {
  const x=Buffer.from(String(a??''));
  const y=Buffer.from(String(b??''));
  return x.length>0 && x.length===y.length && timingSafeEqual(x,y);
}
function verifyAgentApproval(plan, { receipt, liveAuthority, now = new Date() } = {}) {
  const blockers=[];
  if (!plan || plan.schema_version!=='MAGOS_AGENT_PLAN_V2' || plan.state==='BLOCKED') {
    blockers.push('INVALID_OR_BLOCKED_PLAN');
  }
  if (!receipt || typeof receipt !== 'object' || receipt.origin!=='CANONICAL_APPROVAL_STORE') {
    blockers.push('CANONICAL_APPROVAL_MISSING');
  }
  if (!liveAuthority || typeof liveAuthority!=='object' || liveAuthority.verified!==true) {
    blockers.push('LIVE_AUTHORITY_NOT_VERIFIED');
  }
  if (!same(receipt?.plan_idempotency_key,plan?.idempotency_key)) blockers.push('APPROVAL_PLAN_MISMATCH');
  for(const field of ['tenant_id','jurisdiction_id','branch_id','canonical_record_id','job_type_id']) {
    if (!same(receipt?.[field],plan?.[field])) blockers.push('APPROVAL_SCOPE_MISMATCH');
  }
  if (!same(liveAuthority?.owner_agent_id,plan?.agent_id) ||
      !same(liveAuthority?.job_type_id,plan?.job_type_id)) {
    blockers.push('LIVE_OWNER_MISMATCH');
  }
  if (liveAuthority?.permissions_verified!==true) blockers.push('PERMISSIONS_NOT_VERIFIED');
  if (liveAuthority?.snapshot_matches_current!==true) blockers.push('STALE_ALLOCATION_SNAPSHOT');
  if (liveAuthority?.source_freshness_verified!==true) blockers.push('STALE_SOURCE');
  if (!same(receipt?.status,'APPROVED') || !receipt?.approval_id ||
      !receipt?.evidence_ref) blockers.push('APPROVAL_EVIDENCE_MISSING');
  if (!receipt?.approved_by || receipt.approved_by===plan?.agent_id ||
      receipt.approved_by===receipt?.implemented_by) blockers.push('SELF_APPROVAL');
  const expiresAt=Date.parse(receipt?.expires_at||'');
  const approvedAt=Date.parse(receipt?.approved_at||'');
  const current=now instanceof Date ? now.valueOf() : NaN;
  if (!Number.isFinite(expiresAt)||!Number.isFinite(approvedAt)||
      !Number.isFinite(current)||approvedAt>current||
      expiresAt<=current||expiresAt<=approvedAt) blockers.push('APPROVAL_EXPIRED_OR_INVALID');
  if (receipt?.used===true || receipt?.replayed===true) blockers.push('APPROVAL_REPLAY');
  if (!receipt?.approval_receipt_validated_by_trusted_adapter) {
    blockers.push('APPROVAL_PROVENANCE_NOT_VERIFIED');
  }
  return Object.freeze({
    schema_version:'MAGOS_AGENT_APPROVAL_CHECK_V1',
    plan_idempotency_key:plan?.idempotency_key||'',
    status:blockers.length?'BLOCKED':'ELIGIBLE_FOR_GOVERNED_EVENT_REVIEW',
    blockers:[...new Set(blockers)],
    execution_authorized:false,
    next_boundary:'GOVERNED_EVENT_RUNNER'
  });
}
module.exports={verifyAgentApproval};
