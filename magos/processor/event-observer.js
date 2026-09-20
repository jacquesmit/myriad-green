'use strict';

const crypto = require('crypto');
const { AuditLedger } = require('../adapters/audit-ledger');

const OBS_PREFIX = 'eventobs:';
const PROCESSOR_VERSION = 'MAGOS-EVENT-PROCESSOR-01/V1';

const TERMINAL_STATES = new Set([
  'COMMITTED',
  'FAILED',
  'DUPLICATE',
  'REJECTED',
  'IGNORED'
]);

const ALLOWED_TRANSITIONS = {
  RECEIVED: new Set(['VALIDATED', 'REJECTED']),
  VALIDATED: new Set(['DECIDED', 'REVIEW_REQUIRED', 'DUPLICATE', 'REJECTED', 'IGNORED']),
  REVIEW_REQUIRED: new Set(['DECIDED', 'REJECTED']),
  DECIDED: new Set(['PLANNED', 'REVIEW_REQUIRED', 'REJECTED']),
  PLANNED: new Set(['EXECUTING', 'REVIEW_REQUIRED']),
  EXECUTING: new Set(['COMMITTED', 'RETRY_REQUIRED', 'FAILED', 'DUPLICATE']),
  RETRY_REQUIRED: new Set(['EXECUTING', 'REVIEW_REQUIRED', 'FAILED']),
  COMMITTED: new Set(),
  FAILED: new Set(),
  DUPLICATE: new Set(),
  REJECTED: new Set(),
  IGNORED: new Set()
};

function observationKey(eventIdempotencyKey) {
  if (!eventIdempotencyKey) throw new Error('event idempotency key is required');
  return OBS_PREFIX + eventIdempotencyKey;
}

function isoNow() {
  return new Date().toISOString();
}

function relatedIds(envelope, extra = {}) {
  const hints = envelope?.entity_hints || {};
  const ids = {
    crm_id: hints.crm_id || '',
    opportunity_id: hints.opportunity_id || '',
    job_id: hints.job_id || '',
    quote_id: hints.quote_id || '',
    invoice_id: hints.invoice_id || '',
    payment_event_id: hints.payment_event_id || '',
    supplier_id: hints.supplier_id || '',
    drive_file_id: hints.drive_file_id || '',
    ...extra
  };
  return Object.fromEntries(Object.entries(ids).filter(([,v]) => v !== '' && v !== null && v !== undefined));
}

function nextActionFor(state) {
  const map = {
    RECEIVED: 'Validate event envelope.',
    VALIDATED: 'Resolve entity and apply event policy.',
    REVIEW_REQUIRED: 'Resolve uncertainty using evidence; do not create a second event.',
    DECIDED: 'Compile governed TransactionPlan.',
    PLANNED: 'Execute through MAGOS Transaction Writer.',
    EXECUTING: 'Await writer read-back.',
    COMMITTED: 'No further runtime action.',
    RETRY_REQUIRED: 'Correct retryable blocker and replay the same event idempotency key.',
    FAILED: 'Investigate failure before any replay.',
    DUPLICATE: 'No action; duplicate safely suppressed.',
    REJECTED: 'No business mutation. Retain source evidence.',
    IGNORED: 'No action.'
  };
  return map[state] || '';
}

class EventObserver {
  constructor({ ledger, processorVersion = PROCESSOR_VERSION } = {}) {
    this.ledger = ledger || new AuditLedger();
    this.processorVersion = processorVersion;
  }

  async ensure(envelope) {
    if (!envelope?.event_id || !envelope?.idempotency_key) {
      throw new Error('event_id and idempotency_key are required for observability');
    }

    const key = observationKey(envelope.idempotency_key);
    const existing = await this.ledger.findByKey(
      'Automation_Run_Log',
      'idempotency_key',
      key
    );
    if (existing) return existing.object;

    const now = isoNow();
    const row = {
      run_log_id: 'ARL-' + crypto.randomUUID(),
      automation_id: 'MAGOS-EVENT-PROCESSOR-V1',
      provider_run_id: '',
      run_state: 'EVENT_TRACKING',
      trigger_type: envelope.source,
      started_at: now,
      completed_at: '',
      idempotency_key: key,
      input_scope: envelope.event_type,
      affected_record_ids: '',
      writes_summary: '',
      readback_summary: '',
      error_or_blocker: '',
      evidence_link: envelope.evidence?.[0]?.ref || '',
      logged_at: now,
      event_id: envelope.event_id,
      correlation_id: envelope.correlation_id || '',
      event_source: envelope.source,
      source_event_id: envelope.source_event_id,
      event_type: envelope.event_type,
      event_state: 'RECEIVED',
      last_successful_stage: 'RECEIVED',
      decision_reason: '',
      next_action: nextActionFor('RECEIVED'),
      retry_count: '0',
      processor_version: this.processorVersion,
      event_idempotency_key: envelope.idempotency_key,
      related_ids_json: JSON.stringify(relatedIds(envelope)),
      state_changed_at: now
    };

    await this.ledger.appendObject('Automation_Run_Log', row);
    await this.appendTransition(envelope, {
      previousState: '',
      newState: 'RECEIVED',
      stage: 'INGRESS',
      reasonCode: 'EVENT_RECEIVED',
      reason: 'Event accepted into MAGOS observability boundary.',
      retryCount: 0,
      related: relatedIds(envelope),
      observationRunKey: key
    });
    return row;
  }

  async appendTransition(envelope, {
    previousState,
    newState,
    stage = '',
    reasonCode = '',
    reason = '',
    retryCount = 0,
    related = {},
    observationRunKey
  }) {
    await this.ledger.appendObject('Event_Transition_Log', {
      transition_id: 'ETL-' + crypto.randomUUID(),
      event_id: envelope.event_id,
      event_idempotency_key: envelope.idempotency_key,
      correlation_id: envelope.correlation_id || '',
      event_source: envelope.source,
      source_event_id: envelope.source_event_id,
      event_type: envelope.event_type,
      previous_state: previousState || '',
      new_state: newState,
      stage,
      reason_code: reasonCode,
      reason,
      related_ids_json: JSON.stringify(related || {}),
      retry_count: String(retryCount),
      processor_version: this.processorVersion,
      evidence_link: envelope.evidence?.[0]?.ref || '',
      changed_at: isoNow(),
      observation_run_key: observationRunKey || observationKey(envelope.idempotency_key)
    });
  }

  async transition(envelope, newState, {
    stage = '',
    reasonCode = '',
    reason = '',
    related = {},
    nextAction = null
  } = {}) {
    await this.ensure(envelope);
    const key = observationKey(envelope.idempotency_key);
    const current = await this.ledger.findByKey(
      'Automation_Run_Log',
      'idempotency_key',
      key
    );
    if (!current) throw new Error('Event observation row disappeared');

    const previousState = current.object.event_state || 'RECEIVED';
    if (previousState === newState) return current.object;

    const allowed = ALLOWED_TRANSITIONS[previousState] || new Set();
    if (!allowed.has(newState)) {
      throw new Error(
        'Illegal event transition ' + previousState + ' -> ' + newState
      );
    }

    const retryCount =
      Number(current.object.retry_count || 0) +
      (newState === 'RETRY_REQUIRED' ? 1 : 0);
    const mergedRelated = {
      ...(() => {
        try { return JSON.parse(current.object.related_ids_json || '{}'); }
        catch { return {}; }
      })(),
      ...related
    };
    const now = isoNow();
    const terminal = TERMINAL_STATES.has(newState);

    await this.ledger.updateFieldsByKey(
      'Automation_Run_Log',
      'idempotency_key',
      key,
      {
        event_state: newState,
        last_successful_stage:
          ['RETRY_REQUIRED', 'FAILED', 'REJECTED'].includes(newState)
            ? (current.object.last_successful_stage || previousState)
            : newState,
        decision_reason: reasonCode || current.object.decision_reason || '',
        next_action: nextAction === null ? nextActionFor(newState) : nextAction,
        retry_count: String(retryCount),
        processor_version: this.processorVersion,
        related_ids_json: JSON.stringify(mergedRelated),
        state_changed_at: now,
        logged_at: now,
        run_state: terminal ? newState : 'EVENT_TRACKING',
        completed_at: terminal ? now : '',
        error_or_blocker:
          ['RETRY_REQUIRED', 'FAILED', 'REJECTED'].includes(newState)
            ? (reason || reasonCode || '')
            : ''
      }
    );

    await this.appendTransition(envelope, {
      previousState,
      newState,
      stage,
      reasonCode,
      reason,
      retryCount,
      related: mergedRelated,
      observationRunKey: key
    });

    return (await this.ledger.findByKey(
      'Automation_Run_Log',
      'idempotency_key',
      key
    )).object;
  }
}

module.exports = {
  EventObserver,
  observationKey,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES,
  nextActionFor,
  relatedIds
};
