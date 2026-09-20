'use strict';

const crypto = require('crypto');
const { createEventEnvelope } = require('./event-envelope');

const CLEARANCE_AUTHORITIES = new Set([
  'BENEFICIARY_BANK',
  'BANK_API',
  'PAYMENT_GATEWAY',
  'OWNER_VERIFIED_BANK'
]);

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function numberAmount(value) {
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) throw new Error('payment amount must be positive');
  return n;
}

function normalizePaymentObservation(input = {}) {
  const authority = String(input.clearance_authority || 'CLIENT_PROOF').toUpperCase();
  const cleared = CLEARANCE_AUTHORITIES.has(authority);

  return {
    amount: numberAmount(required(input.amount, 'amount')),
    currency: String(input.currency || 'ZAR').toUpperCase(),
    event_date: String(required(input.event_date, 'event_date')),
    payer_reference: String(input.payer_reference || ''),
    provider_transaction_id: String(input.provider_transaction_id || ''),
    clearance_authority: authority,
    clearance_state: cleared ? 'CLEARED' : 'PROOF_RECEIVED',
    event_type: cleared ? 'PAYMENT_CLEARED' : 'PAYMENT_PROOF_RECEIVED',
    invoice_id: String(input.invoice_id || ''),
    invoice_document_no: String(input.invoice_document_no || ''),
    control_id: String(input.control_id || ''),
    deposit_id: String(input.deposit_id || ''),
    quote_no: String(input.quote_no || ''),
    crm_id: String(input.crm_id || ''),
    opportunity_id: String(input.opportunity_id || ''),
    job_id: String(input.job_id || ''),
    allocation_type: String(input.allocation_type || ''),
    notes: String(input.notes || '')
  };
}

function createPaymentObservedEvent(input = {}, {
  receivedAt = new Date()
} = {}) {
  const payment = normalizePaymentObservation(input.payment || input);
  const source = required(input.source, 'source');
  const sourceEventId = required(input.source_event_id, 'source_event_id');

  return createEventEnvelope({
    source,
    source_event_id: sourceEventId,
    event_type: 'PAYMENT_OBSERVED',
    occurred_at: input.occurred_at || payment.event_date,
    received_at: input.received_at || receivedAt,
    ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
    entity_hints: {
      ...(payment.crm_id ? { crm_id: payment.crm_id } : {}),
      ...(payment.opportunity_id ? { opportunity_id: payment.opportunity_id } : {}),
      ...(payment.job_id ? { job_id: payment.job_id } : {}),
      ...(payment.invoice_id ? { invoice_id: payment.invoice_id } : {}),
      ...(payment.control_id ? { control_id: payment.control_id } : {}),
      ...(payment.deposit_id ? { deposit_id: payment.deposit_id } : {})
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
    payload: { payment },
    metadata: {
      payment_observation_version: 'MAGOS-PAYMENT-OBSERVATION/V1',
      source_hash: crypto
        .createHash('sha256')
        .update(JSON.stringify({
          source,
          sourceEventId,
          amount: payment.amount,
          date: payment.event_date,
          provider: payment.provider_transaction_id,
          reference: payment.payer_reference
        }))
        .digest('hex')
    }
  });
}

module.exports = {
  CLEARANCE_AUTHORITIES,
  normalizePaymentObservation,
  createPaymentObservedEvent,
  numberAmount
};
