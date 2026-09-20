'use strict';

const { createEventEnvelope } = require('./event-envelope');

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

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function list(value) {
  if (Array.isArray(value)) {
    return value.map(str).filter(Boolean);
  }
  if (value === undefined || value === null || value === '') return [];
  return [str(value)].filter(Boolean);
}

function normalizeSafetyAttestation(input = {}) {
  const provider = str(input.provider);
  const scanId = str(input.scan_id);
  const scannedAt = str(input.scanned_at);

  if (!provider && !scanId && !scannedAt) return null;
  if (!provider || !scanId || !scannedAt) {
    const error = new Error(
      'safety_attestation requires provider, scan_id and scanned_at'
    );
    error.code = 'SUPPLIER_EMAIL_GUARD_ATTESTATION_INVALID';
    throw error;
  }

  const parsed = new Date(scannedAt);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('safety_attestation.scanned_at must be a valid date');
    error.code = 'SUPPLIER_EMAIL_GUARD_ATTESTATION_INVALID';
    throw error;
  }

  return {
    provider,
    scan_id: scanId,
    scanned_at: parsed.toISOString()
  };
}

function normalizeGuards(input = {}, attestation = null) {
  const suppliedKeys = REQUIRED_GUARDS.filter(
    key => str(input[key]) !== ''
  );

  if (!suppliedKeys.length) {
    return Object.fromEntries(
      REQUIRED_GUARDS.map(key => [key, 'UNKNOWN'])
    );
  }

  const out = {};
  let assertsDecision = false;
  for (const key of REQUIRED_GUARDS) {
    const raw = str(input[key]).toUpperCase() || 'UNKNOWN';
    if (!GUARD_VALUES.has(raw)) {
      const error = new Error('Invalid guard value for ' + key);
      error.code = 'SUPPLIER_EMAIL_GUARD_INVALID';
      error.guard = key;
      throw error;
    }
    if (raw !== 'UNKNOWN') assertsDecision = true;
    out[key] = raw;
  }

  if (assertsDecision && !attestation) {
    const error = new Error(
      'Supplier email safety decisions require safety_attestation provenance'
    );
    error.code = 'SUPPLIER_EMAIL_GUARD_ATTESTATION_REQUIRED';
    throw error;
  }

  return out;
}

function normalizeSupplierEmail(input = {}) {
  return {
    supplier_id: str(input.supplier_id),
    source_thread_id: str(input.source_thread_id),
    sender_name: str(input.sender_name),
    sender_email: str(input.sender_email).toLowerCase(),
    recipient_email: str(input.recipient_email).toLowerCase(),
    subject: str(input.subject),
    message_summary: str(input.message_summary),
    business_document_type:
      str(input.business_document_type).toUpperCase(),
    attachment_filenames: list(input.attachment_filenames),
    attachment_refs: list(input.attachment_refs),
    attachment_accessibility:
      str(input.attachment_accessibility).toUpperCase(),
    urgency: str(input.urgency).toUpperCase() || 'UNKNOWN',
    requires_review: input.requires_review === true,
    review_reason: str(input.review_reason),
    notes: str(input.notes)
  };
}

function createSupplierEmailReceivedEvent(input = {}, {
  receivedAt = new Date()
} = {}) {
  const source = required(input.source || 'GMAIL', 'source');
  const sourceEventId = required(input.source_event_id, 'source_event_id');
  const email = normalizeSupplierEmail(input.email || input);
  const attestation = normalizeSafetyAttestation(
    input.safety_attestation || {}
  );

  return createEventEnvelope({
    source,
    source_event_id: sourceEventId,
    event_type: 'SUPPLIER_EMAIL_RECEIVED',
    occurred_at: input.occurred_at || receivedAt,
    received_at: input.received_at || receivedAt,
    ...(input.correlation_id
      ? { correlation_id: String(input.correlation_id) }
      : {}),
    entity_hints: {
      ...(email.supplier_id ? { supplier_id: email.supplier_id } : {})
    },
    guards: normalizeGuards(input.guards || {}, attestation),
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    payload: { supplier_email: email },
    metadata: {
      supplier_email_observation_version:
        'MAGOS-SUPPLIER-EMAIL-OBSERVATION/V1',
      ...(attestation ? { safety_attestation: attestation } : {})
    }
  });
}

module.exports = {
  GUARD_VALUES,
  REQUIRED_GUARDS,
  createSupplierEmailReceivedEvent,
  normalizeSupplierEmail,
  normalizeSafetyAttestation,
  normalizeGuards,
  list
};
