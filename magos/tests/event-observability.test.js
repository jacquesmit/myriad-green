'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createEventEnvelope } = require('../processor/event-envelope');
const { EventObserver, observationKey } = require('../processor/event-observer');
const {
  ObservedEventProcessor,
  ObservedTransactionExecutor
} = require('../processor/observed-event-processor');
const { EventProcessor } = require('../processor/event-processor');

function envelope() {
  return createEventEnvelope({
    source: 'DRIVE_00A',
    source_event_id: 'FILE-OBS-1',
    event_type: 'DOCUMENT_RECEIVED',
    occurred_at: '2026-09-20T10:00:00Z',
    received_at: '2026-09-20T10:00:01Z',
    correlation_id: 'CORR-1',
    entity_hints: { supplier_id: 'SUP-ECO', drive_file_id: 'FILE-OBS-1' },
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [{ type: 'DRIVE_FILE', ref: 'drive://FILE-OBS-1' }],
    payload: { document: { drive_file_id: 'FILE-OBS-1' } }
  });
}

function fakeLedger() {
  const runs = new Map();
  const transitions = [];
  return {
    runs,
    transitions,
    async findByKey(sheet, key, value) {
      if (sheet === 'Automation_Run_Log' && key === 'idempotency_key') {
        const row = runs.get(value);
        return row ? { object: row } : null;
      }
      return null;
    },
    async appendObject(sheet, object) {
      if (sheet === 'Automation_Run_Log') runs.set(object.idempotency_key, { ...object });
      if (sheet === 'Event_Transition_Log') transitions.push({ ...object });
      return true;
    },
    async updateFieldsByKey(sheet, key, value, changes) {
      const row = runs.get(value);
      if (!row) return null;
      runs.set(value, { ...row, ...changes });
      return { changed: true };
    }
  };
}

function autoWriteProcessor() {
  return new EventProcessor({
    resolver: async () => ({
      status: 'MATCHED',
      confidence: 1,
      basis: 'EXACT_ID',
      canonical_ids: { supplier_id: 'SUP-ECO' }
    }),
    planner: async (env) => ({
      idempotency_key: env.idempotency_key,
      event_type: env.event_type,
      source_event_id: env.source_event_id,
      preconditions: [],
      writes: [{
        operation: 'CREATE_IF_ABSENT',
        store: 'crm',
        sheet: 'Evidence_Index',
        key: { header: 'evidence_index_id', value: 'EVI-1' }
      }]
    })
  });
}

test('observability uses a separate run key and preserves original event idempotency', async () => {
  const ledger = fakeLedger();
  const observer = new EventObserver({ ledger });
  const env = envelope();

  await observer.ensure(env);

  const key = observationKey(env.idempotency_key);
  const row = ledger.runs.get(key);
  assert.equal(row.event_idempotency_key, env.idempotency_key);
  assert.equal(row.event_state, 'RECEIVED');
  assert.notEqual(row.idempotency_key, env.idempotency_key);
  assert.equal(ledger.transitions.length, 1);
  assert.equal(ledger.transitions[0].new_state, 'RECEIVED');
});

test('AUTO_WRITE decision records VALIDATED then DECIDED then PLANNED', async () => {
  const ledger = fakeLedger();
  const observer = new EventObserver({ ledger });
  const observed = new ObservedEventProcessor({
    observer,
    processor: autoWriteProcessor()
  });

  const env = envelope();
  const decision = await observed.decide(env);
  assert.equal(decision.decision, 'AUTO_WRITE');

  const states = ledger.transitions.map(x => x.new_state);
  assert.deepEqual(states, ['RECEIVED', 'VALIDATED', 'DECIDED', 'PLANNED']);
  const current = ledger.runs.get(observationKey(env.idempotency_key));
  assert.equal(current.event_state, 'PLANNED');
});

test('review decision records REVIEW_REQUIRED and next action', async () => {
  const ledger = fakeLedger();
  const observer = new EventObserver({ ledger });
  const processor = new EventProcessor({
    resolver: async () => ({
      status: 'AMBIGUOUS',
      confidence: 1,
      basis: 'EXACT_REFERENCE',
      candidates: [{ id: 'A' }, { id: 'B' }]
    })
  });
  const observed = new ObservedEventProcessor({ observer, processor });

  const env = envelope();
  const decision = await observed.decide(env);
  assert.equal(decision.decision, 'REVIEW_REQUIRED');

  const current = ledger.runs.get(observationKey(env.idempotency_key));
  assert.equal(current.event_state, 'REVIEW_REQUIRED');
  assert.match(current.next_action, /Resolve uncertainty/);
});

test('writer retry increments retry count and keeps same observation lineage', async () => {
  const ledger = fakeLedger();
  const observer = new EventObserver({ ledger });
  const env = envelope();
  const decision = await new ObservedEventProcessor({
    observer,
    processor: autoWriteProcessor()
  }).decide(env);

  const executor = new ObservedTransactionExecutor({
    observer,
    writer: {
      async execute() {
        return {
          transaction_id: 'TXN-1',
          state: 'RETRY_REQUIRED',
          error: 'PRECONDITION_FAILED'
        };
      }
    }
  });

  const result = await executor.execute(env, decision);
  assert.equal(result.state, 'RETRY_REQUIRED');

  const current = ledger.runs.get(observationKey(env.idempotency_key));
  assert.equal(current.event_state, 'RETRY_REQUIRED');
  assert.equal(current.retry_count, '1');
  assert.equal(current.event_idempotency_key, env.idempotency_key);
});

test('illegal state transition fails closed', async () => {
  const ledger = fakeLedger();
  const observer = new EventObserver({ ledger });
  const env = envelope();

  await observer.ensure(env);
  await assert.rejects(
    observer.transition(env, 'COMMITTED'),
    /Illegal event transition/
  );
});
