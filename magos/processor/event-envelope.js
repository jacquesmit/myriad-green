'use strict';

const crypto = require('crypto');

const SCHEMA_VERSION = 'MAGOS-EVENT-ENVELOPE/V1';
const GUARD_VALUES = new Set(['CLEAR', 'BLOCK', 'UNKNOWN']);
const REQUIRED_GUARDS = [
  'spam',
  'phishing',
  'explicit_content',
  'malware',
  'irrelevant'
];

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + stableStringify(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeGuards(guards = {}) {
  const out = {};
  for (const key of REQUIRED_GUARDS) {
    const value = String(guards[key] || 'UNKNOWN').toUpperCase();
    if (!GUARD_VALUES.has(value)) {
      throw new Error('guards.' + key + ' must be CLEAR, BLOCK, or UNKNOWN');
    }
    out[key] = value;
  }
  return out;
}

function toIso(value, name) {
  const date = value instanceof Date ? value : new Date(required(value, name));
  if (Number.isNaN(date.getTime())) throw new Error(name + ' must be a valid date');
  return date.toISOString();
}

function deriveIdempotencyKey({ source, source_event_id, event_type }) {
  const material = [source, source_event_id, event_type].map(String).join('|');
  return 'MAGOS_EVENT_V1|' + sha256(material).slice(0, 40).toUpperCase();
}

function deriveEventId({ source, source_event_id, event_type }) {
  const material = stableStringify({ source, source_event_id, event_type });
  return 'EVT-' + sha256(material).slice(0, 24).toUpperCase();
}

function createEventEnvelope(input = {}, { now = () => new Date() } = {}) {
  const source = required(input.source, 'source');
  const sourceEventId = required(input.source_event_id, 'source_event_id');
  const eventType = required(input.event_type, 'event_type');

  const envelope = {
    schema_version: SCHEMA_VERSION,
    event_id: input.event_id || deriveEventId({
      source,
      source_event_id: sourceEventId,
      event_type: eventType
    }),
    ...(input.correlation_id ? { correlation_id: String(input.correlation_id) } : {}),
    source: String(source),
    source_event_id: String(sourceEventId),
    event_type: String(eventType),
    occurred_at: toIso(input.occurred_at || now(), 'occurred_at'),
    received_at: toIso(input.received_at || now(), 'received_at'),
    idempotency_key: input.idempotency_key || deriveIdempotencyKey({
      source,
      source_event_id: sourceEventId,
      event_type: eventType
    }),
    actor: input.actor ?? null,
    entity_hints: structuredClone(input.entity_hints || {}),
    guards: normalizeGuards(input.guards),
    evidence: structuredClone(Array.isArray(input.evidence) ? input.evidence : []),
    payload: structuredClone(input.payload || {}),
    metadata: structuredClone(input.metadata || {})
  };

  validateEventEnvelope(envelope);
  return envelope;
}

function validateEventEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('event envelope must be an object');
  }
  if (envelope.schema_version !== SCHEMA_VERSION) {
    throw new Error('schema_version must be ' + SCHEMA_VERSION);
  }

  for (const key of [
    'event_id',
    'source',
    'source_event_id',
    'event_type',
    'occurred_at',
    'received_at',
    'idempotency_key'
  ]) {
    required(envelope[key], key);
  }

  toIso(envelope.occurred_at, 'occurred_at');
  toIso(envelope.received_at, 'received_at');
  normalizeGuards(envelope.guards);

  if (!Array.isArray(envelope.evidence)) {
    throw new Error('evidence must be an array');
  }
  for (const item of envelope.evidence) {
    if (!item || typeof item !== 'object') throw new Error('evidence entries must be objects');
    required(item.type, 'evidence.type');
    required(item.ref, 'evidence.ref');
  }

  if (!envelope.payload || typeof envelope.payload !== 'object' || Array.isArray(envelope.payload)) {
    throw new Error('payload must be an object');
  }

  return true;
}

module.exports = {
  SCHEMA_VERSION,
  REQUIRED_GUARDS,
  createEventEnvelope,
  validateEventEnvelope,
  deriveIdempotencyKey,
  deriveEventId,
  stableStringify
};
