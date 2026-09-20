'use strict';

const { AuditLedger } = require('../adapters/audit-ledger');
const { classifyRetry, DEFAULT_MAX_RETRIES } = require('./retry-policy');

function deadLetterKey(eventIdempotencyKey) {
  if (!eventIdempotencyKey) throw new Error('eventIdempotencyKey is required');
  return 'deadletter:event:' + eventIdempotencyKey;
}

class RetryController {
  constructor({
    ledger,
    maxRetries = DEFAULT_MAX_RETRIES
  } = {}) {
    this.ledger = ledger || new AuditLedger();
    this.maxRetries = maxRetries;
  }

  decide({ reasonCode, retryCount }) {
    return classifyRetry({
      reasonCode,
      retryCount,
      maxRetries: this.maxRetries
    });
  }

  async deadLetter(envelope, retryDecision, {
    error = '',
    evidence = ''
  } = {}) {
    if (retryDecision?.action !== 'DEAD_LETTER') {
      throw new Error('DEAD_LETTER retry decision is required');
    }

    const key = deadLetterKey(envelope.idempotency_key);
    const exceptionId = await this.ledger.raiseSyncException({
      idempotencyKey: key,
      entityType: 'EVENT_DEAD_LETTER',
      recordId: envelope.event_id,
      sourceSystem: envelope.source,
      destinationSystem: 'MAGOS Event Processor',
      exceptionType: retryDecision.reason_code,
      severity: 'HIGH',
      sourceValue: JSON.stringify({
        event_id: envelope.event_id,
        source_event_id: envelope.source_event_id,
        event_type: envelope.event_type,
        event_idempotency_key: envelope.idempotency_key,
        retry_count: retryDecision.retry_count,
        max_retries: retryDecision.max_retries,
        original_reason_code: retryDecision.original_reason_code,
        error
      }),
      destinationValue: '',
      actionRequired:
        'Investigate the blocker. If replay is approved, reuse the original event idempotency key; do not create a replacement event.',
      evidence: evidence || envelope.evidence?.[0]?.ref || '',
      ruleId: 'MAGOS-RETRY-POLICY-01/V1'
    });

    return {
      exception_id: exceptionId,
      dead_letter_key: key,
      event_id: envelope.event_id,
      event_idempotency_key: envelope.idempotency_key
    };
  }
}

module.exports = {
  RetryController,
  deadLetterKey
};
