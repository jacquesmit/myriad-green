'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createPaymentObservedEvent } = require('../processor/payment-observation');
const { PaymentResolver } = require('../processor/resolve-payment');
const { planPaymentObservation } = require('../processor/plan-payment');
const { EventProcessor } = require('../processor/event-processor');
const { createPaymentProcessor } = require('../processor/payment-processor');

function event(overrides = {}) {
  return createPaymentObservedEvent({
    source: 'DRIVE_00A',
    source_event_id: 'PAYDOC-1',
    evidence: [{ type: 'PAYMENT_EVIDENCE', ref: 'drive://paydoc-1' }],
    payment: {
      amount: 2500,
      currency: 'ZAR',
      event_date: '2026-09-20T10:00:00Z',
      payer_reference: 'MRG-INV-TEST-1',
      invoice_id: 'INV-1',
      clearance_authority: 'CLIENT_PROOF',
      ...overrides
    }
  }, {
    receivedAt: new Date('2026-09-20T10:01:00Z')
  });
}

function invoice(balance = 'R 5,000.00', opportunityId = 'OPP-1') {
  return {
    'Document No.': 'MRG-INV-TEST-1',
    'Balance (R)': balance,
    crm_id: 'CRM-1',
    opportunity_id: opportunityId,
    invoice_id: 'INV-1',
    job_id: 'JOB-1'
  };
}

test('client proof remains PROOF_RECEIVED and never creates cleared allocation', async () => {
  const env = event();
  assert.equal(env.payload.payment.clearance_state, 'PROOF_RECEIVED');
  assert.equal(env.payload.payment.event_type, 'PAYMENT_PROOF_RECEIVED');

  const resolver = new PaymentResolver({
    findEntityByCanonicalId: async (type, id) =>
      type === 'Invoice' && id === 'INV-1' ? invoice() : null
  });

  const match = await resolver.resolve(env);
  const plan = planPaymentObservation(env, match, {
    now: () => new Date('2026-09-20T10:02:00Z')
  });

  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].sheet, 'Payment_Events');
  assert.equal(plan.writes[0].values.clearance_state, 'PROOF_RECEIVED');
  assert.equal(plan.writes[0].values.event_type, 'PAYMENT_PROOF_RECEIVED');
});

test('beneficiary-bank evidence creates CLEARED event and exact invoice allocation', async () => {
  const env = event({
    clearance_authority: 'BENEFICIARY_BANK',
    provider_transaction_id: 'BANK-TXN-1'
  });

  const resolver = new PaymentResolver({
    findPaymentEventByProviderTransactionId: async () => null,
    findEntityByCanonicalId: async (type, id) =>
      type === 'Invoice' && id === 'INV-1' ? invoice() : null
  });
  const match = await resolver.resolve(env);

  const plan = planPaymentObservation(env, match, {
    now: () => new Date('2026-09-20T10:02:00Z')
  });

  assert.equal(plan.writes.length, 2);
  assert.equal(plan.writes[0].values.clearance_state, 'CLEARED');
  assert.equal(plan.writes[1].sheet, 'Payment_Allocations');
  assert.equal(plan.writes[1].values.allocation_state, 'CLEARED');
  assert.equal(plan.writes[1].values.invoice_id, 'INV-1');
  assert.equal(plan.writes[1].values.amount, 2500);
});

test('payment larger than exact invoice balance becomes conflict/review', async () => {
  const env = event({
    amount: 2500,
    clearance_authority: 'BENEFICIARY_BANK'
  });
  const resolver = new PaymentResolver({
    findEntityByCanonicalId: async () => invoice('R 1,000.00')
  });

  const match = await resolver.resolve(env);
  assert.equal(match.status, 'CONFLICT');

  const decision = await new EventProcessor({
    resolver: async () => match,
    planner: async () => {
      throw new Error('planner must not run');
    }
  }).decide(env);

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'CONFLICTING_MATCH');
});

test('invoice document number can be used as exact reference', async () => {
  const env = event({
    invoice_id: '',
    invoice_document_no: 'MRG-INV-TEST-1'
  });
  const resolver = new PaymentResolver({
    findInvoiceByDocumentNo: async (number) =>
      number === 'MRG-INV-TEST-1' ? invoice() : null
  });

  const match = await resolver.resolve(env);
  assert.equal(match.status, 'MATCHED');
  assert.equal(match.basis, 'EXACT_REFERENCE');
  assert.equal(match.canonical_ids.invoice_id, 'INV-1');
  assert.deepEqual(match.allocation_target, {
    type: 'INVOICE',
    id: 'INV-1'
  });
});

test('invoice and payment control with different opportunities conflict', async () => {
  const env = event({
    control_id: 'PAY-1'
  });
  const resolver = new PaymentResolver({
    findEntityByCanonicalId: async (type) => {
      if (type === 'Invoice') return invoice('R 5,000.00', 'OPP-1');
      if (type === 'PaymentControl') {
        return {
          'Control ID': 'PAY-1',
          'Opportunity ID': 'OPP-2',
          crm_id: 'CRM-1'
        };
      }
      return null;
    }
  });

  const match = await resolver.resolve(env);
  assert.equal(match.status, 'CONFLICT');
  assert.match(match.reason, /different opportunities/);
});

test('control-only match may record payment event but cannot auto-allocate', async () => {
  const env = event({
    invoice_id: '',
    control_id: 'PAY-1',
    clearance_authority: 'BENEFICIARY_BANK',
    provider_transaction_id: 'BANK-TXN-2'
  });
  const resolver = new PaymentResolver({
    findPaymentEventByProviderTransactionId: async () => null,
    findEntityByCanonicalId: async (type, id) =>
      type === 'PaymentControl' && id === 'PAY-1'
        ? {
            'Control ID': 'PAY-1',
            'Opportunity ID': 'OPP-1',
            crm_id: 'CRM-1',
            invoice_id: 'INV-FINAL',
            deposit_id: 'DEP-1'
          }
        : null
  });

  const match = await resolver.resolve(env);
  assert.equal(match.status, 'MATCHED');
  assert.equal(match.allocation_target, undefined);

  const plan = planPaymentObservation(env, match, {
    now: () => new Date('2026-09-20T10:02:00Z')
  });
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].values.clearance_state, 'CLEARED');
});

test('existing provider transaction is suppressed as duplicate before planning', async () => {
  const env = event({
    clearance_authority: 'BENEFICIARY_BANK',
    provider_transaction_id: 'BANK-TXN-1'
  });

  let plannerCalls = 0;
  const lookupService = {
    paymentResolverDependencies() {
      return {
        findEntityByCanonicalId: async () => invoice(),
        findPaymentEventByProviderTransactionId: async () => ({
          payment_event_id: 'PAYEVT-BANK-TXN-1'
        }),
        findInvoiceByDocumentNo: async () => null,
        findPaymentControlByQuoteNo: async () => null
      };
    },
    async findPaymentEventByIdempotencyKey() {
      return null;
    },
    async findPaymentEventByProviderTransactionId() {
      return { payment_event_id: 'PAYEVT-BANK-TXN-1' };
    }
  };

  const processor = createPaymentProcessor({ lookupService });
  const originalPlanner = processor.planner;
  processor.planner = async (...args) => {
    plannerCalls++;
    return originalPlanner(...args);
  };

  const decision = await processor.decide(env);
  assert.equal(decision.decision, 'IGNORE');
  assert.equal(decision.reason_code, 'DUPLICATE_EVENT');
  assert.equal(plannerCalls, 0);
});

test('owner-verified bank evidence may be CLEARED without inventing provider transaction ID', async () => {
  const env = event({
    clearance_authority: 'OWNER_VERIFIED_BANK',
    provider_transaction_id: ''
  });
  const resolver = new PaymentResolver({
    findEntityByCanonicalId: async () => invoice()
  });

  const match = await resolver.resolve(env);
  const plan = planPaymentObservation(env, match, {
    now: () => new Date('2026-09-20T10:02:00Z')
  });

  assert.equal(plan.writes[0].values.clearance_state, 'CLEARED');
  assert.equal(plan.writes[0].values.provider_transaction_id, '');
  assert.match(plan.writes[0].values.payment_event_id, /^PAYEVT-/);
});

test('exact deposit_id may create a cleared deposit allocation', async () => {
  const env = event({
    invoice_id: '',
    deposit_id: 'DEP-1',
    clearance_authority: 'BENEFICIARY_BANK',
    provider_transaction_id: 'BANK-TXN-3'
  });
  const resolver = new PaymentResolver({
    findPaymentEventByProviderTransactionId: async () => null,
    findEntityByCanonicalId: async (type, id) =>
      type === 'Deposit' && id === 'DEP-1'
        ? {
            'Control ID': 'PAY-1',
            'Opportunity ID': 'OPP-1',
            crm_id: 'CRM-1',
            deposit_id: 'DEP-1',
            invoice_id: 'INV-DEP-1'
          }
        : null
  });

  const match = await resolver.resolve(env);
  assert.deepEqual(match.allocation_target, {
    type: 'DEPOSIT',
    id: 'DEP-1'
  });

  const plan = planPaymentObservation(env, match, {
    now: () => new Date('2026-09-20T10:02:00Z')
  });
  assert.equal(plan.writes.length, 2);
  assert.equal(plan.writes[1].values.deposit_id, 'DEP-1');
  assert.equal(plan.writes[1].values.allocation_type, 'DEPOSIT');
});
