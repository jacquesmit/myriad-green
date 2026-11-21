'use strict';

const { ACTIONS, scopeGate } = require('./scoped-action-gate');

function value(v) { return String(v === undefined || v === null ? '' : v).trim(); }
function upper(v) { return value(v).toUpperCase(); }
function assessQuoteToJob({ quote, job, paymentClearance, acceptanceEvidence } = {}) {
  const failures = [];
  const unknown = [];
  if (!quote || !value(quote.quote_id)) failures.push('QUOTE_NOT_RESOLVED');
  if (!job || !value(job.opportunity_id)) failures.push('OPPORTUNITY_NOT_RESOLVED');
  if (quote && job && value(quote.opportunity_id) !== value(job.opportunity_id)) failures.push('QUOTE_OPPORTUNITY_MISMATCH');
  const accepted = upper(quote?.['Quote Status']) === 'ACCEPTED';
  if (!accepted) failures.push('QUOTE_NOT_ACCEPTED');
  if (!value(acceptanceEvidence)) unknown.push('ACCEPTANCE_EVIDENCE_NOT_VERIFIED');
  if (quote && upper(quote['Line Control State']) !== 'PASS') unknown.push('CANONICAL_QUOTE_LINES_NOT_VERIFIED');
  // Payment proof or a claimed deposit is never equivalent to cleared funds.
  if (paymentClearance !== 'CLEARED') unknown.push('PAYMENT_CLEARANCE_NOT_VERIFIED');
  if (job && value(job.job_id)) unknown.push('EXISTING_JOB_REQUIRES_RECONCILIATION');
  return {
    capability: 'QUOTE_TO_JOB_READINESS',
    quote_id: value(quote?.quote_id),
    opportunity_id: value(job?.opportunity_id),
    decision: failures.length ? 'BLOCKED' : unknown.length ? 'REVIEW_REQUIRED' : 'READY_FOR_GOVERNED_JOB_CREATION',
    blocked_reasons: failures,
    review_reasons: unknown,
    // This is a read-only release gate. Existing business operations continue independently.
    writes: [],
    side_effects: false,
    action_gates: {
      create_job: scopeGate({ targetAction: ACTIONS.CREATE_JOB, blockedReasons: failures, reviewReasons: unknown }),
      prepare_draft: scopeGate({ targetAction: ACTIONS.PREPARE_DRAFT, blockedReasons: failures, reviewReasons: unknown }),
      plan_work: scopeGate({ targetAction: ACTIONS.PLAN_WORK, blockedReasons: failures, reviewReasons: unknown })
    }
  };
}
module.exports = { assessQuoteToJob };
