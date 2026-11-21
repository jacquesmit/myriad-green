'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEventEnvelope } = require('../processor/event-envelope');
const { createSupplierApprovalProcessor } = require('../processor/supplier-approval-processor');
const { GovernedProcessorRegistry } = require('../processor/processor-registry');

function envelope(overrides = {}) {
  return createEventEnvelope({
    source: 'MGOS_GOVERNANCE',
    source_event_id: 'approval-test-01',
    event_type: 'SUPPLIER_APPROVAL_CHANGED',
    actor: { id: 'operator-1' },
    entity_hints: { supplier_id: 'SUP-AQUADAM-GAUTENG' },
    guards: { spam: 'CLEAR', phishing: 'CLEAR', explicit_content: 'CLEAR', malware: 'CLEAR', irrelevant: 'CLEAR' },
    evidence: [{ type: 'DOCUMENT', ref: 'https://example.test/approval-evidence' }],
    metadata: { approval_authorized: true },
    payload: { supplier_approval_change: { supplier_id: 'SUP-AQUADAM-GAUTENG', from_state: 'VETTING', to_state: 'APPROVED' } },
    ...overrides
  });
}
const lookup = (row = { supplier_id: 'SUP-AQUADAM-GAUTENG', supplier_approval_state: 'VETTING', active_status: 'ACTIVE' }) => ({
  async findEntityByCanonicalId(type, id) {
    assert.equal(type, 'Supplier');
    return row && row.supplier_id === id ? row : null;
  }
});
test('governed approval generates exactly one P3 STATE_TRANSITION without touching active_status', async () => {
  const d = await createSupplierApprovalProcessor({ lookupService: lookup() }).decide(envelope());
  assert.equal(d.decision, 'AUTO_WRITE');
  assert.equal(d.match.basis, 'EXACT_ID');
  assert.equal(d.transaction_plan.writes.length, 1);
  const w = d.transaction_plan.writes[0];
  assert.equal(w.operation, 'STATE_TRANSITION');
  assert.deepEqual(w.from_states, ['VETTING']);
  assert.equal(w.to_state, 'APPROVED');
  assert.equal(w.state_field, 'supplier_approval_state');
  assert.deepEqual(w.key, { header: 'supplier_id', value: 'SUP-AQUADAM-GAUTENG' });
  assert.equal(w.changes?.active_status, undefined);
  assert.equal(d.transaction_plan.idempotency_key, envelope().idempotency_key);
});
test('approval processor is registered as an explicit governed event', () => {
  const registry = new GovernedProcessorRegistry({ lookupService: lookup(), writer: { audit: {} } });
  assert.equal(registry.supports('SUPPLIER_APPROVAL_CHANGED'), true);
  assert.equal(typeof registry.processorFor('SUPPLIER_APPROVAL_CHANGED').decide, 'function');
});
test('missing authorization cannot auto-write', async () => {
  const d = await createSupplierApprovalProcessor({ lookupService: lookup() }).decide(
    envelope({ metadata: {} })
  );
  assert.equal(d.decision, 'REVIEW_REQUIRED');
  assert.equal(d.transaction_plan, undefined);
});
test('wrong governance source cannot auto-write', async () => {
  const d = await createSupplierApprovalProcessor({ lookupService: lookup() }).decide(
    envelope({ source: 'SUPPLIER_EMAIL' })
  );
  assert.equal(d.decision, 'REVIEW_REQUIRED');
});
test('unknown or blocked guards cannot auto-write', async () => {
  const processor = createSupplierApprovalProcessor({ lookupService: lookup() });
  for (const value of ['UNKNOWN', 'BLOCK']) {
    const d = await processor.decide(envelope({ guards: { spam: value, phishing: 'CLEAR', explicit_content: 'CLEAR', malware: 'CLEAR', irrelevant: 'CLEAR' } }));
    assert.notEqual(d.decision, 'AUTO_WRITE');
  }
});
test('missing evidence cannot auto-write', async () => {
  const d = await createSupplierApprovalProcessor({ lookupService: lookup() }).decide(envelope({ evidence: [] }));
  assert.equal(d.decision, 'REVIEW_REQUIRED');
});
test('missing supplier and stale expectation cannot auto-write', async () => {
  const missing = await createSupplierApprovalProcessor({ lookupService: lookup(null) }).decide(envelope());
  assert.notEqual(missing.decision, 'AUTO_WRITE');
  const stale = await createSupplierApprovalProcessor({ lookupService: lookup({ supplier_id: 'SUP-AQUADAM-GAUTENG', supplier_approval_state: 'EXCLUDED', active_status: 'ACTIVE' }) }).decide(envelope());
  assert.notEqual(stale.decision, 'AUTO_WRITE');
});
test('supplier ID mismatch, invalid state or unchanged state cannot auto-write', async () => {
  const p = createSupplierApprovalProcessor({ lookupService: lookup() });
  const mismatch = await p.decide(envelope({ entity_hints: { supplier_id: 'SUP-OTHER' } }));
  assert.notEqual(mismatch.decision, 'AUTO_WRITE');
  const invalid = await p.decide(envelope({ payload: { supplier_approval_change: { supplier_id: 'SUP-AQUADAM-GAUTENG', from_state: 'VETTING', to_state: 'UNKNOWN' } } }));
  assert.notEqual(invalid.decision, 'AUTO_WRITE');
  const unchanged = await p.decide(envelope({ payload: { supplier_approval_change: { supplier_id: 'SUP-AQUADAM-GAUTENG', from_state: 'VETTING', to_state: 'VETTING' } } }));
  assert.notEqual(unchanged.decision, 'AUTO_WRITE');
});
