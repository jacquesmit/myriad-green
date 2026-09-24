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

function required(value, name, code = '') {
  if (value === undefined || value === null || value === '') {
    const error = new Error(name + ' is required');
    if (code) error.code = code;
    throw error;
  }
  return value;
}

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function list(value) {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
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
    const error = new Error(
      'safety_attestation.scanned_at must be a valid date'
    );
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
  const supplied = REQUIRED_GUARDS.some(
    key => str(input[key]) !== ''
  );

  if (!supplied) {
    return Object.fromEntries(
      REQUIRED_GUARDS.map(key => [key, 'UNKNOWN'])
    );
  }

  const guards = {};
  let assertsDecision = false;
  for (const key of REQUIRED_GUARDS) {
    const value = str(input[key]).toUpperCase() || 'UNKNOWN';
    if (!GUARD_VALUES.has(value)) {
      const error = new Error('Invalid guard value for ' + key);
      error.code = 'SUPPLIER_EMAIL_GUARD_INVALID';
      throw error;
    }
    if (value !== 'UNKNOWN') assertsDecision = true;
    guards[key] = value;
  }

  if (assertsDecision && !attestation) {
    const error = new Error(
      'Supplier-email safety decisions require scan provenance'
    );
    error.code = 'SUPPLIER_EMAIL_GUARD_ATTESTATION_REQUIRED';
    throw error;
  }

  return guards;
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
      str(input.attachment_accessibility).toUpperCase() || 'UNKNOWN',
    urgency: str(input.urgency).toUpperCase() || 'UNKNOWN',
    requires_review: input.requires_review === true,
    review_reason: str(input.review_reason),
    notes: str(input.notes)
  };
}

function createSupplierEmailReceivedEvent(input = {}, {
  receivedAt = new Date()
} = {}) {
  const source = required(
    str(input.source || 'GMAIL'),
    'source',
    'SUPPLIER_EMAIL_SOURCE_REQUIRED'
  );
  const sourceEventId = required(
    str(input.source_event_id),
    'source_event_id',
    'SUPPLIER_EMAIL_EVENT_ID_REQUIRED'
  );
  const evidence = Array.isArray(input.evidence)
    ? input.evidence.filter(item => str(item?.ref))
    : [];
  if (!evidence.length) {
    const error = new Error(
      'Supplier email requires immutable source evidence'
    );
    error.code = 'SUPPLIER_EMAIL_EVIDENCE_REQUIRED';
    throw error;
  }

  const attestation = normalizeSafetyAttestation(
    input.safety_attestation || {}
  );
  const guards = normalizeGuards(
    input.guards || {},
    attestation
  );
  const email = normalizeSupplierEmail(input.email || input);

  const event = createEventEnvelope({
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
    guards,
    evidence,
    payload: { supplier_email: email },
    metadata: {
      supplier_email_observation_version:
        'MAGOS-SUPPLIER-EMAIL-OBSERVATION/V1'
    }
  });

  if (attestation) {
    event.metadata.safety_attestation = attestation;
  }

  return event;
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
