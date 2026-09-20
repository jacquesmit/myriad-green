'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createEventEnvelope } = require('../processor/event-envelope');
const { EventObserver, observationKey } = require('../processor/event-observer');
const { ReviewManager, reviewKey, followUpReviewKey } = require('../processor/review-manager');
const { RetryController, deadLetterKey } = require('../processor/retry-controller');
const { GovernedEventRunner } = require('../processor/governed-event-runner');
const { composeTransactionPlan, createIfAbsent } = require('../writer/operations');

function envelope() {
  return createEventEnvelope({
    source: 'DRIVE_00A',
    source_event_id: 'FILE-RUNNER-1',
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
    evidence: [{ type: 'DRIVE_FILE', ref: 'drive://FILE-RUNNER-1' }],
    payload: { document: { drive_file_id: 'FILE-RUNNER-1' } }
  });
}

function plan(env) {
  return composeTransactionPlan({
    idempotency_key: env.idempotency_key,
    event_type: env.event_type,
    source_event_id: env.source_event_id,
    preconditions: [],
    writes: [createIfAbsent({
      store: 'crm',
      workbook_role: 'CRM',
      sheet: 'Evidence_Index',
      key: {
        header: 'evidence_index_id',
        value: 'EVI-RUNNER-1'
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Evidence index',
      values: {
        evidence_index_id: 'EVI-RUNNER-1'
      }
    })]
  });
}

function autoDecision(env, extras = {}) {
  return {
    schema_version: 'MAGOS-DECISION/V1',
    event_id: env.event_id,
    idempotency_key: env.idempotency_key,
    decision: 'AUTO_WRITE',
    reason_code: 'MATCHED_EXACTLY',
    reason: 'exact',
    rule_version: 'MAGOS-EVENT-PROCESSOR-01/V1',
    match: {
      status: 'MATCHED',
      confidence: 1,
      basis: 'EXACT_ID',
      canonical_ids: {
        supplier_id: 'SUP-ECO'
      }
    },
    transaction_plan: plan(env),
    ...extras
  };
}

function fakeLedger() {
  const runs = new Map();
  const exceptions = new Map();
  const transitions = [];

  return {
    runs,
    exceptions,
    transitions,

    async findByKey(sheet, key, value) {
      if (sheet === 'Automation_Run_Log' && key === 'idempotency_key') {
        const row = runs.get(value);
        return row ? { object: row } : null;
      }
      if (sheet === 'Sync_Exceptions' && key === 'idempotency_key') {
        const row = exceptions.get(value);
        return row ? { object: row } : null;
      }
      return null;
    },

    async appendObject(sheet, object) {
      if (sheet === 'Automation_Run_Log') {
        runs.set(object.idempotency_key, { ...object });
      } else if (sheet === 'Event_Transition_Log') {
        transitions.push({ ...object });
      }
      return true;
    },

    async updateFieldsByKey(sheet, key, value, changes) {
      if (sheet === 'Automation_Run_Log') {
        const row = runs.get(value);
        if (!row) return null;
        runs.set(value, { ...row, ...changes });
        return { changed: true };
      }
      if (sheet === 'Sync_Exceptions') {
        const row = exceptions.get(value);
        if (!row) return null;
        exceptions.set(value, { ...row, ...changes });
        return { changed: true };
      }
      return null;
    },

    async raiseSyncException(args) {
      const existing = exceptions.get(args.idempotencyKey);
      if (existing) {
        exceptions.set(args.idempotencyKey, {
          ...existing,
          status: 'OPEN',
          exception_type: args.exceptionType,
          evidence: args.evidence || existing.evidence || ''
        });
        return existing.exception_id;
      }

      const row = {
        exception_id: 'SYNC-' + String(exceptions.size + 1),
        idempotency_key: args.idempotencyKey,
        status: 'OPEN',
        exception_type: args.exceptionType,
        entity_type: args.entityType || '',
        record_id: args.recordId || '',
        source_value: args.sourceValue || '',
        destination_value: args.destinationValue || '',
        action_required: args.actionRequired || '',
        owner: '',
        resolved_at: '',
        evidence: args.evidence || ''
      };
      exceptions.set(args.idempotencyKey, row);
      return row.exception_id;
    }
  };
}

function makeRunner({
  processor,
  writer,
  ledger,
  maxRetries = 3
} = {}) {
  const actualLedger = ledger || fakeLedger();
  const observer = new EventObserver({ ledger: actualLedger });
  const reviewManager = new ReviewManager({ ledger: actualLedger });
  const retryController = new RetryController({
    ledger: actualLedger,
    maxRetries
  });
  const actualProcessor = processor || {
    async decide(env) {
      return autoDecision(env);
    }
  };
  const actualWriter = writer || {
    async execute() {
      return {
        transaction_id: 'TXN-1',
        state: 'COMMITTED',
        affected_record_ids: ['EVI-RUNNER-1']
      };
    }
  };

  return {
    ledger: actualLedger,
    runner: new GovernedEventRunner({
      processor: actualProcessor,
      writer: actualWriter,
      observer,
      reviewManager,
      retryController
    })
  };
}

test('governed runner composes receive through committed writer read-back state', async () => {
  const { ledger, runner } = makeRunner();
  const env = envelope();

  const result = await runner.run(env);
  assert.equal(result.state, 'COMMITTED');

  const states = ledger.transitions.map(x => x.new_state);
  assert.deepEqual(states, [
    'RECEIVED',
    'VALIDATED',
    'DECIDED',
    'PLANNED',
    'EXECUTING',
    'COMMITTED'
  ]);

  const current = ledger.runs.get(observationKey(env.idempotency_key));
  assert.equal(current.event_state, 'COMMITTED');
});

test('review decision opens durable review and does not call writer', async () => {
  let writes = 0;
  const { ledger, runner } = makeRunner({
    processor: {
      async decide(env) {
        return {
          schema_version: 'MAGOS-DECISION/V1',
          event_id: env.event_id,
          idempotency_key: env.idempotency_key,
          decision: 'REVIEW_REQUIRED',
          reason_code: 'AMBIGUOUS_MATCH',
          reason: 'two exact candidates',
          rule_version: 'MAGOS-EVENT-PROCESSOR-01/V1',
          match: {
            status: 'AMBIGUOUS',
            confidence: 1,
            basis: 'EXACT_REFERENCE'
          }
        };
      }
    },
    writer: {
      async execute() {
        writes += 1;
        return { state: 'COMMITTED' };
      }
    }
  });
  const env = envelope();

  const result = await runner.run(env);
  assert.equal(result.state, 'REVIEW_REQUIRED');
  assert.equal(writes, 0);
  assert.ok(ledger.exceptions.has(reviewKey(env.idempotency_key)));
});

test('retry re-resolves same event lineage and resumes RETRY_REQUIRED directly to EXECUTING', async () => {
  let writerCalls = 0;
  let processorCalls = 0;
  const { ledger, runner } = makeRunner({
    processor: {
      async decide(env) {
        processorCalls += 1;
        return autoDecision(env);
      }
    },
    writer: {
      async execute() {
        writerCalls += 1;
        if (writerCalls === 1) {
          return {
            transaction_id: 'TXN-1',
            state: 'RETRY_REQUIRED',
            error: 'PRECONDITION_FAILED: transient source race'
          };
        }
        return {
          transaction_id: 'TXN-2',
          state: 'COMMITTED',
          affected_record_ids: ['EVI-RUNNER-1']
        };
      }
    }
  });
  const env = envelope();

  const first = await runner.run(env);
  assert.equal(first.state, 'RETRY_REQUIRED');
  assert.equal(first.retry.action, 'RETRY');

  const second = await runner.run(env);
  assert.equal(second.state, 'COMMITTED');
  assert.equal(writerCalls, 2);
  assert.equal(processorCalls, 2);

  const states = ledger.transitions.map(x => x.new_state);
  assert.deepEqual(states, [
    'RECEIVED',
    'VALIDATED',
    'DECIDED',
    'PLANNED',
    'EXECUTING',
    'RETRY_REQUIRED',
    'EXECUTING',
    'COMMITTED'
  ]);
});

test('approved review resumes through DECIDED and PLANNED before writer', async () => {
  const exact = {
    status: 'MATCHED',
    confidence: 1,
    basis: 'EXACT_ID',
    canonical_ids: {
      supplier_id: 'SUP-ECO'
    }
  };

  const { ledger, runner } = makeRunner({
    processor: {
      async decide(env) {
        return {
          schema_version: 'MAGOS-DECISION/V1',
          event_id: env.event_id,
          idempotency_key: env.idempotency_key,
          decision: 'REVIEW_REQUIRED',
          reason_code: 'AMBIGUOUS_MATCH',
          reason: 'needs owner decision',
          rule_version: 'MAGOS-EVENT-PROCESSOR-01/V1',
          match: null
        };
      }
    }
  });
  const env = envelope();

  const initial = await runner.run(env);
  assert.equal(initial.state, 'REVIEW_REQUIRED');

  await runner.reviewManager.recordResolution({
    eventIdempotencyKey: env.idempotency_key,
    resolution: 'APPROVE',
    approvedMatch: exact,
    owner: 'Jacques'
  });

  const resumed = await runner.resumeApproved(env, {
    approvedMatch: exact,
    planner: async (event) => plan(event)
  });

  assert.equal(resumed.state, 'COMMITTED');
  assert.equal(resumed.review_resolved, true);

  const states = ledger.transitions.map(x => x.new_state);
  assert.deepEqual(states, [
    'RECEIVED',
    'VALIDATED',
    'REVIEW_REQUIRED',
    'DECIDED',
    'PLANNED',
    'EXECUTING',
    'COMMITTED'
  ]);

  const review = ledger.exceptions.get(reviewKey(env.idempotency_key));
  assert.equal(review.status, 'RESOLVED');
});

test('committed event can open separate follow-up review without reopening event state', async () => {
  const reasonCode = 'SUPPLIER_PART_OR_PRICE_REVIEW_REQUIRED';
  const { ledger, runner } = makeRunner({
    processor: {
      async decide(env) {
        return autoDecision(env, {
          post_commit_review: {
            required: true,
            reason_code: reasonCode,
            reason: 'source evidence stored; canonical part unresolved'
          }
        });
      }
    }
  });
  const env = envelope();

  const result = await runner.run(env);
  assert.equal(result.state, 'COMMITTED');
  assert.ok(result.follow_up_review);

  const key = followUpReviewKey(env.idempotency_key, reasonCode);
  assert.ok(ledger.exceptions.has(key));

  const current = ledger.runs.get(observationKey(env.idempotency_key));
  assert.equal(current.event_state, 'COMMITTED');
});

test('non-retryable writer failure becomes review instead of automatic replay', async () => {
  const { ledger, runner } = makeRunner({
    writer: {
      async execute() {
        return {
          transaction_id: 'TXN-FAIL',
          state: 'RETRY_REQUIRED',
          error: 'AUTHORITY_MISMATCH: wrong owner'
        };
      }
    }
  });
  const env = envelope();

  const result = await runner.run(env);
  assert.equal(result.state, 'REVIEW_REQUIRED');
  assert.equal(result.retry.action, 'REVIEW_REQUIRED');
  assert.ok(ledger.exceptions.has(reviewKey(env.idempotency_key)));

  const current = ledger.runs.get(observationKey(env.idempotency_key));
  assert.equal(current.event_state, 'REVIEW_REQUIRED');
});

test('retry exhaustion dead-letters original event identity and terminates observation', async () => {
  const { ledger, runner } = makeRunner({
    maxRetries: 1,
    writer: {
      async execute() {
        return {
          transaction_id: 'TXN-DEAD',
          state: 'RETRY_REQUIRED',
          error: 'PRECONDITION_FAILED: still unavailable'
        };
      }
    }
  });
  const env = envelope();

  const result = await runner.run(env);
  assert.equal(result.state, 'DEAD_LETTER');
  assert.equal(result.retry.action, 'DEAD_LETTER');

  const key = deadLetterKey(env.idempotency_key);
  assert.ok(ledger.exceptions.has(key));

  const current = ledger.runs.get(observationKey(env.idempotency_key));
  assert.equal(current.event_state, 'FAILED');
});
