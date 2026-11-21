'use strict';

// Pure planning layer: no network requests, writes, or tool invocation.
// Authoritative mutations must still pass the MAGOS governed event runner/writer.
const crypto = require('node:crypto');

const CATALOG = Object.freeze({
  SALES: { capabilities: ['LEAD_TRIAGE', 'FOLLOW_UP_DRAFT', 'QUOTE_REQUEST_REVIEW'] },
  MARKETING: { capabilities: ['SEO_AUDIT', 'REVIEW_REPLY_DRAFT', 'CAMPAIGN_ANALYSIS'] },
  OPERATIONS: { capabilities: ['JOB_TRIAGE', 'SCHEDULE_REVIEW', 'WORK_PROOF_REVIEW'] },
  FINANCE: { capabilities: ['PAYMENT_RECONCILIATION_REVIEW', 'INVOICE_DRAFT', 'QUOTE_COST_REVIEW'] },
  PROCUREMENT: { capabilities: ['SUPPLIER_PRICE_REVIEW', 'PURCHASE_REQUEST_REVIEW', 'PRODUCT_DATA_REVIEW'] },
  ENGINEERING: { capabilities: ['DEPLOYMENT_AUDIT', 'TEST_REPORT', 'CHANGE_PROPOSAL'] }
});

const HIGH_RISK = new Set([
  'SEND_EXTERNAL_MESSAGE', 'CHARGE_PAYMENT', 'RELEASE_PROCUREMENT',
  'CHANGE_PRICE', 'ISSUE_QUOTE', 'ISSUE_INVOICE',
  'DEPLOY_PRODUCTION', 'DELETE_RECORD', 'BOOK_JOB', 'WRITE_BUSINESS_RECORD'
]);
const VALID_EFFECTS = new Set(['READ', 'DRAFT', 'WRITE', ...HIGH_RISK]);
const VALID_STATES = new Set(['PROPOSED', 'AWAITING_APPROVAL', 'BLOCKED']);

function planAgentTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    throw new TypeError('task must be an object');
  }
  const capability = String(task.capability || '').trim().toUpperCase();
  const effect = String(task.effect || 'READ').trim().toUpperCase();
  const source = String(task.source || '').trim();
  const sourceEventId = String(task.source_event_id || '').trim();
  const evidence = Array.isArray(task.evidence_refs) ? task.evidence_refs : [];
  if (!capability || !source || !sourceEventId) {
    throw new Error('capability, source and source_event_id are required');
  }
  if (!VALID_EFFECTS.has(effect)) throw new Error('Unknown effect: ' + effect);
  if (!evidence.every(v => typeof v === 'string' && v.trim())) {
    throw new Error('evidence_refs must be nonempty strings');
  }
  const owners = Object.entries(CATALOG).filter(([, descriptor]) =>
    descriptor.capabilities.includes(capability)).map(([name]) => name);
  const idempotency_key = 'agent:v1:' + crypto.createHash('sha256')
    .update(JSON.stringify([source, sourceEventId, capability, effect]))
    .digest('hex');
  const problems = [];
  if (owners.length !== 1) problems.push('UNKNOWN_OR_AMBIGUOUS_CAPABILITY');
  if (evidence.length === 0) problems.push('EVIDENCE_REQUIRED');
  if (task.identity_conflict === true) problems.push('IDENTITY_CONFLICT');
  if (task.consent === false && effect === 'SEND_EXTERNAL_MESSAGE') problems.push('CONTACT_OPT_OUT');
  if (task.guards_verified !== true && effect !== 'READ' && effect !== 'DRAFT') {
    problems.push('GUARDS_NOT_VERIFIED');
  }
  const needsApproval = effect !== 'READ' && effect !== 'DRAFT';
  // No supplied approval token is accepted here; a separate authenticated
  // approval and governance layer must validate it during execution.
  return Object.freeze({
    schema_version: 'MAGOS_AGENT_PLAN_V1',
    idempotency_key,
    agent: owners.length === 1 ? owners[0] : null,
    capability,
    effect,
    source,
    source_event_id: sourceEventId,
    evidence_refs: [...evidence],
    state: problems.length ? 'BLOCKED' : needsApproval ? 'AWAITING_APPROVAL' : 'PROPOSED',
    execution_authorized: false,
    approval_required: needsApproval,
    blockers: problems,
    next_boundary: 'GOVERNED_EVENT_RUNNER',
  });
}

module.exports = { CATALOG, HIGH_RISK, VALID_STATES, planAgentTask };
