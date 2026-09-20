'use strict';

const crypto = require('crypto');
const {
  createIfAbsent,
  composeTransactionPlan
} = require('../writer/operations');

function sourceHash(envelope) {
  return crypto
    .createHash('sha256')
    .update(
      String(envelope.source) + '|' +
      String(envelope.source_event_id)
    )
    .digest('hex')
    .toUpperCase();
}

function deterministicIntakeId(envelope) {
  return 'INT-P5O-' + sourceHash(envelope).slice(0, 16);
}

function evidenceLink(envelope) {
  return envelope.evidence?.[0]?.ref || '';
}

function join(items) {
  return Array.isArray(items)
    ? items.filter(Boolean).join(' | ')
    : '';
}

function routingAction(email) {
  if (email.attachment_refs?.length) {
    return 'ROUTE_DOCUMENT_EXTRACTION';
  }
  return 'SUPPLIER_EMAIL_LINKED';
}

function intakeValues(envelope, match, now) {
  const email = envelope.payload.supplier_email || {};
  const supplier = match.supplier || {};
  const explicitReview =
    Boolean(email.requires_review) ||
    Boolean(match.review_required_after_capture);

  return {
    intake_id: deterministicIntakeId(envelope),
    received_at: envelope.received_at,
    source_system: envelope.source,
    source_type: 'SUPPLIER_EMAIL',
    source_event_id: envelope.source_event_id,
    source_thread_id: email.source_thread_id || '',
    sender_name: email.sender_name || '',
    sender_email: email.sender_email || '',
    recipient_email: email.recipient_email || '',
    subject_or_file_name: email.subject || '',
    contact_name: email.sender_name || '',
    contact_email: email.sender_email || '',
    contact_phone: '',
    company: supplier.supplier_name || '',
    property_or_suburb: '',
    service_category: 'SUPPLIER_RELATIONSHIP',
    urgency: email.urgency || 'UNKNOWN',
    source_link: evidenceLink(envelope),
    match_status: 'EXACT_MATCH',
    matched_crm_id: '',
    matched_opportunity_id: '',
    routing_action: routingAction(email),
    processing_status:
      explicitReview ? 'REVIEW_REQUIRED' : 'LINKED',
    review_reason: [
      match.review_reason || '',
      email.requires_review
        ? (email.review_reason || 'Supplier email requires explicit review.')
        : ''
    ].filter(Boolean).join(' '),
    last_checked_at: now.toISOString(),
    notes: email.notes || email.message_summary || '',
    supplier_id: match.canonical_ids?.supplier_id || '',
    business_document_type: email.business_document_type || '',
    attachment_filenames: join(email.attachment_filenames),
    attachment_refs: join(email.attachment_refs),
    attachment_accessibility: email.attachment_accessibility || ''
  };
}

function planSupplierEmail(envelope, match, {
  now = () => new Date()
} = {}) {
  const values = intakeValues(envelope, match, now());

  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    input_scope: 'SUPPLIER_EMAIL_RECEIVED',
    evidence_link: evidenceLink(envelope),
    preconditions: [],
    writes: [
      createIfAbsent({
        store: 'crm',
        workbook_role: 'CRM',
        sheet: 'Intake_Queue',
        key: {
          header: 'intake_id',
          value: values.intake_id
        },
        authority: 'AUTHORITATIVE',
        entity_type: 'Source event',
        intent: 'REGISTER_SUPPLIER_EMAIL_SOURCE_EVENT',
        values,
        required_headers: [
          'intake_id',
          'source_system',
          'source_event_id',
          'supplier_id',
          'processing_status'
        ]
      })
    ]
  });
}

module.exports = {
  planSupplierEmail,
  deterministicIntakeId,
  intakeValues,
  routingAction,
  sourceHash
};
