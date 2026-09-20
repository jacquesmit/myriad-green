'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createEventEnvelope,
  deriveIdempotencyKey
} = require('../processor/event-envelope');
const {
  EventProcessor,
  validTransactionPlan
} = require('../processor/event-processor');
const { composeTransactionPlan, updateByKey } = require('../writer/operations');

function baseEvent(overrides = {}) {
  return createEventEnvelope({
    source: 'BANK_IMPORT',
    source_event_id: 'BANK-ROW-001',
    event_type: 'PAYMENT_OBSERVED',
    occurred_at: '2026-09-20T10:00:00+02:00',
    received_at: '2026-09-20T10:01:00+02:00',
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [
      { type: 'BANK_STATEMENT_ROW', ref: 'drive://statement#row-12' }
    ],
    payload: { amount: 2500, reference: 'GAV02' },
    ...overrides
  });
}

function exactMatch() {
  return {
    status: 'MATCHED',
    confidence: 1,
    basis: 'EXACT_REFERENCE',
    entity: {
      type: 'Quote',
      id: 'QTE-20260903-GAV02'
    },
    candidates: []
  };
}

function paymentPlan(envelope) {
  const write = updateByKey({
    store: 'commercial',
    workbook_role: 'COMMERCIAL_MASTER',
    sheet: 'Payment_Events',
    key: {
      header: 'payment_event_id',
      value: envelope.source_event_id
    },
    authority: 'AUTHORITATIVE',
    entity_type: 'Payment',
    intent: 'RECORD_PAYMENT_MATCH',
    changes: {
      allocation_status: 'MATCHED'
    }
  });

  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    evidence_link: envelope.evidence[0].ref,
    preconditions: [],
    writes: [write]
  });
}

test('same source event derives the same event and idempotency identity', () => {
  const one = baseEvent();
  const two = baseEvent();
  assert.equal(one.event_id, two.event_id);
  assert.equal(one.idempotency_key, two.idempotency_key);
  assert.equal(
    one.idempotency_key,
    deriveIdempotencyKey({
      source: 'BANK_IMPORT',
      source_event_id: 'BANK-ROW-001',
      event_type: 'PAYMENT_OBSERVED'
    })
  );
});

test('blocked guard rejects before entity resolution or planning', async () => {
  let resolverCalls = 0;
  let plannerCalls = 0;
  const processor = new EventProcessor({
    resolver: async () => { resolverCalls++; return exactMatch(); },
    planner: async () => { plannerCalls++; return {}; }
  });

  const decision = await processor.decide(baseEvent({
    guards: {
      spam: 'BLOCK',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    }
  }));

  assert.equal(decision.decision, 'REJECTED');
  assert.equal(decision.reason_code, 'GUARD_BLOCKED');
  assert.equal(resolverCalls, 0);
  assert.equal(plannerCalls, 0);
});

test('unknown guard goes to review because Unknown is not Yes', async () => {
  const decision = await new EventProcessor().decide(baseEvent({
    guards: {
      spam: 'UNKNOWN',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    }
  }));

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'GUARD_UNKNOWN');
  assert.deepEqual(decision.unknown_guards, ['spam']);
});

test('duplicate event is ignored before planning', async () => {
  const processor = new EventProcessor({
    duplicateChecker: async () => true,
    resolver: async () => {
      throw new Error('resolver must not run');
    }
  });

  const decision = await processor.decide(baseEvent());
  assert.equal(decision.decision, 'IGNORE');
  assert.equal(decision.reason_code, 'DUPLICATE_EVENT');
});

test('ambiguous match routes to review and cannot reach planner', async () => {
  let plannerCalls = 0;
  const processor = new EventProcessor({
    resolver: async () => ({
      status: 'AMBIGUOUS',
      confidence: 0.99,
      basis: 'EXACT_REFERENCE',
      candidates: [{ id: 'PAY-1' }, { id: 'PAY-2' }]
    }),
    planner: async () => {
      plannerCalls++;
      return {};
    }
  });

  const decision = await processor.decide(baseEvent());
  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'AMBIGUOUS_MATCH');
  assert.equal(plannerCalls, 0);
});

test('deterministic exact match produces a P3-compatible transaction plan', async () => {
  const processor = new EventProcessor({
    resolver: async () => exactMatch(),
    planner: async (envelope) => paymentPlan(envelope)
  });

  const envelope = baseEvent();
  const decision = await processor.decide(envelope);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.reason_code, 'DETERMINISTIC_MATCH');
  assert.equal(decision.transaction_plan.idempotency_key, envelope.idempotency_key);
  assert.equal(decision.transaction_plan.source_event_id, envelope.source_event_id);
  assert.equal(validTransactionPlan(decision.transaction_plan, envelope), true);
});

test('planner cannot replace the event idempotency key', async () => {
  const processor = new EventProcessor({
    resolver: async () => exactMatch(),
    planner: async (envelope) => ({
      ...paymentPlan(envelope),
      idempotency_key: 'WRONG-KEY'
    })
  });

  const decision = await processor.decide(baseEvent());
  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'IDEMPOTENCY_KEY_MISMATCH');
});

test('invalid envelope is rejected rather than guessed or repaired', async () => {
  const decision = await new EventProcessor().decide({
    schema_version: 'MAGOS-EVENT-ENVELOPE/V1',
    event_id: 'EVT-X'
  });

  assert.equal(decision.decision, 'REJECTED');
  assert.equal(decision.reason_code, 'INVALID_EVENT_ENVELOPE');
});
