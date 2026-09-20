'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyRetry
} = require('../processor/retry-policy');
const {
  RetryController,
  deadLetterKey
} = require('../processor/retry-controller');
const { createEventEnvelope } = require('../processor/event-envelope');

function event() {
  return createEventEnvelope({
    source: 'DRIVE_00A',
    source_event_id: 'FILE-RETRY-1',
    event_type: 'DOCUMENT_RECEIVED',
    occurred_at: '2026-09-20T12:00:00Z',
    received_at: '2026-09-20T12:00:01Z',
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [{ type: 'DRIVE_FILE', ref: 'drive://FILE-RETRY-1' }],
    payload: { document: { drive_file_id: 'FILE-RETRY-1' } }
  });
}

test('known transient failure retries with same event lineage', () => {
  const result = classifyRetry({
    reasonCode: 'NETWORK_TIMEOUT',
    retryCount: 1,
    maxRetries: 3
  });

  assert.equal(result.action, 'RETRY');
  assert.equal(result.next_retry_count, 2);
});

test('authority mismatch does not retry', () => {
  const result = classifyRetry({
    reasonCode: 'AUTHORITY_MISMATCH',
    retryCount: 0
  });

  assert.equal(result.action, 'REVIEW_REQUIRED');
  assert.equal(result.reason_code, 'NON_RETRYABLE_FAILURE');
});

test('unknown failure class fails to review instead of looping', () => {
  const result = classifyRetry({
    reasonCode: 'SOMETHING_NEW',
    retryCount: 0
  });

  assert.equal(result.action, 'REVIEW_REQUIRED');
  assert.equal(result.reason_code, 'UNKNOWN_RETRY_CLASSIFICATION');
});

test('retry limit produces dead letter', () => {
  const result = classifyRetry({
    reasonCode: 'NETWORK_TIMEOUT',
    retryCount: 3,
    maxRetries: 3
  });

  assert.equal(result.action, 'DEAD_LETTER');
  assert.equal(result.reason_code, 'RETRY_LIMIT_EXCEEDED');
});

test('dead-letter record derives from original event idempotency key', async () => {
  const state = {};
  const controller = new RetryController({
    maxRetries: 3,
    ledger: {
      async raiseSyncException(args) {
        state.args = args;
        return 'SYNC-DL-1';
      }
    }
  });

  const env = event();
  const decision = controller.decide({
    reasonCode: 'NETWORK_TIMEOUT',
    retryCount: 3
  });

  const result = await controller.deadLetter(env, decision, {
    error: 'provider timeout'
  });

  assert.equal(result.dead_letter_key, deadLetterKey(env.idempotency_key));
  assert.equal(state.args.idempotencyKey, result.dead_letter_key);
  assert.match(state.args.actionRequired, /reuse the original event idempotency key/i);
});
