'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ACTIONS, scopeGate } = require('../processor/scoped-action-gate');
const { assessQuoteToJob } = require('../processor/quote-to-job-readiness');

test('missing payment proof does not block evidence collection or drafting', () => {
  const args = { blockedReasons:['QUOTE_NOT_ACCEPTED'], reviewReasons:['PAYMENT_CLEARANCE_NOT_VERIFIED'] };
  assert.equal(scopeGate({targetAction:ACTIONS.CAPTURE_EVIDENCE,...args}).action_state,'ALLOWED');
  assert.equal(scopeGate({targetAction:ACTIONS.PREPARE_DRAFT,...args}).action_state,'ALLOWED');
  assert.equal(scopeGate({targetAction:ACTIONS.CREATE_JOB,...args}).action_state,'BLOCKED');
});
test('unconfirmed financial gate prevents only consequential release action',()=>{
  const args={reviewReasons:['PAYMENT_CLEARANCE_NOT_VERIFIED']};
  assert.equal(scopeGate({targetAction:ACTIONS.RELEASE_PROCUREMENT,...args}).action_state,'REVIEW_REQUIRED');
  assert.equal(scopeGate({targetAction:ACTIONS.PLAN_WORK,...args}).action_state,'ALLOWED');
});
test('quote-to-job exposes preparatory actions while preserving create-job gate',()=>{
  const out=assessQuoteToJob({quote:{quote_id:'Q1',opportunity_id:'O1','Quote Status':'SENT'},job:{opportunity_id:'O1'}});
  assert.equal(out.action_gates.create_job.action_state,'BLOCKED');
  assert.equal(out.action_gates.prepare_draft.action_state,'ALLOWED');
  assert.equal(out.action_gates.plan_work.action_state,'ALLOWED');
  assert.equal(out.side_effects,false);
});
test('unknown action fails closed',()=> assert.throws(()=>scopeGate({targetAction:'UNSAFE_ACTION'}),/UNKNOWN_TARGET_ACTION/));
