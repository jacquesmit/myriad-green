'use strict';

const { createEventEnvelope } = require('./event-envelope');

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
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR',
      ...(input.guards || {})
    },
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    payload: { supplier_email: email },
    metadata: {
      supplier_email_observation_version:
        'MAGOS-SUPPLIER-EMAIL-OBSERVATION/V1'
    }
  });
}

module.exports = {
  createSupplierEmailReceivedEvent,
  normalizeSupplierEmail,
  list
};
