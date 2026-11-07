'use strict';

const {
  createSupplierEmailReceivedEvent
} = require('../processor/supplier-email-observation');

const MAIL_PROVIDERS = new Set(['GMAIL', 'OUTLOOK']);

function supplierEmailSource(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function parseAllowedSupplierEmailSources(value = '') {
  return new Set(
    value.split(',').map(supplierEmailSource).filter(source => MAIL_PROVIDERS.has(source))
  );
}

function requiredString(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    const error = new Error(field + ' must be a non-empty string of at most ' + maxLength + ' characters');
    error.code = 'SUPPLIER_EMAIL_INGRESS_INVALID_PAYLOAD';
    throw error;
  }
  return value.trim();
}

function createSupplierEmailEventFromIngress(input, { source, receivedAt = new Date() }) {
  const email = input?.email;
  const sourceEventId = requiredString(input?.source_event_id, 'source_event_id', 512);
  const evidenceRef = requiredString(input?.evidence_ref, 'evidence_ref', 2048);
  const senderEmail = requiredString(email?.sender_email, 'email.sender_email', 320);
  if (!/^[^\s@]+@[^\s@]+$/.test(senderEmail)) {
    const error = new Error('email.sender_email must be an individual mailbox address');
    error.code = 'SUPPLIER_EMAIL_INGRESS_INVALID_PAYLOAD';
    throw error;
  }
  if (input.occurred_at && Number.isNaN(Date.parse(input.occurred_at))) {
    const error = new Error('occurred_at must be a valid date');
    error.code = 'SUPPLIER_EMAIL_INGRESS_INVALID_PAYLOAD';
    throw error;
  }
  return createSupplierEmailReceivedEvent({
    source,
    source_event_id: sourceEventId,
    occurred_at: input.occurred_at,
    guards: input.guards,
    safety_attestation: input.safety_attestation,
    evidence: [{ type: source + '_MESSAGE', ref: evidenceRef }],
    // Supplier authority must resolve the exact observed sender. The transport
    // cannot assert a supplier ID or choose another event type.
    email: { ...email, sender_email: senderEmail, supplier_id: '' }
  }, { receivedAt });
}

module.exports = {
  supplierEmailSource,
  parseAllowedSupplierEmailSources,
  createSupplierEmailEventFromIngress
};
