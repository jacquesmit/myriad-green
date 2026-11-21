'use strict';

// Preparation-only approval gate: trusted storage adapters are injected by
// MAGOS server code, not constructed from an AI/client payload.
// This gate NEVER grants execution or writes to business authority.
const { timingSafeEqual } = require('node:crypto');

function same(a,b) {
  const x=Buffer.from(String(a??''));
  const y=Buffer.from(String(b??''));
  return x.length>0 && x.length===y.length && timingSafeEqual(x,y);
}

async function verifyAgentApproval(plan,{ loadReceipt, loadAuthority, now = new Date() }={}) {
  const blockers=[];
  if (!plan || plan.schema_version!=='MAGOS_AGENT_PLAN_V2' || plan.state==='BLOCKED') {
    blockers.push('INVALID_OR_BLOCKED_PLAN');
  }
  if (typeof loadReceipt !== 'function' || typeof loadAuthority !== 'function') {
    return Object.freeze({
      schema_version:'MAGOS_AGENT_APPROVAL_CHECK_V1',
      plan_idempotency_key:plan?.idempotency_key||'',
      status:'BLOCKED',blockers:['TRUSTED_READERS_NOT_CONFIGURED'],
      execution_authorized:false,next_boundary:'GOVERNED_EVENT_RUNNER'
    });
  }
  let receipt,liveAuthority;
  try {
    // Both values are retrieved from server-owned trusted readers. A user
    // object containing "approved":true is never read by this function.
    [receipt,liveAuthority]=await Promise.all([
      loadReceipt(plan?.idempotency_key),loadAuthority({
        job_type_id:plan?.job_type_id,
        tenant_id:plan?.tenant_id,
        jurisdiction_id:plan?.jurisdiction_id,
        branch_id:plan?.branch_id
      })
    ]);
  } catch {
    blockers.push('TRUSTED_AUTHORITY_READ_FAILURE');
  }
  if (!receipt || typeof receipt !== 'object') blockers.push('CANONICAL_APPROVAL_MISSING');
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
  if (receipt?.revoked===true) blockers.push('APPROVAL_REVOKED');
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
