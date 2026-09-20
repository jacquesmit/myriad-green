'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { documentEnvelopeToEvent } = require('../workers/00a-event.worker');
const { ZeroAResolver } = require('../processor/resolve-00a-document');
const { planZeroADocument } = require('../processor/plan-00a-document');
const { EventProcessor } = require('../processor/event-processor');

function docEnvelope(overrides = {}) {
  return {
    document_id: 'DOC-ABC',
    source_event_id: 'DRIVE-1',
    drive_file_id: 'DRIVE-1',
    file_name: 'supplier-quote.pdf',
    mime_type: 'application/pdf',
    file_hash: 'a'.repeat(64),
    document_type: 'SUPPLIER_QUOTE',
    classification_confidence: 0.99,
    extraction_confidence: 0.95,
    extraction_method: 'PDF_PARSE',
    review_required: false,
    normalized: {
      document_type: 'SUPPLIER_QUOTE',
      document_number: 'Q-100',
      document_date: '2026-09-20',
      currency: 'ZAR',
      total: 4700,
      line_items: [],
      structured_fields: {}
    },
    idempotency_key: 'DOC|1',
    rule_version: 'MAGOS-DOC-EXTRACT-01/V1',
    ...overrides
  };
}

test('00A bridge emits canonical DOCUMENT_RECEIVED event', () => {
  const event = documentEnvelopeToEvent(docEnvelope(), {
    receivedAt: new Date('2026-09-20T10:00:00Z'),
    canonicalIds: { supplier_id: 'SUP-ECO' }
  });

  assert.equal(event.source, 'DRIVE_00A');
  assert.equal(event.event_type, 'DOCUMENT_RECEIVED');
  assert.equal(event.entity_hints.supplier_id, 'SUP-ECO');
  assert.equal(event.guards.irrelevant, 'CLEAR');
  assert.equal(event.payload.document.drive_file_id, 'DRIVE-1');
});

test('exact canonical hint resolves only after lookup verification', async () => {
  const event = documentEnvelopeToEvent(docEnvelope(), {
    receivedAt: new Date('2026-09-20T10:00:00Z'),
    canonicalIds: { supplier_id: 'SUP-ECO' }
  });

  const resolver = new ZeroAResolver({
    findEntityByCanonicalId: async (type, id) =>
      type === 'Supplier' && id === 'SUP-ECO' ? { supplier_id: id } : null
  });

  const result = await resolver.resolve(event);
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.basis, 'EXACT_ID');
  assert.equal(result.confidence, 1);
  assert.equal(result.canonical_ids.supplier_id, 'SUP-ECO');
});

test('unverified canonical hint is a conflict, not a guessed match', async () => {
  const event = documentEnvelopeToEvent(docEnvelope(), {
    receivedAt: new Date('2026-09-20T10:00:00Z'),
    canonicalIds: { supplier_id: 'SUP-DOES-NOT-EXIST' }
  });

  const resolver = new ZeroAResolver({
    findEntityByCanonicalId: async () => null
  });

  const result = await resolver.resolve(event);
  assert.equal(result.status, 'CONFLICT');
  assert.equal(result.basis, 'EXACT_ID');
});

test('one exact document-number match resolves deterministically', async () => {
  const event = documentEnvelopeToEvent(docEnvelope(), {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });

  const resolver = new ZeroAResolver({
    findByDocumentNumber: async () => [{
      canonical_ids: { supplier_id: 'SUP-ECO' }
    }]
  });

  const result = await resolver.resolve(event);
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.basis, 'EXACT_REFERENCE');
  assert.equal(result.canonical_ids.supplier_id, 'SUP-ECO');
});

test('multiple exact document-number matches route ambiguous', async () => {
  const event = documentEnvelopeToEvent(docEnvelope(), {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });

  const resolver = new ZeroAResolver({
    findByDocumentNumber: async () => [
      { canonical_ids: { supplier_id: 'SUP-A' } },
      { canonical_ids: { supplier_id: 'SUP-B' } }
    ]
  });

  const result = await resolver.resolve(event);
  assert.equal(result.status, 'AMBIGUOUS');
});

test('planner creates only one governed Evidence_Index write', () => {
  const event = documentEnvelopeToEvent(docEnvelope(), {
    receivedAt: new Date('2026-09-20T10:00:00Z'),
    canonicalIds: { supplier_id: 'SUP-ECO' }
  });

  const plan = planZeroADocument(event, {
    canonical_ids: { supplier_id: 'SUP-ECO' }
  }, {
    now: () => new Date('2026-09-20T10:00:00Z')
  });

  assert.equal(plan.idempotency_key, event.idempotency_key);
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].sheet, 'Evidence_Index');
  assert.equal(plan.writes[0].operation, 'CREATE_IF_ABSENT');
  assert.equal(plan.writes[0].entity_type, 'Evidence index');
  assert.equal(plan.writes[0].values.supplier_id, 'SUP-ECO');
  assert.equal(plan.writes[0].values.drive_file_id, 'DRIVE-1');
});

test('P5 processor allows exact 00A match to compile P3 plan', async () => {
  const event = documentEnvelopeToEvent(docEnvelope(), {
    receivedAt: new Date('2026-09-20T10:00:00Z'),
    canonicalIds: { supplier_id: 'SUP-ECO' }
  });

  const resolver = new ZeroAResolver({
    findEntityByCanonicalId: async () => ({ supplier_id: 'SUP-ECO' })
  });

  const processor = new EventProcessor({
    resolver: (env) => resolver.resolve(env),
    planner: async (env, match) =>
      planZeroADocument(env, match, {
        now: () => new Date('2026-09-20T10:00:00Z')
      })
  });

  const decision = await processor.decide(event);
  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.transaction_plan.writes[0].intent, 'REGISTER_00A_EVIDENCE');
});

test('OTHER document keeps guard unknown and therefore requires review', async () => {
  const event = documentEnvelopeToEvent(docEnvelope({
    document_type: 'OTHER'
  }), {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });

  const decision = await new EventProcessor().decide(event);
  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'GUARD_UNKNOWN');
});
