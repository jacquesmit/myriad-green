'use strict';

const crypto = require('crypto');
const {
  recordImmutableEvent,
  allocatePayment,
  composeTransactionPlan
} = require('../writer/operations');
const { CLEARANCE_AUTHORITIES } = require('./payment-observation');

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function safeToken(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 80);
}

function deterministicPaymentEventId(envelope) {
  const p = envelope.payload.payment;
  if (p.provider_transaction_id) {
    return 'PAYEVT-' + safeToken(p.provider_transaction_id);
  }
  const hash = crypto
    .createHash('sha256')
    .update([
      envelope.source,
      envelope.source_event_id,
      p.event_date,
      Number(p.amount).toFixed(2),
      p.payer_reference || ''
    ].join('|'))
    .digest('hex')
    .slice(0, 24);
  return 'PAYEVT-' + hash;
}

function eventValues(envelope, match, now) {
  const p = envelope.payload.payment;
  const ids = match.canonical_ids || {};
  const cleared = CLEARANCE_AUTHORITIES.has(p.clearance_authority);

  return {
    payment_event_id: deterministicPaymentEventId(envelope),
    control_id: ids.control_id || p.control_id || '',
    event_type: cleared ? 'PAYMENT_CLEARED' : 'PAYMENT_PROOF_RECEIVED',
    event_date: p.event_date,
    amount: Number(p.amount),
    currency: p.currency || 'ZAR',
    payer_reference: p.payer_reference || '',
    provider_transaction_id: p.provider_transaction_id || '',
    clearance_state: cleared ? 'CLEARED' : 'PROOF_RECEIVED',
    crm_id: ids.crm_id || p.crm_id || '',
    opportunity_id: ids.opportunity_id || p.opportunity_id || '',
    invoice_id: ids.invoice_id || p.invoice_id || '',
    job_id: ids.job_id || p.job_id || '',
    parent_payment_event_id: '',
    evidence_link: envelope.evidence?.[0]?.ref || '',
    idempotency_key: envelope.idempotency_key,
    source_system: envelope.source,
    created_at: now.toISOString(),
    created_by: 'MAGOS P5H',
    notes: [
      'Payment observation recorded from immutable source evidence.',
      'clearance_authority=' + p.clearance_authority,
      p.notes || ''
    ].filter(Boolean).join(' ')
  };
}

function allocationValues(envelope, match, paymentEventId, now) {
  const p = envelope.payload.payment;
  const ids = match.canonical_ids || {};
  const targetSpec = match.allocation_target || null;
  if (!targetSpec) return null;

  const controlId = ids.control_id || p.control_id || '';
  const invoiceId =
    targetSpec.type === 'INVOICE'
      ? targetSpec.id
      : (ids.invoice_id || p.invoice_id || '');
  const depositId =
    targetSpec.type === 'DEPOSIT'
      ? targetSpec.id
      : '';

  const target = targetSpec.id;
  const allocationType =
    p.allocation_type ||
    (targetSpec.type === 'DEPOSIT' ? 'DEPOSIT' : 'INVOICE');
  const allocationKey =
    'ALLOC|' + paymentEventId + '|' + target + '|' +
    Number(p.amount).toFixed(2);

  return {
    allocation_id:
      'ALLOC-' +
      crypto.createHash('sha256').update(allocationKey).digest('hex').slice(0, 24),
    payment_event_id: paymentEventId,
    control_id: controlId,
    invoice_id: invoiceId,
    deposit_id: depositId,
    allocation_type: allocationType,
    amount: Number(p.amount),
    allocation_state: 'CLEARED',
    allocated_at: now.toISOString(),
    evidence_link: envelope.evidence?.[0]?.ref || '',
    idempotency_key: allocationKey,
    created_by: 'MAGOS P5H',
    notes: 'Created only from a CLEARED parent payment event with exact canonical target.'
  };
}

function planPaymentObservation(envelope, match, { now = () => new Date() } = {}) {
  const p = envelope?.payload?.payment || {};
  required(p.amount, 'payment.amount');
  required(p.event_date, 'payment.event_date');
  required(p.clearance_authority, 'payment.clearance_authority');

  const at = now();
  const payment = eventValues(envelope, match, at);
  const writes = [
    recordImmutableEvent({
      store: 'commercial',
      workbook_role: 'COMMERCIAL',
      sheet: 'Payment_Events',
      key: {
        header: 'payment_event_id',
        value: payment.payment_event_id
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Payment event',
      intent: 'RECORD_PAYMENT_EVENT',
      values: payment,
      required_headers: [
        'payment_event_id',
        'event_type',
        'event_date',
        'amount',
        'currency',
        'clearance_state',
        'idempotency_key',
        'source_system'
      ]
    })
  ];

  if (payment.clearance_state === 'CLEARED') {
    const allocation = allocationValues(
      envelope,
      match,
      payment.payment_event_id,
      at
    );
    if (allocation) {
      writes.push(allocatePayment({
        store: 'commercial',
        workbook_role: 'COMMERCIAL',
        sheet: 'Payment_Allocations',
        key: {
          header: 'allocation_id',
          value: allocation.allocation_id
        },
        authority: 'AUTHORITATIVE',
        entity_type: 'Payment allocation',
        intent: 'ALLOCATE_CLEARED_PAYMENT',
        values: allocation,
        required_headers: [
          'allocation_id',
          'payment_event_id',
          'allocation_type',
          'amount',
          'allocation_state',
          'idempotency_key'
        ]
      }));
    }
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
  deterministicPaymentEventId,
  eventValues,
  allocationValues
};
