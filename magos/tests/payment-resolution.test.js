'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createEventEnvelope } = require('../processor/event-envelope');
const { PaymentResolver } = require('../processor/payment-resolver');
const { planPaymentObservation } = require('../processor/payment-planner');
const { EventProcessor } = require('../processor/event-processor');

function paymentEvent(overrides = {}) {
  return createEventEnvelope({
    source: 'DRIVE_00A',
    source_event_id: 'PAYMENT-DOC-1',
    event_type: 'PAYMENT_OBSERVED',
    occurred_at: '2026-09-20T10:00:00Z',
    received_at: '2026-09-20T10:00:01Z',
    entity_hints: {
      invoice_id: 'INV-1',
      control_id: 'PAY-1'
    },
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [{ type: 'PAYMENT_EVIDENCE', ref: 'drive://PAYMENT-DOC-1' }],
    payload: {
      payment: {
        observation_type: 'PROOF_RECEIVED',
        event_date: '2026-09-20',
        amount: 2500,
        currency: 'ZAR',
        payer_reference: 'Client proof'
      }
    },
    ...overrides
  });
}

function lookupFixture() {
  const commercialStore = {
    async findByKey(sheet, key, value) {
      if (sheet === 'Payment_Events' && key === 'provider_transaction_id') {
        return null;
      }
      return null;
    }
  };

  return {
    store(name) {
      if (name !== 'commercial') throw new Error('unexpected store');
      return commercialStore;
    },
    async findEntityByCanonicalId(type, id) {
      if (type === 'Invoice' && id === 'INV-1') {
        return {
          invoice_id: 'INV-1',
          crm_id: 'CRM-1',
          opportunity_id: 'OPP-1',
          job_id: 'JOB-1'
        };
      }
      if (type === 'PaymentControl' && id === 'PAY-1') {
        return {
          'Control ID': 'PAY-1',
          'Opportunity ID': 'OPP-1',
          invoice_id: 'INV-1',
          crm_id: 'CRM-1',
          job_id: 'JOB-1',
          deposit_id: 'DEP-1'
        };
      }
      if (type === 'Deposit' && id === 'DEP-1') {
        return {
          deposit_id: 'DEP-1',
          invoice_id: 'INV-1'
        };
      }
      return null;
    }
  };
}

test('client proof resolves exactly but remains proof-only', async () => {
  const resolver = new PaymentResolver({ lookupService: lookupFixture() });
  const envelope = paymentEvent();

  const match = await resolver.resolve(envelope);
  assert.equal(match.status, 'MATCHED');
  assert.equal(match.confidence, 1);

  const plan = planPaymentObservation(envelope, match, {
    now: () => new Date('2026-09-20T10:02:00Z')
  });

  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].sheet, 'Payment_Events');
  assert.equal(plan.writes[0].values.clearance_state, 'PROOF_RECEIVED');
  assert.equal(plan.writes[0].values.event_type, 'PAYMENT_PROOF_RECEIVED');
});

test('proof cannot silently become cleared because authority is absent', async () => {
  const envelope = paymentEvent({
    payload: {
      payment: {
        observation_type: 'CLEARED',
        event_date: '2026-09-20',
        amount: 2500,
        currency: 'ZAR',
        payer_reference: 'Client proof only'
      }
    }
  });

  const match = await new PaymentResolver({
    lookupService: lookupFixture()
  }).resolve(envelope);

  assert.equal(match.status, 'UNRESOLVED');
  assert.match(match.reason, /CLEARED requires/);
});

test('cleared record requires provider transaction id and approved authority', async () => {
  const envelope = paymentEvent({
    payload: {
      payment: {
        observation_type: 'CLEARED',
        event_date: '2026-09-20',
        amount: 2500,
        currency: 'ZAR',
        payer_reference: 'FNB credit',
        provider_transaction_id: 'BANK-TXN-123',
        clearance_authority: 'BENEFICIARY_BANK'
      }
    }
  });

  const resolver = new PaymentResolver({ lookupService: lookupFixture() });
  const match = await resolver.resolve(envelope);
  assert.equal(match.status, 'MATCHED');

  const plan = planPaymentObservation(envelope, match, {
    now: () => new Date('2026-09-20T10:02:00Z')
  });

  assert.equal(plan.writes.length, 2);
  assert.equal(plan.writes[0].values.clearance_state, 'CLEARED');
  assert.equal(plan.writes[1].sheet, 'Payment_Allocations');
  assert.equal(plan.writes[1].values.allocation_state, 'CLEARED');
});

test('cleared planner refuses allocation without exact invoice', async () => {
  const envelope = paymentEvent({
    entity_hints: { control_id: 'PAY-1' },
    payload: {
      payment: {
        observation_type: 'CLEARED',
        event_date: '2026-09-20',
        amount: 2500,
        provider_transaction_id: 'BANK-TXN-123',
        clearance_authority: 'BENEFICIARY_BANK'
      }
    }
  });

  assert.throws(
    () => planPaymentObservation(envelope, {
      canonical_ids: { control_id: 'PAY-1' }
    }),
    /requires exact invoice_id/
  );
});

test('provider transaction collision with different amount is conflict', async () => {
  const lookup = lookupFixture();
  lookup.store = () => ({
    async findByKey() {
      return {
        object: {
          payment_event_id: 'PAYEVT-BANK-TXN-123',
          provider_transaction_id: 'BANK-TXN-123',
          amount: '1000'
        }
      };
    }
  });

  const envelope = paymentEvent({
    payload: {
      payment: {
        observation_type: 'CLEARED',
        event_date: '2026-09-20',
        amount: 2500,
        provider_transaction_id: 'BANK-TXN-123',
        clearance_authority: 'PAYMENT_GATEWAY'
      }
    }
  });

  const match = await new PaymentResolver({ lookupService: lookup }).resolve(envelope);
  assert.equal(match.status, 'CONFLICT');
  assert.match(match.reason, /different amount/);
});

test('P5 processor routes exact proof into a one-write proof-only plan', async () => {
  const envelope = paymentEvent();
  const resolver = new PaymentResolver({ lookupService: lookupFixture() });
  const processor = new EventProcessor({
    resolver: (env) => resolver.resolve(env),
    planner: (env, match) => planPaymentObservation(env, match)
  });

  const decision = await processor.decide(envelope);
  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.transaction_plan.writes.length, 1);
  assert.equal(
    decision.transaction_plan.writes[0].values.clearance_state,
    'PROOF_RECEIVED'
  );
});
