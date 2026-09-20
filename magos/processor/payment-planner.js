'use strict';

const crypto = require('crypto');
const {
  createIfAbsent,
  allocatePayment,
  composeTransactionPlan
} = require('../writer/operations');

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function safeId(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function paymentEventId(envelope) {
  const payment = envelope.payload.payment || {};
  if (payment.provider_transaction_id) {
    return 'PAYEVT-' + safeId(payment.provider_transaction_id);
  }
  const digest = crypto
    .createHash('sha256')
    .update(envelope.idempotency_key)
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();
  return 'PAYEVT-PROOF-' + digest;
}

function allocationId(paymentEventIdValue) {
  return 'ALLOC-' + safeId(paymentEventIdValue) + '-01';
}

function buildPaymentEventValues(envelope, match, now = new Date()) {
  const payment = envelope.payload.payment || {};
  const observation = String(payment.observation_type || '').toUpperCase();
  const ids = match.canonical_ids || {};
  const id = paymentEventId(envelope);

  return {
    payment_event_id: id,
    control_id: ids.control_id || '',
    event_type: observation === 'CLEARED'
      ? 'PAYMENT_CLEARED'
      : 'PAYMENT_PROOF_RECEIVED',
    event_date: required(payment.event_date, 'payment.event_date'),
    amount: String(required(payment.amount, 'payment.amount')),
    currency: payment.currency || 'ZAR',
    payer_reference: payment.payer_reference || '',
    provider_transaction_id: payment.provider_transaction_id || '',
    clearance_state: observation === 'CLEARED' ? 'CLEARED' : 'PROOF_RECEIVED',
    crm_id: ids.crm_id || '',
    opportunity_id: ids.opportunity_id || '',
    invoice_id: ids.invoice_id || '',
    job_id: ids.job_id || '',
    parent_payment_event_id: payment.parent_payment_event_id || '',
    evidence_link: envelope.evidence?.[0]?.ref || '',
    idempotency_key: envelope.idempotency_key,
    source_system: envelope.source,
    created_at: now.toISOString(),
    created_by: 'MAGOS-P5H',
    notes: observation === 'CLEARED'
      ? 'Cleared payment record from approved clearance evidence and exact canonical match.'
      : 'Payment proof received. Clearance remains unproven until separate bank/gateway authority is captured.'
  };
}

function buildAllocationValues(envelope, match, paymentEventIdValue) {
  const payment = envelope.payload.payment || {};
  const ids = match.canonical_ids || {};
  const invoiceId = required(ids.invoice_id, 'canonical invoice_id for allocation');
  const amount = String(required(payment.amount, 'payment.amount'));

  return {
    allocation_id: allocationId(paymentEventIdValue),
    payment_event_id: paymentEventIdValue,
    control_id: ids.control_id || '',
    invoice_id: invoiceId,
    deposit_id: ids.deposit_id || '',
    allocation_type: ids.deposit_id ? 'DEPOSIT' : 'INVOICE',
    amount,
    allocation_state: 'CLEARED',
    allocated_at: payment.event_date,
    evidence_link: envelope.evidence?.[0]?.ref || '',
    idempotency_key: 'ALLOC|' + paymentEventIdValue + '|' + invoiceId + '|' + amount,
    created_by: 'MAGOS-P5H',
    notes: 'Exact allocation from cleared payment record. Payment Control remains derived and is not directly mutated here.'
  };
}

function planPaymentObservation(envelope, match, { now = () => new Date() } = {}) {
  const payment = envelope.payload.payment || {};
  const observation = String(payment.observation_type || '').toUpperCase();
  const eventValues = buildPaymentEventValues(envelope, match, now());

  const writes = [
    createIfAbsent({
      store: 'commercial',
      workbook_role: 'COMMERCIAL',
      sheet: 'Payment_Events',
      key: {
        header: 'payment_event_id',
        value: eventValues.payment_event_id
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Payment event',
      intent: 'RECORD_PAYMENT_OBSERVATION',
      values: eventValues
    })
  ];

  if (observation === 'CLEARED') {
    if (!match.canonical_ids?.invoice_id) {
      throw new Error('CLEARED payment requires exact invoice_id before allocation');
    }

    const allocValues = buildAllocationValues(
      envelope,
      match,
      eventValues.payment_event_id
    );

    writes.push(
      allocatePayment({
        store: 'commercial',
        workbook_role: 'COMMERCIAL',
        sheet: 'Payment_Allocations',
        key: {
          header: 'allocation_id',
          value: allocValues.allocation_id
        },
        authority: 'AUTHORITATIVE',
        entity_type: 'Payment allocation',
        intent: 'ALLOCATE_CLEARED_PAYMENT',
        values: allocValues
      })
    );
  }

  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    input_scope: 'PAYMENT_OBSERVATION',
    evidence_link: envelope.evidence?.[0]?.ref || '',
    preconditions: [],
    writes
  });
}

module.exports = {
  planPaymentObservation,
  buildPaymentEventValues,
  buildAllocationValues,
  paymentEventId,
  allocationId
};
