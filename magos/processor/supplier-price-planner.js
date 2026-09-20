'use strict';

const crypto = require('crypto');
const {
  createIfAbsent,
  patchIfMatch,
  recordSupplierPrice,
  composeTransactionPlan
} = require('../writer/operations');

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function dateToken(value) {
  const text = String(value || '').slice(0, 10).replace(/-/g, '');
  return /^\d{8}$/.test(text) ? text : 'UNDATED';
}

function supplierToken(supplierId) {
  return String(supplierId || 'SUP')
    .replace(/^SUP-/, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 12)
    .toUpperCase() || 'SUP';
}

function shortHash(value, length = 10) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
    .slice(0, length).toUpperCase();
}

function deterministicSupplierQuoteId(quote) {
  return 'SQT-P5J-' +
    shortHash(quote.supplier_id + '|' + quote.supplier_quote_number, 16);
}

function deterministicPriceRecordId(obs, partId) {
  return [
    'SPR',
    dateToken(obs.quote.quote_date || obs.line.source_date),
    supplierToken(obs.quote.supplier_id),
    shortHash(obs.line.source_line_id + '|' + partId, 10)
  ].join('-');
}

function parseVatRate(value) {
  if (value === undefined || value === null || value === '') return 0;
  const raw = String(value).trim();
  const n = Number(raw.replace('%', ''));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('vat_rate must be a non-negative number or percentage');
  }
  return raw.includes('%') || n > 1 ? n / 100 : n;
}

function rounded(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function quoteValues(obs, quoteId, now) {
  const q = obs.quote;
  return {
    supplier_quote_id: quoteId,
    supplier_id: q.supplier_id,
    supplier_quote_number: q.supplier_quote_number,
    project_reference: q.project_reference || '',
    quote_date: q.quote_date || '',
    valid_until: q.valid_until || '',
    currency: q.currency || 'ZAR',
    vat_basis: q.vat_basis || '',
    source_document: q.source_document || '',
    supplier_contact: q.supplier_contact || '',
    delivery_terms: q.delivery_terms || '',
    payment_terms: q.payment_terms || '',
    captured_by: 'MAGOS P5J',
    captured_date: now.toISOString(),
    notes: q.notes || ''
  };
}

function immutableSourceLineValues(obs, quoteId, supplierApprovalState) {
  const q = obs.quote;
  const l = obs.line;
  return {
    source_line_id: l.source_line_id,
    source_system: obs.source,
    source_event_id: obs.source_event_id,
    source_thread_id: obs.source_thread_id || '',
    supplier_id: q.supplier_id,
    supplier_approval_state: supplierApprovalState || '',
    supplier_quote_id: quoteId,
    supplier_quote_number: q.supplier_quote_number,
    source_date: q.quote_date || '',
    valid_until: q.valid_until || '',
    source_page: l.source_page || '',
    source_line_no: l.source_line_no,
    supplier_sku: l.supplier_sku || '',
    source_description: l.source_description || '',
    quantity: l.quantity === null ? '' : l.quantity,
    source_unit: l.source_unit || '',
    unit_price_ex_vat:
      l.unit_price_ex_vat === null ? '' : l.unit_price_ex_vat,
    vat_rate: l.vat_rate === null ? '' : l.vat_rate,
    line_total_ex_vat:
      l.line_total_ex_vat === null ? '' : l.line_total_ex_vat,
    currency: q.currency || 'ZAR',
    source_document: q.source_document || '',
    evidence_link: '',
    source_price_status: 'SOURCE_EVIDENCE',
    source_price_vat_basis: l.source_price_vat_basis || q.vat_basis || ''
  };
}

function priceValues(obs, match, quoteId) {
  const q = obs.quote;
  const l = obs.line;
  const partId = required(match.part?.part_id, 'exact canonical part_id');
  const quantity = Number(required(l.quantity, 'line.quantity'));
  const unitEx = Number(required(l.unit_price_ex_vat, 'line.unit_price_ex_vat'));
  const vatRate = parseVatRate(l.vat_rate);
  const lineEx = l.line_total_ex_vat === null
    ? rounded(quantity * unitEx)
    : Number(l.line_total_ex_vat);
  const unitInc = rounded(unitEx * (1 + vatRate));
  const lineInc = rounded(lineEx * (1 + vatRate));

  return {
    price_record_id: deterministicPriceRecordId(obs, partId),
    part_id: partId,
    supplier_id: q.supplier_id,
    supplier_quote_number: q.supplier_quote_number,
    project_reference: q.project_reference || '',
    quote_date: q.quote_date || '',
    valid_until: q.valid_until || '',
    quantity,
    unit: l.source_unit || '',
    unit_price_ex_vat: unitEx,
    vat_rate: vatRate,
    unit_price_inc_vat: unitInc,
    line_value_ex_vat: rounded(lineEx),
    line_value_inc_vat: lineInc,
    currency: q.currency || 'ZAR',
    stock_status: '',
    source_document: q.source_document || '',
    source_type: 'FORMAL_SUPPLIER_QUOTE',
    supplier_contact: q.supplier_contact || '',
    notes:
      'P5J exact canonical-part promotion from immutable supplier source line. ' +
      'Quote eligibility remains controlled by Supplier_Price_Audit.',
    last_verified_date: q.quote_date || '',
    supplier_quote_id: quoteId,
    source_line_id: l.source_line_id
  };
}

function planSupplierPriceObservation(envelope, match, {
  now = () => new Date()
} = {}) {
  const obs = envelope?.payload?.supplier_price_observation || {};
  obs.source = obs.source || envelope.source;
  obs.source_event_id =
    obs.source_event_id || envelope.metadata?.upstream_source_event_id || '';

  const quoteId =
    match.existing_quote?.supplier_quote_id ||
    deterministicSupplierQuoteId(obs.quote);
  const writes = [];
  const evidenceLink = envelope.evidence?.[0]?.ref || '';

  if (!match.existing_quote) {
    writes.push(createIfAbsent({
      store: 'supplier',
      workbook_role: 'SUPPLIER',
      sheet: 'Supplier_Quotes',
      key: {
        header: 'supplier_quote_id',
        value: quoteId
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Supplier quote',
      intent: 'REGISTER_SUPPLIER_QUOTE_EVIDENCE',
      values: quoteValues(obs, quoteId, now()),
      required_headers: [
        'supplier_quote_id',
        'supplier_id',
        'supplier_quote_number'
      ]
    }));
  }

  const immutableLine = immutableSourceLineValues(
    obs,
    quoteId,
    match.supplier?.supplier_approval_state || ''
  );
  immutableLine.evidence_link = evidenceLink;

  if (!match.existing_source_line) {
    writes.push(createIfAbsent({
      store: 'supplier',
      workbook_role: 'SUPPLIER',
      sheet: 'Supplier_Source_Lines',
      key: {
        header: 'source_line_id',
        value: obs.line.source_line_id
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Supplier source line',
      intent: 'REGISTER_SUPPLIER_SOURCE_LINE',
      values: {
        ...immutableLine,
        canonical_part_id: match.part?.part_id || '',
        match_status: match.part ? match.part_basis : 'REVIEW_REQUIRED',
        processing_status:
          match.price_promotion_allowed ? 'COMPLETE' : 'REVIEW_REQUIRED',
        notes: [
          obs.line.notes || '',
          match.review_required_after_capture ? match.review_reason : ''
        ].filter(Boolean).join(' ')
      },
      required_headers: [
        'source_line_id',
        'source_system',
        'source_event_id',
        'supplier_id',
        'supplier_quote_id',
        'supplier_quote_number',
        'evidence_link'
      ]
    }));
  } else {
    // Re-declare only immutable source facts. This is a safe no-op on exact replay.
    writes.push(createIfAbsent({
      store: 'supplier',
      workbook_role: 'SUPPLIER',
      sheet: 'Supplier_Source_Lines',
      key: {
        header: 'source_line_id',
        value: obs.line.source_line_id
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Supplier source line',
      intent: 'VERIFY_SUPPLIER_SOURCE_LINE_REPLAY',
      values: immutableLine
    }));

    if (
      match.part &&
      !match.existing_source_line.canonical_part_id
    ) {
      writes.push(patchIfMatch({
        store: 'supplier',
        workbook_role: 'SUPPLIER',
        sheet: 'Supplier_Source_Lines',
        key: {
          header: 'source_line_id',
          value: obs.line.source_line_id
        },
        authority: 'AUTHORITATIVE',
        entity_type: 'Supplier source line',
        intent: 'APPLY_EXACT_CANONICAL_PART_MAPPING',
        expect: {
          canonical_part_id: ''
        },
        changes: {
          canonical_part_id: match.part.part_id,
          match_status: match.part_basis,
          processing_status:
            match.price_promotion_allowed ? 'COMPLETE' : 'REVIEW_REQUIRED'
        }
      }));
    }
  }

  if (match.price_promotion_allowed && !match.existing_price) {
    const values = priceValues(obs, match, quoteId);
    writes.push(recordSupplierPrice({
      store: 'supplier',
      workbook_role: 'SUPPLIER',
      sheet: 'Supplier_Prices',
      key: {
        header: 'price_record_id',
        value: values.price_record_id
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Supplier price',
      intent: 'PROMOTE_EXACT_SUPPLIER_PRICE',
      values,
      required_headers: [
        'price_record_id',
        'part_id',
        'supplier_id',
        'source_line_id'
      ]
    }));
  }

  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    input_scope: 'SUPPLIER_PRICE_SOURCE_LINE',
    evidence_link: evidenceLink,
    preconditions: [],
    writes
  });
}

module.exports = {
  planSupplierPriceObservation,
  deterministicSupplierQuoteId,
  deterministicPriceRecordId,
  parseVatRate,
  quoteValues,
  immutableSourceLineValues,
  priceValues
};
