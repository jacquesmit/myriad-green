'use strict';
const { assessSupplierProcurement } = require('./supplier-procurement-readiness');

/**
 * Read-only, canonical Supplier Master + Supplier_Quotes release assessment.
 * Caller inputs may identify records, but cannot assert approval or quote identity.
 * Authorization/review flags are still explicit prerequisites; this never writes a PO.
 */
async function assessLiveSupplierProcurement({
  lookupService, supplierId, supplierQuoteId,
  quoteReviewed = false, procurementAuthorized = false
} = {}) {
  if (!lookupService || typeof lookupService.findEntityByCanonicalId !== 'function' ||
      typeof lookupService.store !== 'function') {
    throw new Error('AUTHORITATIVE_LOOKUP_REQUIRED');
  }
  if (!supplierId || !supplierQuoteId) {
    return assessSupplierProcurement({
      supplier: {supplier_id: supplierId || ''},
      quote: {supplier_quote_id: supplierQuoteId || ''},
      quoteReviewed: false, procurementAuthorized: false
    });
  }
  const supplier = await lookupService.findEntityByCanonicalId('Supplier', supplierId);
  const found = await lookupService.store('supplier').findByKey(
    'Supplier_Quotes', 'supplier_quote_id', supplierQuoteId
  );
  const quote = found?.object || null;
  // Never let a missing authoritative record inherit a caller-supplied ID.
  const result = assessSupplierProcurement({
    supplier, quote, quoteReviewed, procurementAuthorized
  });
  return {
    ...result,
    source_of_truth: 'Supplier Master / Suppliers + Supplier_Quotes',
    authoritative_lookup: true,
    verified_supplier_id: supplier?.supplier_id || '',
    verified_supplier_quote_id: quote?.supplier_quote_id || ''
  };
}
module.exports = { assessLiveSupplierProcurement };
