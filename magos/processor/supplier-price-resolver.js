'use strict';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function sameNumber(left, right) {
  const a = numberValue(left);
  const b = numberValue(right);
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.000001;
}

function sourceLineConflict(existing, obs) {
  const line = obs.line;
  const quote = obs.quote;
  const exactFields = [
    ['supplier_id', quote.supplier_id],
    ['supplier_quote_number', quote.supplier_quote_number],
    ['source_line_no', line.source_line_no],
    ['supplier_sku', line.supplier_sku],
    ['source_description', line.source_description],
    ['source_unit', line.source_unit],
    ['currency', quote.currency]
  ];
  for (const [field, expected] of exactFields) {
    if (text(existing[field]) !== text(expected)) {
      return field;
    }
  }

  const numericFields = [
    ['quantity', line.quantity],
    ['unit_price_ex_vat', line.unit_price_ex_vat],
    ['vat_rate', line.vat_rate],
    ['line_total_ex_vat', line.line_total_ex_vat]
  ];
  for (const [field, expected] of numericFields) {
    if (!sameNumber(existing[field], expected)) {
      return field;
    }
  }
  return null;
}

function priceFieldsComplete(line) {
  const quantity = numberValue(line.quantity);
  const unitPrice = numberValue(line.unit_price_ex_vat);
  return Boolean(
    quantity !== null && quantity > 0 &&
    unitPrice !== null && unitPrice >= 0
  );
}

class SupplierPriceResolver {
  constructor({ lookupService } = {}) {
    if (!lookupService) throw new Error('lookupService is required');
    this.lookup = lookupService;
  }

  async resolve(envelope) {
    const obs = envelope?.payload?.supplier_price_observation || {};
    const quote = obs.quote || {};
    const line = obs.line || {};

    if (!quote.supplier_id || !quote.supplier_quote_number || !line.source_line_id) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'NONE',
        reason: 'Exact supplier, supplier quote number, and source-line identity are required.',
        candidates: []
      };
    }

    const supplier = await this.lookup.findEntityByCanonicalId(
      'Supplier',
      quote.supplier_id
    );
    if (!supplier) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'EXACT_ID',
        reason: 'supplier_id did not resolve.',
        candidates: []
      };
    }

    if (
      text(supplier.supplier_approval_state).toUpperCase() !== 'APPROVED' ||
      text(supplier.active_status).toUpperCase() !== 'ACTIVE'
    ) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'EXACT_ID',
        reason:
          'Supplier is not both APPROVED and ACTIVE; automated price intake is blocked.',
        candidates: [{
          supplier_id: quote.supplier_id,
          supplier_approval_state: supplier.supplier_approval_state || '',
          active_status: supplier.active_status || ''
        }]
      };
    }

    const existingQuote = await this.lookup.findSupplierQuoteByNumber(
      quote.supplier_quote_number
    );
    if (
      existingQuote &&
      text(existingQuote.supplier_id) !== text(quote.supplier_id)
    ) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'EXACT_REFERENCE',
        reason: 'Supplier quote number already belongs to a different supplier.',
        candidates: [{
          supplier_quote_id: existingQuote.supplier_quote_id,
          supplier_id: existingQuote.supplier_id
        }]
      };
    }

    const existingSourceLine = await this.lookup.findSupplierSourceLineById(
      line.source_line_id
    );
    if (existingSourceLine) {
      const conflictField = sourceLineConflict(existingSourceLine, obs);
      if (conflictField) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_REFERENCE',
          reason:
            'Immutable supplier source line conflicts on ' + conflictField + '.',
          candidates: [{
            source_line_id: line.source_line_id,
            conflicting_field: conflictField
          }]
        };
      }
    }

    let part = null;
    let partBasis = 'NONE';
    let partReason = '';

    const explicitPartId =
      line.canonical_part_id ||
      envelope?.entity_hints?.part_id ||
      existingSourceLine?.canonical_part_id ||
      '';

    if (explicitPartId) {
      part = await this.lookup.findEntityByCanonicalId('Product', explicitPartId);
      if (!part) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Explicit canonical_part_id did not resolve.',
          candidates: [{ part_id: explicitPartId }]
        };
      }
      if (
        existingSourceLine?.canonical_part_id &&
        text(existingSourceLine.canonical_part_id) !== text(explicitPartId)
      ) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Existing source-line canonical part conflicts with supplied part.',
          candidates: [{
            existing_part_id: existingSourceLine.canonical_part_id,
            supplied_part_id: explicitPartId
          }]
        };
      }
      partBasis = 'EXACT_ID';
    } else if (line.supplier_sku) {
      const skuPart = await this.lookup.findProductBySupplierCode(
        quote.supplier_id,
        line.supplier_sku
      );
      if (skuPart?.__supplier_code_owner_mismatch) {
        partReason =
          'Exact supplier SKU exists but belongs to another preferred supplier; review required.';
      } else if (skuPart) {
        part = skuPart;
        partBasis = 'EXACT_REFERENCE';
      } else {
        partReason = 'No exact canonical part resolved from supplier SKU.';
      }
    } else {
      partReason =
        'No canonical_part_id or exact supplier SKU is available. Description-only matching is prohibited.';
    }

    if (part && text(part.active_status).toUpperCase() !== 'ACTIVE') {
      partReason = 'Canonical part is not ACTIVE.';
      part = null;
      partBasis = 'NONE';
    }

    const existingPrice = await this.lookup.findSupplierPriceBySourceLineId(
      line.source_line_id
    );
    if (
      existingPrice &&
      part &&
      text(existingPrice.part_id) !== text(part.part_id)
    ) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'EXACT_REFERENCE',
        reason: 'Existing supplier price for source line points to a different part.',
        candidates: [{
          price_record_id: existingPrice.price_record_id,
          existing_part_id: existingPrice.part_id,
          resolved_part_id: part.part_id
        }]
      };
    }

    const promotable =
      Boolean(part) &&
      priceFieldsComplete(line);

    if (part && !promotable) {
      partReason =
        'Canonical part is exact, but quantity/unit price evidence is incomplete; price promotion requires review.';
    }

    return {
      status: 'MATCHED',
      confidence: 1,
      basis: 'EXACT_ID',
      entity: {
        type: 'Supplier',
        id: quote.supplier_id
      },
      canonical_ids: {
        supplier_id: quote.supplier_id,
        ...(part ? { part_id: part.part_id } : {})
      },
      supplier,
      existing_quote: existingQuote || null,
      existing_source_line: existingSourceLine || null,
      existing_price: existingPrice || null,
      part: part || null,
      part_basis: partBasis,
      price_promotion_allowed: promotable,
      review_required_after_capture: !promotable,
      review_reason:
        promotable ? '' : (partReason || 'Supplier price promotion requires review.'),
      candidates: []
    };
  }
}

module.exports = {
  SupplierPriceResolver,
  sourceLineConflict,
  priceFieldsComplete,
  numberValue,
  sameNumber
};
