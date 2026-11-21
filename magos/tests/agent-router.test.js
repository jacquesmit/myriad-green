'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planAgentTask, CATALOG } = require('../agents/agent-router');

const base = {
  capability: 'LEAD_TRIAGE',
  source: 'GMAIL',
  source_event_id: 'message-123',
  evidence_refs: ['gmail:message-123']
};
test('all six specialists have defined capabilities', () => {
  assert.deepEqual(Object.keys(CATALOG), [
    'SALES', 'MARKETING', 'OPERATIONS', 'FINANCE', 'PROCUREMENT', 'ENGINEERING'
  ]);
});
test('read-only lead triage routes deterministically without execution permission', () => {
  const a = planAgentTask(base);
  const b = planAgentTask({...base});
  assert.equal(a.agent, 'SALES');
  assert.equal(a.state, 'PROPOSED');
  assert.equal(a.execution_authorized, false);
  assert.equal(a.idempotency_key, b.idempotency_key);
});
test('writes cannot be authorized by input-supplied approval', () => {
  const p = planAgentTask({...base, effect: 'WRITE_BUSINESS_RECORD', guards_verified: true,
    approved: true, approval_token: 'fake'});
  assert.equal(p.state, 'AWAITING_APPROVAL');
  assert.equal(p.approval_required, true);
  assert.equal(p.execution_authorized, false);
});
test('unknown guards block mutations', () => {
  const p = planAgentTask({...base, effect: 'WRITE_BUSINESS_RECORD'});
  assert.equal(p.state, 'BLOCKED');
  assert.ok(p.blockers.includes('GUARDS_NOT_VERIFIED'));
});
test('missing evidence blocks actions', () => {
  const p = planAgentTask({...base, evidence_refs: []});
  assert.equal(p.state, 'BLOCKED');
  assert.ok(p.blockers.includes('EVIDENCE_REQUIRED'));
});
test('unknown capabilities fail closed', () => {
  const p = planAgentTask({...base, capability: 'MAGIC'});
  assert.equal(p.agent, null);
  assert.equal(p.state, 'BLOCKED');
});
test('identity conflicts block even read-only planning', () => {
  assert.equal(planAgentTask({...base, identity_conflict: true}).state, 'BLOCKED');
});
test('external message opt-out blocks', () => {
  const p = planAgentTask({...base, effect: 'SEND_EXTERNAL_MESSAGE',
    consent: false, guards_verified: true});
  assert.ok(p.blockers.includes('CONTACT_OPT_OUT'));
});
test('missing identifiers and invalid effects are rejected', () => {
  assert.throws(() => planAgentTask({...base, source_event_id: ''}));
  assert.throws(() => planAgentTask({...base, effect: 'UNRECOGNIZED'}));
});
test('capability routing supports other departments', () => {
  const expected = {
    SEO_AUDIT: 'MARKETING', JOB_TRIAGE: 'OPERATIONS',
    QUOTE_COST_REVIEW: 'FINANCE', SUPPLIER_PRICE_REVIEW: 'PROCUREMENT',
    DEPLOYMENT_AUDIT: 'ENGINEERING'
  };
  for (const [capability, agent] of Object.entries(expected)) {
    assert.equal(planAgentTask({...base, capability}).agent, agent);
  }
});
