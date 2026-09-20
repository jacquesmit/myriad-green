'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ReviewManager, reviewKey } = require('../processor/review-manager');
const { createEventEnvelope } = require('../processor/event-envelope');
const { composeTransactionPlan, createIfAbsent } = require('../writer/operations');

function event() {
  return createEventEnvelope({
    source: 'DRIVE_00A',
    source_event_id: 'FILE-1',
    event_type: 'DOCUMENT_RECEIVED',
    occurred_at: '2026-09-20T10:00:00Z',
    received_at: '2026-09-20T10:00:01Z',
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [{ type: 'DRIVE_FILE', ref: 'drive://FILE-1' }],
    payload: { document: { drive_file_id: 'FILE-1' } }
  });
}

function fakeLedger() {
  const state = { row: null, updates: [] };
  return {
    state,
    async raiseSyncException(args) {
      state.row = {
        exception_id: 'SYNC-1',
        idempotency_key: args.idempotencyKey,
        status: 'OPEN',
        evidence: args.evidence,
        destination_value: '',
        source_value: args.sourceValue
      };
      return 'SYNC-1';
    },
    async findByKey(sheet, key, value) {
      if (sheet === 'Sync_Exceptions' && state.row?.idempotency_key === value) {
        return { object: state.row };
      }
      return null;
    },
    async updateFieldsByKey(sheet, key, value, changes) {
      state.updates.push({ sheet, key, value, changes });
      state.row = { ...state.row, ...changes };
      return { changed: true };
    }
  };
}

function planner(envelope) {
  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    preconditions: [],
    writes: [createIfAbsent({
      store: 'crm',
      workbook_role: 'CRM',
      sheet: 'Evidence_Index',
      key: { header: 'evidence_index_id', value: 'EVI-1' },
      authority: 'AUTHORITATIVE',
      entity_type: 'Evidence index',
      values: { evidence_index_id: 'EVI-1' }
    })]
  });
}

test('review opening uses deterministic review key derived from original event idempotency', async () => {
  const ledger = fakeLedger();
  const manager = new ReviewManager({ ledger });
  const envelope = event();

  const opened = await manager.open(envelope, {
    decision: 'REVIEW_REQUIRED',
    reason_code: 'AMBIGUOUS_MATCH',
    reason: 'two exact candidates'
  });

  assert.equal(opened.review_key, reviewKey(envelope.idempotency_key));
  assert.equal(ledger.state.row.idempotency_key, opened.review_key);
});

test('approval requires an exact confidence-1 match', async () => {
  const ledger = fakeLedger();
  const manager = new ReviewManager({ ledger });
  const envelope = event();

  await manager.open(envelope, {
    decision: 'REVIEW_REQUIRED',
    reason_code: 'AMBIGUOUS_MATCH'
  });

  await assert.rejects(
    manager.recordResolution({
      eventIdempotencyKey: envelope.idempotency_key,
      resolution: 'APPROVE',
      approvedMatch: {
        status: 'MATCHED',
        confidence: 0.9,
        basis: 'EXACT_ID'
      }
    }),
    /confidence=1/
  );
});

test('approved review resumes original event and preserves original idempotency key', async () => {
  const ledger = fakeLedger();
  const manager = new ReviewManager({ ledger });
  const envelope = event();
  const exact = {
    status: 'MATCHED',
    confidence: 1,
    basis: 'EXACT_ID',
    canonical_ids: { supplier_id: 'SUP-ECO' }
  };

  await manager.open(envelope, {
    decision: 'REVIEW_REQUIRED',
    reason_code: 'AMBIGUOUS_MATCH'
  });
  await manager.recordResolution({
    eventIdempotencyKey: envelope.idempotency_key,
    resolution: 'APPROVE',
    approvedMatch: exact,
    owner: 'Jacques'
  });

  const resumed = await manager.resume(envelope, {
    planner: async (env) => planner(env)
  });

  assert.equal(resumed.decision, 'AUTO_WRITE');
  assert.equal(resumed.resumed_from_review, true);
  assert.equal(resumed.idempotency_key, envelope.idempotency_key);
  assert.equal(
    resumed.transaction_plan.idempotency_key,
    envelope.idempotency_key
  );
});

test('rejected review cannot resume', async () => {
  const ledger = fakeLedger();
  const manager = new ReviewManager({ ledger });
  const envelope = event();

  await manager.open(envelope, {
    decision: 'REVIEW_REQUIRED',
    reason_code: 'NO_DETERMINISTIC_MATCH'
  });
  await manager.recordResolution({
    eventIdempotencyKey: envelope.idempotency_key,
    resolution: 'REJECT'
  });

  await assert.rejects(
    manager.resume(envelope, { planner: async (env) => planner(env) }),
    /not approved/
  );
});
