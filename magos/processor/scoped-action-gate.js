'use strict';

// Gate a specific consequential action, never an entire build or business record.
// A missing prerequisite must not silently turn into a fabricated PASS.
const ACTIONS = Object.freeze({
  VIEW: 'VIEW',
  CAPTURE_EVIDENCE: 'CAPTURE_EVIDENCE',
  REQUEST_CLARIFICATION: 'REQUEST_CLARIFICATION',
  PREPARE_DRAFT: 'PREPARE_DRAFT',
  PLAN_WORK: 'PLAN_WORK',
  CREATE_JOB: 'CREATE_JOB',
  RELEASE_PROCUREMENT: 'RELEASE_PROCUREMENT',
  MARK_PAYMENT_CLEARED: 'MARK_PAYMENT_CLEARED'
});
const NON_CONSEQUENTIAL = new Set([
  ACTIONS.VIEW, ACTIONS.CAPTURE_EVIDENCE, ACTIONS.REQUEST_CLARIFICATION,
  ACTIONS.PREPARE_DRAFT, ACTIONS.PLAN_WORK
]);

function scopeGate({ targetAction, blockedReasons = [], reviewReasons = [], context = {} }) {
  if (!Object.values(ACTIONS).includes(targetAction)) throw new Error('UNKNOWN_TARGET_ACTION');
  const blocked = [...new Set(blockedReasons)];
  const review = [...new Set(reviewReasons)];
  const preparatory = NON_CONSEQUENTIAL.has(targetAction);
  return {
    target_action: targetAction,
    action_state: preparatory ? 'ALLOWED' : blocked.length ? 'BLOCKED' : review.length ? 'REVIEW_REQUIRED' : 'ALLOWED',
    blockers: preparatory ? [] : blocked,
    to_confirm: preparatory ? [] : review,
    independent_actions_allowed: [...NON_CONSEQUENTIAL],
    scope: context,
    blocks_unrelated_work: false
  };
}
module.exports = { ACTIONS, scopeGate };
