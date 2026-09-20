'use strict';

const { AuditLedger } = require('./audit-ledger');

const DEFAULT_IDS = {
  crm: process.env.MAGOS_CRM_SPREADSHEET_ID || '1kV3qTzzXxzRPzLj1rgBDS-B0KgKU_FCw8HQwFVxlOno',
  commercial: process.env.MAGOS_COMMERCIAL_SPREADSHEET_ID || '1NJxYXRMS_6HU53wWqgSJh9jhf2jlLRa-Avi0ZfMLoNc',
  supplier: process.env.MAGOS_SUPPLIER_SPREADSHEET_ID || '11MpTf4A9S2NeCH8uQMGmDVW0Rwgit2Ze--7jLYu0Ztk'
};

const ENTITY_LOCATORS = {
  CRM: { store: 'crm', sheet: 'CRM_Master', key: 'crm_id' },
  Client: { store: 'crm', sheet: 'CRM_Master', key: 'crm_id' },
  Contact: { store: 'crm', sheet: 'CRM_Master', key: 'contact_id' },
  Opportunity: { store: 'crm', sheet: 'Jobs_Opportunities', key: 'opportunity_id' },
  Job: { store: 'crm', sheet: 'Jobs_Opportunities', key: 'job_id' },
  Quote: { store: 'commercial', sheet: 'Quotes', key: 'quote_id' },
  Invoice: { store: 'commercial', sheet: 'Invoices', key: 'invoice_id' },
  Payment: { store: 'commercial', sheet: 'Payment_Events', key: 'payment_event_id' },
  PaymentControl: { store: 'commercial', sheet: 'Payment Control', key: 'Control ID' },
  Deposit: { store: 'commercial', sheet: 'Payment Control', key: 'deposit_id' },
  Supplier: { store: 'supplier', sheet: 'Suppliers', key: 'supplier_id' },
  Product: { store: 'supplier', sheet: 'Master_Parts', key: 'part_id' },
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


function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}


function emailTokens(value) {
  return String(value || '')
    .split(/[;,\n]+/)
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

function phoneVariants(value) {
  const original = String(value || '').trim();
  if (!original) return [];

  let digits = original.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  let e164 = digits;
  if (/^0\d{9}$/.test(digits)) {
    e164 = '27' + digits.slice(1);
  }

  const variants = new Set([original, digits, e164]);
  if (/^27\d{9}$/.test(e164)) {
    const local = '0' + e164.slice(2);
    variants.add(local);
    variants.add(
      '+27 ' +
      e164.slice(2, 4) + ' ' +
      e164.slice(4, 7) + ' ' +
      e164.slice(7)
    );
    variants.add(
      local.slice(0, 3) + ' ' +
      local.slice(3, 6) + ' ' +
      local.slice(6)
    );
  }
  return [...variants].filter(Boolean);
}

function candidateIdentity(row, matchedBy) {
  return {
    crm_id: row.crm_id || '',
    contact_id: row.contact_id || '',
    opportunity_id: row.opportunity_id || '',
    property_id: row.property_id || '',
    matched_by: matchedBy,
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


  async findIntakeBySourceEvent(sourceSystem, sourceEventId) {
    if (!sourceSystem || !sourceEventId) return null;
    const found = await safeExactFind(
      this.store('crm'),
      'Intake_Queue',
      'source_event_id',
      sourceEventId
    );
    if (!found) return null;
    const row = found.object || {};
    if (String(row.source_system || '') !== String(sourceSystem)) {
      return {
        ...row,
        __source_system_mismatch: true
      };
    }
    return row;
  }

  async findCrmCandidatesByIdentity({ phone = '', email = '' } = {}) {
    const store = this.store('crm');
    const candidates = new Map();

    const add = (found, basis) => {
      if (!found) return;
      const row = found.object || {};
      const key = row.crm_id || ('ROW:' + found.rowNumber);
      const existing = candidates.get(key);
      const matchedBy = new Set(existing?.matched_by || []);
      matchedBy.add(basis);
      candidates.set(key, candidateIdentity(row, [...matchedBy]));
    };

    for (const value of phoneVariants(phone)) {
      for (const header of [
        'phone',
        'preferred_call_number',
        'whatsapp_number',
        'preferred_whatsapp_number'
      ]) {
        const found = await safeExactFind(
          store,
          'CRM_Master',
          header,
          value
        );
        add(found, 'PHONE:' + header);
      }
    }

    const emailVariants = new Set([
      String(email || '').trim(),
      normalizeEmail(email)
    ]);
    emailVariants.delete('');
    for (const value of emailVariants) {
      for (const header of ['email', 'preferred_email']) {
        const found = await safeExactFind(
          store,
          'CRM_Master',
          header,
          value
        );
        add(found, 'EMAIL:' + header);
      }
    }

    return [...candidates.values()];
  }

  leadResolverDependencies() {
    return {
      findIntakeBySourceEvent: (source, id) =>
        this.findIntakeBySourceEvent(source, id),
      findCrmCandidatesByIdentity: (identity) =>
        this.findCrmCandidatesByIdentity(identity),
      findEntityByCanonicalId: (type, id) =>
        this.findEntityByCanonicalId(type, id)
    };
  }

  async findPaymentEventByProviderTransactionId(providerTransactionId) {
    if (!providerTransactionId) return null;
    const found = await safeExactFind(
      this.store('commercial'),
      'Payment_Events',
      'provider_transaction_id',
      providerTransactionId
    );
    return found?.object || null;
  }

  async findPaymentEventByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;
    const found = await safeExactFind(
      this.store('commercial'),
      'Payment_Events',
      'idempotency_key',
      idempotencyKey
    );
    return found?.object || null;
  }

  async findInvoiceByDocumentNo(documentNo) {
    if (!documentNo) return null;
    const found = await safeExactFind(
      this.store('commercial'),
      'Invoices',
      'Document No.',
      documentNo
    );
    return found?.object || null;
  }

  async findQuoteByNumber(quoteNo) {
    if (!quoteNo) return null;
    const found = await safeExactFind(
      this.store('commercial'),
      'Quotes',
      'Quote No.',
      quoteNo
    );
    return found?.object || null;
  }

  async findPaymentControlByQuoteNo(quoteNo) {
    if (!quoteNo) return null;
    const found = await safeExactFind(
      this.store('commercial'),
      'Payment Control',
      'Quote No.',
      quoteNo
    );
    return found?.object || null;
  }

  async findPaymentAllocationByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;
    const found = await safeExactFind(
      this.store('commercial'),
      'Payment_Allocations',
      'idempotency_key',
      idempotencyKey
    );
    return found?.object || null;
  }


  async findSupplierCandidatesByEmail(email) {
    const target = normalizeEmail(email);
    if (!target) return [];

    const rows = await this.store('supplier').readObjects('Suppliers');
    return rows
      .filter((row) => emailTokens(row.email).includes(target))
      .map((row) => ({
        supplier_id: row.supplier_id || '',
        supplier_name: row.supplier_name || '',
        supplier_approval_state: row.supplier_approval_state || '',
        active_status: row.active_status || '',
        record: row
      }));
  }

  supplierEmailResolverDependencies() {
    return {
      findIntakeBySourceEvent: (source, id) =>
        this.findIntakeBySourceEvent(source, id),
      findEntityByCanonicalId: (type, id) =>
        this.findEntityByCanonicalId(type, id),
      findSupplierCandidatesByEmail: (email) =>
        this.findSupplierCandidatesByEmail(email)
    };
  }

  async findSupplierQuoteByNumber(supplierQuoteNumber) {
    if (!supplierQuoteNumber) return null;
    const found = await safeExactFind(
      this.store('supplier'),
      'Supplier_Quotes',
      'supplier_quote_number',
      supplierQuoteNumber
    );
    return found?.object || null;
  }

  async findSupplierSourceLineById(sourceLineId) {
    if (!sourceLineId) return null;
    const found = await safeExactFind(
      this.store('supplier'),
      'Supplier_Source_Lines',
      'source_line_id',
      sourceLineId
    );
    return found?.object || null;
  }

  async findSupplierPriceBySourceLineId(sourceLineId) {
    if (!sourceLineId) return null;
    const found = await safeExactFind(
      this.store('supplier'),
      'Supplier_Prices',
      'source_line_id',
      sourceLineId
    );
    return found?.object || null;
  }

  async findProductBySupplierCode(supplierId, supplierCode) {
    if (!supplierId || !supplierCode) return null;
    const found = await safeExactFind(
      this.store('supplier'),
      'Master_Parts',
      'supplier_code_primary',
      supplierCode
    );
    if (!found) return null;
    const row = found.object || {};
    if (String(row.preferred_supplier_id || '') !== String(supplierId)) {
      return {
        ...row,
        __supplier_code_owner_mismatch: true
      };
    }
    return row;
  }

  supplierPriceResolverDependencies() {
    return {
      findEntityByCanonicalId: (type, id) => this.findEntityByCanonicalId(type, id),
      findSupplierQuoteByNumber: (number) =>
        this.findSupplierQuoteByNumber(number),
      findSupplierSourceLineById: (id) =>
        this.findSupplierSourceLineById(id),
      findSupplierPriceBySourceLineId: (id) =>
        this.findSupplierPriceBySourceLineId(id),
      findProductBySupplierCode: (supplierId, code) =>
        this.findProductBySupplierCode(supplierId, code)
    };
  }

  paymentResolverDependencies() {
    return {
      findEntityByCanonicalId: (type, id) => this.findEntityByCanonicalId(type, id),
      findPaymentEventByProviderTransactionId: (id) =>
        this.findPaymentEventByProviderTransactionId(id),
      findPaymentEventByIdempotencyKey: (key) =>
        this.findPaymentEventByIdempotencyKey(key),
      findInvoiceByDocumentNo: (number) => this.findInvoiceByDocumentNo(number),
      findQuoteByNumber: (number) => this.findQuoteByNumber(number),
      findPaymentControlByQuoteNo: (number) =>
        this.findPaymentControlByQuoteNo(number),
      findPaymentAllocationByIdempotencyKey: (key) =>
        this.findPaymentAllocationByIdempotencyKey(key)
    };
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
  DEFAULT_IDS,
  normalizeEmail,
  emailTokens,
  phoneVariants
};
