'use strict';

function isBroken(value) {
  return typeof value === 'string' && value.includes('#REF!');
}

function number(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return NaN;
  return Number(String(value).replace(/[^0-9.-]/g, ''));
}

function evaluateSupplierPriceLine(line = {}, {
  supplier = null,
  part = null,
  quote = null
} = {}) {
  const reasons = [];

  if (!line.source_line_id) reasons.push('MISSING_SOURCE_LINE_ID');
  if (!line.supplier_id || isBroken(line.supplier_id)) reasons.push('INVALID_SUPPLIER_ID');
  if (!line.supplier_quote_id || isBroken(line.supplier_quote_id)) reasons.push('INVALID_SUPPLIER_QUOTE_ID');
  if (!line.supplier_quote_number || isBroken(line.supplier_quote_number)) reasons.push('INVALID_SUPPLIER_QUOTE_NUMBER');
  if (!line.source_date || isBroken(line.source_date)) reasons.push('MISSING_SOURCE_DATE');
  if (!line.evidence_link || isBroken(line.evidence_link)) reasons.push('MISSING_EVIDENCE_LINK');

  if (String(line.supplier_approval_state || '').toUpperCase() !== 'APPROVED') {
    reasons.push('SUPPLIER_NOT_APPROVED');
  }

  if (!line.canonical_part_id || isBroken(line.canonical_part_id)) {
    reasons.push('CANONICAL_PART_UNRESOLVED');
  }

  if (!supplier || String(supplier.supplier_id || '') !== String(line.supplier_id || '')) {
    reasons.push('SUPPLIER_ID_NOT_VERIFIED');
  }

  if (!part || String(part.part_id || '') !== String(line.canonical_part_id || '')) {
    reasons.push('CANONICAL_PART_NOT_VERIFIED');
  }

  if (!quote || String(quote.supplier_quote_id || '') !== String(line.supplier_quote_id || '')) {
    reasons.push('SUPPLIER_QUOTE_NOT_VERIFIED');
  }

  if (
    quote &&
    line.supplier_quote_number &&
    String(quote.supplier_quote_number || '') !== String(line.supplier_quote_number)
  ) {
    reasons.push('QUOTE_NUMBER_CONFLICT');
  }

  const effectivePrice = number(
    line.effective_unit_price_ex_vat !== '' &&
    line.effective_unit_price_ex_vat !== undefined
      ? line.effective_unit_price_ex_vat
      : line.unit_price_ex_vat
  );
  if (!Number.isFinite(effectivePrice) || effectivePrice < 0) {
    reasons.push('INVALID_EFFECTIVE_UNIT_PRICE_EX_VAT');
  }

  const quantity = number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    reasons.push('INVALID_QUANTITY');
  }

  const vat = number(line.vat_rate);
  if (!Number.isFinite(vat) || vat < 0 || vat > 1) {
    reasons.push('INVALID_VAT_RATE');
  }

  const unit = line.resolved_unit || line.source_unit || '';
  if (!unit || unit === 'NOT_STATED' || isBroken(unit)) {
    reasons.push('UNIT_BASIS_UNRESOLVED');
  }

  if (isBroken(line.processing_status)) reasons.push('BROKEN_PROCESSING_STATUS');
  if (isBroken(line.match_status)) reasons.push('BROKEN_MATCH_STATUS');
  if (isBroken(line.promotion_gate)) reasons.push('BROKEN_PROMOTION_GATE');

  return {
    source_line_id: line.source_line_id || '',
    status: reasons.length ? 'REVIEW_REQUIRED' : 'ELIGIBLE',
    reasons,
    verified: {
      supplier_id: supplier?.supplier_id || '',
      part_id: part?.part_id || '',
      supplier_quote_id: quote?.supplier_quote_id || '',
      supplier_quote_number: quote?.supplier_quote_number || ''
    },
    price_basis: Number.isFinite(effectivePrice) ? {
      unit_price_ex_vat: effectivePrice,
      quantity,
      vat_rate: vat,
      unit
    } : null
  };
}

module.exports = {
  evaluateSupplierPriceLine,
  isBroken,
  number
};
