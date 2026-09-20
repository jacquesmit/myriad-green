'use strict';

function parseMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function canonicalFromInvoice(row) {
  if (!row) return {};
  return {
    crm_id: row.crm_id || '',
    opportunity_id: row.opportunity_id || '',
    job_id: row.job_id || '',
    quote_id: row.quote_id || '',
    invoice_id: row.invoice_id || ''
  };
}

function canonicalFromControl(row) {
  if (!row) return {};
  return {
    crm_id: row.crm_id || '',
    opportunity_id: row['Opportunity ID'] || row.opportunity_id || '',
    job_id: row.job_id || '',
    invoice_id: row.invoice_id || '',
    control_id: row['Control ID'] || row.control_id || '',
    deposit_id: row.deposit_id || ''
  };
}

function sameOpportunity(invoice, control) {
  const invoiceOpportunity = invoice?.opportunity_id || '';
  const controlOpportunity =
    control?.['Opportunity ID'] || control?.opportunity_id || '';
  if (!invoiceOpportunity || !controlOpportunity) return true;
  return invoiceOpportunity === controlOpportunity;
}

class PaymentResolver {
  constructor({ lookupService } = {}) {
    if (!lookupService) throw new Error('lookupService is required');
    this.lookup = lookupService;
  }

  async resolve(envelope) {
    const p = envelope?.payload?.payment || {};
    const amount = Number(p.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'NONE',
        reason: 'Payment amount is invalid.',
        candidates: []
      };
    }

    if (p.provider_transaction_id) {
      const existing =
        await this.lookup.findPaymentEventByProviderTransactionId(
          p.provider_transaction_id
        );
      if (existing) {
        return {
          status: 'DUPLICATE_PAYMENT',
          confidence: 1,
          basis: 'EXACT_REFERENCE',
          entity: {
            type: 'Payment event',
            id: existing.payment_event_id
          },
          existing_payment_event: existing,
          candidates: []
        };
      }
    }

    const suppliedInvoiceId =
      p.invoice_id || envelope?.entity_hints?.invoice_id || '';
    const suppliedControlId =
      p.control_id || envelope?.entity_hints?.control_id || '';
    const suppliedDepositId =
      p.deposit_id || envelope?.entity_hints?.deposit_id || '';

    if (suppliedInvoiceId) {
      const invoice = await this.lookup.findEntityByCanonicalId(
        'Invoice',
        suppliedInvoiceId
      );
      if (!invoice) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Supplied invoice_id did not resolve.',
          candidates: []
        };
      }

      if (suppliedControlId) {
        const control = await this.lookup.findEntityByCanonicalId(
          'PaymentControl',
          suppliedControlId
        );
        if (!control) {
          return {
            status: 'CONFLICT',
            confidence: 0,
            basis: 'EXACT_ID',
            reason: 'Supplied payment control ID did not resolve.',
            candidates: []
          };
        }
        if (!sameOpportunity(invoice, control)) {
          return {
            status: 'CONFLICT',
            confidence: 0,
            basis: 'EXACT_ID',
            reason: 'Invoice and Payment Control belong to different opportunities.',
            candidates: [{
              invoice_id: invoice.invoice_id,
              invoice_opportunity_id: invoice.opportunity_id || '',
              control_id: suppliedControlId,
              control_opportunity_id:
                control['Opportunity ID'] || control.opportunity_id || ''
            }]
          };
        }

        const matched = this.invoiceMatch(invoice, amount, 'EXACT_ID');
        if (matched.status === 'MATCHED') {
          matched.payment_control = control;
          matched.canonical_ids = {
            ...canonicalFromControl(control),
            ...matched.canonical_ids,
            control_id: suppliedControlId
          };
        }
        return matched;
      }

      return this.invoiceMatch(invoice, amount, 'EXACT_ID');
    }

    if (p.invoice_document_no) {
      const invoice = await this.lookup.findInvoiceByDocumentNo(
        p.invoice_document_no
      );
      if (!invoice) {
        return {
          status: 'UNRESOLVED',
          confidence: 0,
          basis: 'NONE',
          reason: 'Invoice document number did not resolve.',
          candidates: []
        };
      }
      return this.invoiceMatch(invoice, amount, 'EXACT_REFERENCE');
    }

    if (suppliedDepositId) {
      const control = await this.lookup.findEntityByCanonicalId(
        'Deposit',
        suppliedDepositId
      );
      if (!control) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Supplied deposit_id did not resolve.',
          candidates: []
        };
      }
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_ID',
        entity: {
          type: 'Deposit',
          id: suppliedDepositId
        },
        canonical_ids: canonicalFromControl(control),
        payment_control: control,
        allocation_target: {
          type: 'DEPOSIT',
          id: suppliedDepositId
        },
        candidates: []
      };
    }

    if (suppliedControlId) {
      const control = await this.lookup.findEntityByCanonicalId(
        'PaymentControl',
        suppliedControlId
      );
      if (!control) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Supplied payment control ID did not resolve.',
          candidates: []
        };
      }
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_ID',
        entity: {
          type: 'Payment control',
          id: suppliedControlId
        },
        canonical_ids: canonicalFromControl(control),
        payment_control: control,
        candidates: []
      };
    }

    if (p.quote_no) {
      const control = await this.lookup.findPaymentControlByQuoteNo(p.quote_no);
      if (!control) {
        return {
          status: 'UNRESOLVED',
          confidence: 0,
          basis: 'NONE',
          reason: 'Quote number did not resolve to one exact Payment Control row.',
          candidates: []
        };
      }
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_REFERENCE',
        entity: {
          type: 'Payment control',
          id: control['Control ID'] || control.control_id
        },
        canonical_ids: canonicalFromControl(control),
        payment_control: control,
        candidates: []
      };
    }

    return {
      status: 'UNRESOLVED',
      confidence: 0,
      basis: 'NONE',
      reason:
        'No exact invoice, deposit, or payment-control identity is available.',
      candidates: []
    };
  }

  invoiceMatch(invoice, amount, basis) {
    const balance = parseMoney(invoice['Balance (R)']);
    if (balance !== null && balance <= 0) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis,
        reason: 'Matched invoice has no outstanding balance.',
        candidates: [{ invoice_id: invoice.invoice_id, balance }]
      };
    }
    if (balance !== null && amount > balance + 0.005) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis,
        reason: 'Observed payment exceeds the exact invoice outstanding balance.',
        candidates: [{
          invoice_id: invoice.invoice_id,
          balance,
          observed_amount: amount
        }]
      };
    }

    return {
      status: 'MATCHED',
      confidence: 1,
      basis,
      entity: {
        type: 'Invoice',
        id: invoice.invoice_id
      },
      canonical_ids: canonicalFromInvoice(invoice),
      invoice,
      invoice_balance: balance,
      allocation_target: {
        type: 'INVOICE',
        id: invoice.invoice_id
      },
      candidates: []
    };
  }
}

module.exports = {
  PaymentResolver,
  parseMoney,
  canonicalFromInvoice,
  canonicalFromControl,
  sameOpportunity
};
