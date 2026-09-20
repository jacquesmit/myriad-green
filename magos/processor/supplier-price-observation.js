'use strict';

const { createEventEnvelope } = require('./event-envelope');

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function padLine(value) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 0) return String(n).padStart(3, '0');
  return String(value).trim();
}

function supplierSourceLineId(source, sourceEventId, lineNo) {
  return [String(source), String(sourceEventId), padLine(lineNo)].join('|');
}

function eventOccurredAt(sourceDate, fallback) {
  if (sourceDate) {
    const parsed = new Date(sourceDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback instanceof Date ? fallback : new Date(fallback);
}

function normalizeSupplierPriceObservation(input = {}) {
  const source = required(input.source, 'source');
  const sourceEventId = required(input.source_event_id, 'source_event_id');
  const quote = input.quote || {};
  const line = input.line || {};

  const supplierId = required(quote.supplier_id || input.supplier_id, 'quote.supplier_id');
  const quoteNumber = required(quote.supplier_quote_number, 'quote.supplier_quote_number');
  const lineNo = required(line.source_line_no, 'line.source_line_no');
  const lineId = line.source_line_id ||
    supplierSourceLineId(source, sourceEventId, lineNo);

  return {
    source: String(source),
    source_event_id: String(sourceEventId),
    source_thread_id: String(input.source_thread_id || ''),
    quote: {
      supplier_id: String(supplierId),
      supplier_quote_number: String(quoteNumber),
      project_reference: String(quote.project_reference || ''),
      quote_date: String(quote.quote_date || ''),
      valid_until: String(quote.valid_until || ''),
      currency: String(quote.currency || 'ZAR').toUpperCase(),
      vat_basis: String(quote.vat_basis || ''),
      source_document: String(quote.source_document || ''),
      supplier_contact: String(quote.supplier_contact || ''),
      delivery_terms: String(quote.delivery_terms || ''),
      payment_terms: String(quote.payment_terms || ''),
      notes: String(quote.notes || '')
    },
    line: {
      source_line_id: String(lineId),
      source_page: String(line.source_page || ''),
      source_line_no: String(lineNo),
      supplier_sku: String(line.supplier_sku || ''),
      source_description: String(line.source_description || ''),
      quantity: numberOrNull(line.quantity),
      source_unit: String(line.source_unit || ''),
      unit_price_ex_vat: numberOrNull(line.unit_price_ex_vat),
      vat_rate: line.vat_rate === undefined || line.vat_rate === null
        ? null
        : line.vat_rate,
      line_total_ex_vat: numberOrNull(line.line_total_ex_vat),
      canonical_part_id: String(line.canonical_part_id || ''),
      source_price_vat_basis: String(
        line.source_price_vat_basis || quote.vat_basis || ''
      ),
      notes: String(line.notes || '')
    }
  };
}

function createSupplierPriceObservedEvent(input = {}, {
  receivedAt = new Date()
} = {}) {
  const normalized = normalizeSupplierPriceObservation(input);
  const lineEventId =
    normalized.source_event_id + '|LINE:' +
    padLine(normalized.line.source_line_no);

  return createEventEnvelope({
    source: normalized.source,
    source_event_id: lineEventId,
    event_type: 'SUPPLIER_PRICE_OBSERVED',
    occurred_at:
      input.occurred_at ||
      eventOccurredAt(normalized.quote.quote_date, receivedAt),
    received_at: input.received_at || receivedAt,
    ...(input.correlation_id
      ? { correlation_id: String(input.correlation_id) }
      : {}),
    entity_hints: {
      supplier_id: normalized.quote.supplier_id,
      ...(normalized.line.canonical_part_id
        ? { part_id: normalized.line.canonical_part_id }
        : {})
    },
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR',
      ...(input.guards || {})
    },
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    payload: {
      supplier_price_observation: normalized
    },
    metadata: {
      supplier_price_observation_version: 'MAGOS-SUPPLIER-PRICE-OBSERVATION/V1',
      upstream_source_event_id: normalized.source_event_id,
      source_line_id: normalized.line.source_line_id
    }
  });
}

module.exports = {
  normalizeSupplierPriceObservation,
  createSupplierPriceObservedEvent,
  supplierSourceLineId,
  numberOrNull,
  padLine,
  eventOccurredAt
};
