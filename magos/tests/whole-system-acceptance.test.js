'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, GATES } = require('../scripts/whole-system-acceptance');

const approved = () => ({
  state: 'PASS',
  tested_commit_sha: 'a'.repeat(40),
  evidence_url: 'https://github.com/jacquesmit/myriad-green/actions/runs/123',
  verified_at: '2026-11-22T06:00:00+02:00',
  verified_by: 'reviewed-operator'
});

test('empty evidence fails every gate and cannot release', () => {
  const actual = evaluate({ gates: {} });
  assert.equal(actual.overall, 'BLOCKED');
  assert.equal(actual.counts.FAIL, GATES.length);
});
test('all properly attributed gates report documented attestations, not independent truth', () => {
  const gates = Object.fromEntries(GATES.map(id => [id, approved()]));
  const actual = evaluate({ gates });
  assert.equal(actual.overall, 'PASS');
  assert.equal(actual.counts.PASS, GATES.length);
  assert.match(actual.warning, /not independently verified/);
});
test('a PASS without exact commit, audit evidence or attester fails closed', () => {
  const gates = Object.fromEntries(GATES.map(id => [id, approved()]));
  delete gates.independent_bank_settlement.verified_by;
  gates.host_commit_and_worker.tested_commit_sha = 'main';
  gates.quote_version_and_client_acceptance.evidence_url = 'not-a-link';
  const actual = evaluate({ gates });
  assert.equal(actual.overall, 'BLOCKED');
  assert.equal(actual.counts.FAIL, 3);
});
test('PARTIAL and FAIL never count as accepted', () => {
  const gates = Object.fromEntries(GATES.map(id => [id, approved()]));
  gates.crew_schedule_and_dispatch.state = 'PARTIAL';
  const actual = evaluate({ gates });
  assert.equal(actual.counts.PARTIAL, 1);
  assert.equal(actual.accepted, false);
});
test('unexpected or malformed gate input cannot fabricate PASS', () => {
  const actual = evaluate({ gates: { unrelated: approved(), host_commit_and_worker: 'PASS' } });
  assert.equal(actual.counts.PASS, 0);
  assert.throws(() => evaluate(null));
  assert.throws(() => evaluate({ gates: [] }));
});
