'use strict';

const rules = require('../rules/event-routing.v1.json');
const { validateEventEnvelope } = require('./event-envelope');

const DECISION_SCHEMA_VERSION = 'MAGOS-DECISION/V1';
const DECISIONS = new Set([
  'AUTO_WRITE',
  'REVIEW_REQUIRED',
  'IGNORE',
  'REJECTED'
]);

function decisionBase(envelope, decision, reasonCode, extras = {}) {
  if (!DECISIONS.has(decision)) throw new Error('invalid decision ' + decision);
  return {
    schema_version: DECISION_SCHEMA_VERSION,
    event_id: envelope.event_id,
    idempotency_key: envelope.idempotency_key,
    decision,
    reason_code: reasonCode,
    rule_version: rules.ruleVersion,
    ...extras
  };
}

function review(envelope, reasonCode, reason, extras = {}) {
  return decisionBase(envelope, 'REVIEW_REQUIRED', reasonCode, {
    reason,
    review: {
      queue: 'Sync_Exceptions',
      event_id: envelope.event_id,
      source: envelope.source,
      source_event_id: envelope.source_event_id,
      evidence: envelope.evidence,
      required_human_decision: true
    },
    ...extras
  });
}

function blockedGuard(envelope) {
  return Object.entries(envelope.guards || {})
    .find(([, value]) => value === rules.blockedGuardValue);
}

function unknownGuards(envelope) {
  return Object.entries(envelope.guards || {})
    .filter(([, value]) => value === rules.unknownGuardValue)
    .map(([key]) => key);
}

function validTransactionPlan(plan, envelope) {
  return Boolean(
    plan &&
    typeof plan === 'object' &&
    plan.idempotency_key &&
    plan.event_type &&
    plan.source_event_id &&
    Array.isArray(plan.preconditions) &&
    Array.isArray(plan.writes) &&
    plan.writes.length &&
    String(plan.source_event_id) === String(envelope.source_event_id)
  );
}

class EventProcessor {
  constructor({
    duplicateChecker = async () => false,
    resolver = async () => ({
      status: 'UNRESOLVED',
      confidence: 0,
      basis: 'NONE',
      candidates: []
    }),
    planner = async () => null
  } = {}) {
    this.duplicateChecker = duplicateChecker;
    this.resolver = resolver;
    this.planner = planner;
  }

  async decide(envelope) {
    try {
      validateEventEnvelope(envelope);
    } catch (error) {
      const safe = envelope && typeof envelope === 'object'
        ? {
            event_id: envelope.event_id || 'UNKNOWN',
            idempotency_key: envelope.idempotency_key || 'UNKNOWN'
          }
        : { event_id: 'UNKNOWN', idempotency_key: 'UNKNOWN' };

      return {
        schema_version: DECISION_SCHEMA_VERSION,
        ...safe,
        decision: 'REJECTED',
        reason_code: 'INVALID_EVENT_ENVELOPE',
        reason: error.message,
        rule_version: rules.ruleVersion
      };
    }

    const blocked = blockedGuard(envelope);
    if (blocked) {
      return decisionBase(envelope, 'REJECTED', 'GUARD_BLOCKED', {
        reason: 'Event blocked by guard: ' + blocked[0],
        blocked_guard: blocked[0]
      });
    }

    const unknown = unknownGuards(envelope);
    if (unknown.length && rules.unknownGuardRequiresReview) {
      return review(
        envelope,
        'GUARD_UNKNOWN',
        'Unknown guard state cannot be treated as clear.',
        { unknown_guards: unknown }
      );
    }

    if (await this.duplicateChecker(envelope.idempotency_key, envelope)) {
      return decisionBase(envelope, 'IGNORE', 'DUPLICATE_EVENT', {
        reason: 'The event idempotency key already exists.'
      });
    }

    const eventRule = rules.eventTypes[envelope.event_type];
    if (!eventRule) {
      return decisionBase(envelope, 'IGNORE', 'UNSUPPORTED_EVENT_TYPE', {
        reason: 'No production rule exists for this event type.'
      });
    }

    if (!eventRule.allowAutoWrite) {
      return review(
        envelope,
        'EVENT_TYPE_REQUIRES_REVIEW',
        'This event type is intentionally not allowed to auto-write.'
      );
    }

    if (rules.requireEvidenceForAutoWrite && !envelope.evidence.length) {
      return review(
        envelope,
        'MISSING_EVIDENCE',
        'Authoritative mutation requires evidence.'
      );
    }

    let match;
    try {
      match = await this.resolver(envelope);
    } catch (error) {
      return review(
        envelope,
        'RESOLUTION_FAILED',
        error.message || 'Entity resolution failed.'
      );
    }

    const allowCreate =
      eventRule.allowCreateWithoutExistingMatch &&
      match?.status === 'CREATE_ALLOWED';

    if (!allowCreate && match?.status !== 'MATCHED') {
      return review(
        envelope,
        match?.status === 'AMBIGUOUS' ? 'AMBIGUOUS_MATCH' :
          match?.status === 'CONFLICT' ? 'CONFLICTING_MATCH' :
            'NO_DETERMINISTIC_MATCH',
        'A deterministic authoritative entity match is required.',
        { match: match || null }
      );
    }

    const minimum = Number(eventRule.minimumConfidence || rules.defaultAutoWriteMinimumConfidence);
    const confidence = Number(match?.confidence || 0);
    if (confidence < minimum) {
      return review(
        envelope,
        'MATCH_CONFIDENCE_TOO_LOW',
        'Match confidence is below the auto-write threshold.',
        { match }
      );
    }

    if (!rules.allowedExactMatchBases.includes(match?.basis)) {
      return review(
        envelope,
        'MATCH_BASIS_NOT_EXACT',
        'Match basis is not approved for automatic mutation.',
        { match }
      );
    }

    let plan;
    try {
      plan = await this.planner(envelope, match);
    } catch (error) {
      return review(
        envelope,
        'TRANSACTION_PLANNING_FAILED',
        error.message || 'Transaction planning failed.',
        { match }
      );
    }

    if (!validTransactionPlan(plan, envelope)) {
      return review(
        envelope,
        'INVALID_TRANSACTION_PLAN',
        'Processor could not produce a valid P3 TransactionPlan.',
        { match }
      );
    }

    if (String(plan.idempotency_key) !== String(envelope.idempotency_key)) {
      return review(
        envelope,
        'IDEMPOTENCY_KEY_MISMATCH',
        'TransactionPlan must preserve the EventEnvelope idempotency key.',
        { match }
      );
    }

    return decisionBase(envelope, 'AUTO_WRITE', 'DETERMINISTIC_MATCH', {
      reason: 'Deterministic match, evidence, guards, and plan all passed.',
      match,
      transaction_plan: plan
    });
  }
}

module.exports = {
  EventProcessor,
  DECISION_SCHEMA_VERSION,
  validTransactionPlan
};
