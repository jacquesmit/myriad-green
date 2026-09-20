'use strict';

const ALLOWED_CLEARANCE_AUTHORITIES = new Set([
  'BENEFICIARY_BANK',
  'PAYMENT_GATEWAY',
  'AUTHORISED_BANK_REVIEWER'
]);

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return NaN;
  return Number(String(value).replace(/[^0-9.-]/g, ''));
}

class PaymentResolver {
  constructor({ lookupService } = {}) {
    if (!lookupService) throw new Error('lookupService is required');
    this.lookup = lookupService;
  }

  async resolve(envelope) {
    const payment = envelope?.payload?.payment || {};
    const observation = String(payment.observation_type || '').toUpperCase();

    if (!['PROOF_RECEIVED', 'CLEARED'].includes(observation)) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'NONE',
        reason: 'payment.observation_type must be PROOF_RECEIVED or CLEARED',
        candidates: []
      };
    }

    const amount = toNumber(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'NONE',
        reason: 'Payment amount must be a positive number.',
        candidates: []
      };
    }

    if (!payment.event_date) {
      return {
        status: 'UNRESOLVED',
        confidence: 0,
        basis: 'NONE',
        reason: 'Payment event date is required.',
        candidates: []
      };
    }

    if (observation === 'CLEARED') {
      const authority = String(payment.clearance_authority || '').toUpperCase();
      if (!ALLOWED_CLEARANCE_AUTHORITIES.has(authority)) {
        return {
          status: 'UNRESOLVED',
          confidence: 0,
          basis: 'NONE',
          reason:
            'CLEARED requires beneficiary-bank, gateway, or authorised bank-review authority.',
          candidates: []
        };
      }
      if (!payment.provider_transaction_id) {
        return {
          status: 'UNRESOLVED',
          confidence: 0,
          basis: 'NONE',
          reason:
            'Automatic CLEARED creation requires an exposed provider/bank transaction ID.',
          candidates: []
        };
      }
    }

    const hints = envelope.entity_hints || {};
    const invoiceId = hints.invoice_id || payment.invoice_id || '';
    const controlId = hints.control_id || payment.control_id || '';
    const depositId = hints.deposit_id || payment.deposit_id || '';

    if (!invoiceId && !controlId) {
      return {
        status: 'UNRESOLVED',
        confidence: 0,
        basis: 'NONE',
        reason:
          'Exact invoice_id or Payment Control ID is required before a payment observation can auto-write.',
        candidates: []
      };
    }

    const result = {
      status: 'MATCHED',
      confidence: 1,
      basis: 'EXACT_ID',
      entity: {
        type: 'Payment event',
        id: null
      },
      canonical_ids: {},
      payment_context: {
        observation_type: observation,
        amount,
        currency: payment.currency || 'ZAR'
      },
      candidates: []
    };

    let invoice = null;
    let control = null;
    let deposit = null;

    if (invoiceId) {
      invoice = await this.lookup.findEntityByCanonicalId('Invoice', invoiceId);
      if (!invoice) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'invoice_id=' + invoiceId + ' did not resolve.',
          candidates: []
        };
      }
      result.canonical_ids.invoice_id = invoiceId;
      if (invoice.crm_id) result.canonical_ids.crm_id = invoice.crm_id;
      if (invoice.opportunity_id) result.canonical_ids.opportunity_id = invoice.opportunity_id;
      if (invoice.job_id) result.canonical_ids.job_id = invoice.job_id;
    }

    if (controlId) {
      control = await this.lookup.findEntityByCanonicalId('PaymentControl', controlId);
      if (!control) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'control_id=' + controlId + ' did not resolve.',
          candidates: []
        };
      }
      result.canonical_ids.control_id = controlId;
      if (control.crm_id) result.canonical_ids.crm_id = control.crm_id;
      if (control['Opportunity ID']) {
        result.canonical_ids.opportunity_id = control['Opportunity ID'];
      }
      if (control.job_id) result.canonical_ids.job_id = control.job_id;
      if (control.invoice_id && !result.canonical_ids.invoice_id) {
        result.canonical_ids.invoice_id = control.invoice_id;
      }
    }

    if (depositId) {
      deposit = await this.lookup.findEntityByCanonicalId('Deposit', depositId);
      if (!deposit) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'deposit_id=' + depositId + ' did not resolve.',
          candidates: []
        };
      }
      result.canonical_ids.deposit_id = depositId;
    }

    if (invoice && control) {
      const controlInvoice = control.invoice_id || '';
      if (controlInvoice && controlInvoice !== invoiceId) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason:
            'Payment Control invoice_id conflicts with the supplied invoice_id.',
          candidates: []
        };
      }

      const controlOpp = control['Opportunity ID'] || '';
      if (
        controlOpp &&
        invoice.opportunity_id &&
        controlOpp !== invoice.opportunity_id
      ) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason:
            'Payment Control opportunity conflicts with Invoice opportunity.',
          candidates: []
        };
      }
    }

    if (payment.provider_transaction_id) {
      const existing = await this.lookup.store('commercial').findByKey(
        'Payment_Events',
        'provider_transaction_id',
        payment.provider_transaction_id
      );

      if (existing) {
        const existingAmount = toNumber(existing.object.amount);
        if (existingAmount !== amount) {
          return {
            status: 'CONFLICT',
            confidence: 0,
            basis: 'EXACT_REFERENCE',
            reason:
              'Provider transaction ID already exists with a different amount.',
            candidates: [{ payment_event_id: existing.object.payment_event_id }]
          };
        }
        result.existing_payment_event = existing.object;
      }
    }

    result.invoice = invoice;
    result.control = control;
    result.deposit = deposit;
    return result;
  }
}

module.exports = {
  PaymentResolver,
  ALLOWED_CLEARANCE_AUTHORITIES,
  toNumber
};
