'use strict';

const { AuditLedger } = require('../adapters/audit-ledger');
const { EventProcessor } = require('./event-processor');

const REVIEW_PREFIX = 'review:event:';

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function reviewKey(eventIdempotencyKey) {
  return REVIEW_PREFIX + required(eventIdempotencyKey, 'eventIdempotencyKey');
}

function compactReviewPayload(envelope, decision) {
  return {
    event: {
      schema_version: envelope.schema_version,
      event_id: envelope.event_id,
      source: envelope.source,
      source_event_id: envelope.source_event_id,
      event_type: envelope.event_type,
      idempotency_key: envelope.idempotency_key,
      evidence: envelope.evidence,
      entity_hints: envelope.entity_hints,
      metadata: envelope.metadata
    },
    decision: {
      decision: decision.decision,
      reason_code: decision.reason_code,
      reason: decision.reason || '',
      match: decision.match || null,
      unknown_guards: decision.unknown_guards || []
    }
  };
}

class ReviewManager {
  constructor({ ledger } = {}) {
    this.ledger = ledger || new AuditLedger();
  }

  async open(envelope, decision) {
    if (decision?.decision !== 'REVIEW_REQUIRED') {
      throw new Error('Only REVIEW_REQUIRED decisions may open review');
    }

    const key = reviewKey(envelope.idempotency_key);
    const payload = compactReviewPayload(envelope, decision);

    const exceptionId = await this.ledger.raiseSyncException({
      idempotencyKey: key,
      entityType: 'EVENT_REVIEW',
      recordId: envelope.event_id,
      sourceSystem: envelope.source,
      destinationSystem: 'MAGOS Event Processor',
      exceptionType: decision.reason_code || 'EVENT_REVIEW_REQUIRED',
      severity: 'MEDIUM',
      sourceValue: JSON.stringify(payload),
      destinationValue: '',
      actionRequired:
        'Resolve the recorded ambiguity/uncertainty using evidence. Reuse the original event idempotency key; do not create a second event.',
      evidence: envelope.evidence?.[0]?.ref || '',
      ruleId: 'MAGOS-EVENT-PROCESSOR-01/V1'
    });

    return {
      exception_id: exceptionId,
      review_key: key,
      event_id: envelope.event_id,
      event_idempotency_key: envelope.idempotency_key
    };
  }

  async get(eventIdempotencyKey) {
    return this.ledger.findByKey(
      'Sync_Exceptions',
      'idempotency_key',
      reviewKey(eventIdempotencyKey)
    );
  }

  async recordResolution({
    eventIdempotencyKey,
    resolution,
    approvedMatch = null,
    owner = 'Jacques',
    evidence = ''
  }) {
    const normalized = String(required(resolution, 'resolution')).toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(normalized)) {
      throw new Error('resolution must be APPROVE or REJECT');
    }

    const key = reviewKey(eventIdempotencyKey);
    const existing = await this.get(eventIdempotencyKey);
    if (!existing) throw new Error('Review item not found for ' + eventIdempotencyKey);

    if (normalized === 'APPROVE') {
      if (!approvedMatch || approvedMatch.status !== 'MATCHED') {
        throw new Error('APPROVE requires approvedMatch.status=MATCHED');
      }
      if (Number(approvedMatch.confidence || 0) !== 1) {
        throw new Error('APPROVE requires confidence=1');
      }
      if (!['EXACT_ID', 'EXACT_REFERENCE', 'EXACT_FILE_LINK'].includes(approvedMatch.basis)) {
        throw new Error('APPROVE requires an exact approved match basis');
      }
    }

    const destinationValue = JSON.stringify({
      resolution: normalized,
      owner,
      approved_match: approvedMatch,
      evidence
    });

    await this.ledger.updateFieldsByKey(
      'Sync_Exceptions',
      'idempotency_key',
      key,
      {
        destination_value: destinationValue,
        action_required: normalized === 'APPROVE'
          ? 'Resume the original event through the processor and P3 writer using the approved exact match. Preserve the original idempotency key.'
          : 'Do not mutate business state for this event. Preserve the review record and source evidence.',
        owner,
        status: normalized === 'APPROVE' ? 'IN_PROGRESS' : 'RESOLVED',
        resolved_at: normalized === 'REJECT' ? new Date().toISOString() : '',
        evidence: evidence || existing.object.evidence || ''
      }
    );

    return {
      review_key: key,
      resolution: normalized,
      approved_match: approvedMatch
    };
  }

  async resume(envelope, {
    approvedMatch,
    planner,
    duplicateChecker = async () => false
  }) {
    required(envelope?.idempotency_key, 'envelope.idempotency_key');
    required(planner, 'planner');

    const existing = await this.get(envelope.idempotency_key);
    if (!existing) throw new Error('Review item not found for event');

    const parsed = (() => {
      try {
        return JSON.parse(existing.object.destination_value || '{}');
      } catch {
        return {};
      }
    })();

    if (parsed.resolution !== 'APPROVE') {
      throw new Error('Review item is not approved for resume');
    }

    const exact = approvedMatch || parsed.approved_match;
    if (!exact || exact.status !== 'MATCHED') {
      throw new Error('Approved exact match is required to resume');
    }

    const processor = new EventProcessor({
      duplicateChecker,
      resolver: async () => exact,
      planner
    });

    const decision = await processor.decide(envelope);
    if (decision.decision !== 'AUTO_WRITE') {
      return decision;
    }

    if (decision.idempotency_key !== envelope.idempotency_key) {
      throw new Error('Resume changed event idempotency key');
    }

    return {
      ...decision,
      resumed_from_review: true,
      review_key: reviewKey(envelope.idempotency_key)
    };
  }

  async markCommitted(eventIdempotencyKey, evidence = '') {
    const key = reviewKey(eventIdempotencyKey);
    const existing = await this.get(eventIdempotencyKey);
    if (!existing) return false;

    await this.ledger.updateFieldsByKey(
      'Sync_Exceptions',
      'idempotency_key',
      key,
      {
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
        action_required: 'No further action. Original event completed through governed writer.',
        evidence: evidence || existing.object.evidence || ''
      }
    );
    return true;
  }
}

module.exports = {
  ReviewManager,
  reviewKey,
  compactReviewPayload
};
