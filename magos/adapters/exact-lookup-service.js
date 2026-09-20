'use strict';

const { AuditLedger } = require('./audit-ledger');

const DEFAULT_IDS = {
  crm: process.env.MAGOS_CRM_SPREADSHEET_ID || '1kV3qTzzXxzRPzLj1rgBDS-B0KgKU_FCw8HQwFVxlOno',
  commercial: process.env.MAGOS_COMMERCIAL_SPREADSHEET_ID || '1NJxYXRMS_6HU53wWqgSJh9jhf2jlLRa-Avi0ZfMLoNc',
  supplier: process.env.MAGOS_SUPPLIER_SPREADSHEET_ID || '11MpTf4A9S2NeCH8uQMGmDVW0Rwgit2Ze--7jLYu0Ztk'
};

const ENTITY_LOCATORS = {
  CRM: { store: 'crm', sheet: 'CRM_Master', key: 'crm_id' },
  Opportunity: { store: 'crm', sheet: 'Jobs_Opportunities', key: 'opportunity_id' },
  Job: { store: 'crm', sheet: 'Jobs_Opportunities', key: 'job_id' },
  Quote: { store: 'commercial', sheet: 'Quotes', key: 'quote_id' },
  Invoice: { store: 'commercial', sheet: 'Invoices', key: 'invoice_id' },
  Payment: { store: 'commercial', sheet: 'Payment_Events', key: 'payment_event_id' },
  PaymentControl: { store: 'commercial', sheet: 'Payment Control', key: 'Control ID' },
  Deposit: { store: 'commercial', sheet: 'Payment Control', key: 'deposit_id' },
  Supplier: { store: 'supplier', sheet: 'Suppliers', key: 'supplier_id' },
  Evidence: { store: 'crm', sheet: 'Evidence_Index', key: 'drive_file_id' }
};

const DOCUMENT_REFERENCE_LOCATORS = {
  SUPPLIER_QUOTE: [
    { store: 'supplier', sheet: 'Supplier_Quotes', key: 'supplier_quote_number', map: supplierQuoteCandidate },
    { store: 'supplier', sheet: 'Import_Log', key: 'supplier_quote_number', map: importLogCandidate }
  ],
  SUPPLIER_INVOICE: [
    { store: 'supplier', sheet: 'Supplier_Source_Lines', key: 'supplier_quote_number', map: supplierSourceCandidate }
  ],
  PAYMENT_PROOF: [
    { store: 'commercial', sheet: 'Payment_Events', key: 'provider_transaction_id', map: paymentCandidate },
    { store: 'commercial', sheet: 'Invoices', key: 'Document No.', map: invoiceCandidate }
  ],
  BANK_STATEMENT: [
    { store: 'commercial', sheet: 'Payment_Events', key: 'provider_transaction_id', map: paymentCandidate }
  ],
  ORDER: [
    { store: 'supplier', sheet: 'Purchase_Orders', key: 'supplier_reference', map: genericCandidate }
  ],
  PURCHASE_ORDER: [
    { store: 'supplier', sheet: 'Purchase_Orders', key: 'supplier_reference', map: genericCandidate }
  ]
};

function genericCandidate(row) {
  return { canonical_ids: {}, record: row };
}

function supplierQuoteCandidate(row) {
  return {
    canonical_ids: {
      supplier_id: row.supplier_id || ''
    },
    supplier_quote_id: row.supplier_quote_id || '',
    record: row
  };
}

function importLogCandidate(row) {
  return {
    canonical_ids: {
      supplier_id: row.supplier_id || ''
    },
    record: row
  };
}

function supplierSourceCandidate(row) {
  return {
    canonical_ids: {
      supplier_id: row.supplier_id || ''
    },
    supplier_quote_id: row.supplier_quote_id || '',
    record: row
  };
}

function paymentCandidate(row) {
  return {
    canonical_ids: {
      crm_id: row.crm_id || '',
      opportunity_id: row.opportunity_id || '',
      job_id: row.job_id || '',
      invoice_id: row.invoice_id || '',
      payment_event_id: row.payment_event_id || ''
    },
    record: row
  };
}

function invoiceCandidate(row) {
  return {
    canonical_ids: {
      crm_id: row.crm_id || '',
      opportunity_id: row.opportunity_id || '',
      job_id: row.job_id || '',
      quote_id: row.quote_id || '',
      invoice_id: row.invoice_id || ''
    },
    record: row
  };
}

function buildStores(overrides = {}) {
  return {
    crm: overrides.crm || new AuditLedger({ spreadsheetId: DEFAULT_IDS.crm }),
    commercial: overrides.commercial || new AuditLedger({ spreadsheetId: DEFAULT_IDS.commercial }),
    supplier: overrides.supplier || new AuditLedger({ spreadsheetId: DEFAULT_IDS.supplier })
  };
}

async function safeExactFind(store, sheet, key, value) {
  try {
    return await store.findByKey(sheet, key, value);
  } catch (error) {
    if (/Duplicate key /.test(error.message || '')) {
      const wrapped = new Error(
        'AMBIGUOUS_EXACT_LOOKUP ' + sheet + ' ' + key + '=' + value
      );
      wrapped.code = 'AMBIGUOUS_EXACT_LOOKUP';
      wrapped.cause = error;
      throw wrapped;
    }
    throw error;
  }
}

class ExactLookupService {
  constructor({ stores } = {}) {
    this.stores = buildStores(stores);
  }

  store(name) {
    const store = this.stores[name];
    if (!store) throw new Error('Unknown lookup store ' + name);
    return store;
  }

  async findEvidenceByDriveFileId(driveFileId) {
    const found = await safeExactFind(
      this.store('crm'),
      'Evidence_Index',
      'drive_file_id',
      driveFileId
    );
    return found?.object || null;
  }

  async findEntityByCanonicalId(entityType, canonicalId) {
    const locator = ENTITY_LOCATORS[entityType];
    if (!locator) throw new Error('Unsupported canonical entity type ' + entityType);
    const found = await safeExactFind(
      this.store(locator.store),
      locator.sheet,
      locator.key,
      canonicalId
    );
    return found?.object || null;
  }

  async findByDocumentNumber(documentType, documentNumber) {
    const locators = DOCUMENT_REFERENCE_LOCATORS[documentType] || [];
    const candidates = [];

    for (const locator of locators) {
      const found = await safeExactFind(
        this.store(locator.store),
        locator.sheet,
        locator.key,
        documentNumber
      );
      if (!found) continue;
      candidates.push((locator.map || genericCandidate)(found.object));
    }

    return candidates;
  }

  zeroAResolverDependencies() {
    return {
      findEvidenceByDriveFileId: (id) => this.findEvidenceByDriveFileId(id),
      findEntityByCanonicalId: (type, id) => this.findEntityByCanonicalId(type, id),
      findByDocumentNumber: (type, number) => this.findByDocumentNumber(type, number)
    };
  }
}

module.exports = {
  ExactLookupService,
  ENTITY_LOCATORS,
  DOCUMENT_REFERENCE_LOCATORS,
  DEFAULT_IDS
};
