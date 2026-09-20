'use strict';

const {
  createSupplierPriceObservedEvent
} = require('./supplier-price-observation');

function first(value, ...fallbacks) {
  if (value !== undefined && value !== null && value !== '') return value;
  for (const candidate of fallbacks) {
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      return candidate;
    }
  }
  return '';
}

function driveLink(fileId) {
  return fileId
    ? 'https://drive.google.com/file/d/' + fileId + '/view'
    : '';
}

function lineNumber(item, index) {
  return first(
    item?.source_line_no,
    item?.lineNo,
    item?.lineNumber,
    item?.line_no,
    index + 1
  );
}

function mapStructuredSupplierLine(item = {}, index = 0, {
  canonicalPartIdsByLine = {}
} = {}) {
  const no = lineNumber(item, index);
  return {
    source_line_no: no,
    source_page: first(item.source_page, item.page, item.pageNumber),
    supplier_sku: first(
      item.supplier_sku,
      item.sku,
      item.itemCode,
      item.item_code,
      item.code
    ),
    source_description: first(
      item.source_description,
      item.description,
      item.name,
      item.itemDescription
    ),
    quantity: first(item.quantity, item.qty),
    source_unit: first(item.source_unit, item.unit, item.uom),
    unit_price_ex_vat: first(
      item.unit_price_ex_vat,
      item.unitPriceExVat,
      item.priceExVat
    ),
    vat_rate: first(
      item.vat_rate,
      item.vatRate,
      item.taxRate
    ),
    line_total_ex_vat: first(
      item.line_total_ex_vat,
      item.lineTotalExVat,
      item.amountExVat
    ),
    canonical_part_id: first(
      canonicalPartIdsByLine[String(no)],
      item.canonical_part_id
    ),
    source_price_vat_basis: first(
      item.source_price_vat_basis,
      item.vatBasis
    ),
    notes: first(item.notes)
  };
}

function buildSupplierPriceEventsFromDocument(documentEnvelope, {
  supplierId,
  evidenceLink = '',
  sourceSystem = 'DRIVE_00A',
  sourceThreadId = '',
  canonicalPartIdsByLine = {}
} = {}) {
  if (!documentEnvelope || typeof documentEnvelope !== 'object') {
    throw new Error('documentEnvelope is required');
  }

  if (documentEnvelope.document_type !== 'SUPPLIER_QUOTE') {
    return {
      status: 'UNSUPPORTED',
      reason_code: 'NOT_SUPPLIER_QUOTE',
      events: []
    };
  }

  if (documentEnvelope.review_required) {
    return {
      status: 'REVIEW_REQUIRED',
      reason_code: 'DOCUMENT_EXTRACTION_REVIEW_REQUIRED',
      reason:
        '00A document extraction/classification must pass before supplier pricing events are emitted.',
      events: []
    };
  }

  if (!supplierId) {
    return {
      status: 'REVIEW_REQUIRED',
      reason_code: 'SUPPLIER_ID_REQUIRED',
      reason:
        'Supplier document is extracted but no exact canonical supplier_id was supplied.',
      events: []
    };
  }

  const normalized = documentEnvelope.normalized || {};
  if (!normalized.document_number) {
    return {
      status: 'REVIEW_REQUIRED',
      reason_code: 'SUPPLIER_QUOTE_NUMBER_REQUIRED',
      reason: 'Supplier quote number is required before line events are emitted.',
      events: []
    };
  }

  const items = Array.isArray(normalized.line_items)
    ? normalized.line_items
    : [];
  if (!items.length) {
    return {
      status: 'REVIEW_REQUIRED',
      reason_code: 'SUPPLIER_LINE_ITEMS_REQUIRED',
      reason: 'No structured supplier quote line items were extracted.',
      events: []
    };
  }

  const structured = normalized.structured_fields || {};
  const upstreamSourceEventId =
    documentEnvelope.source_event_id ||
    documentEnvelope.drive_file_id ||
    documentEnvelope.document_id;
  const ref =
    evidenceLink ||
    driveLink(documentEnvelope.drive_file_id);

  const events = items.map((item, index) => {
    const line = mapStructuredSupplierLine(item, index, {
      canonicalPartIdsByLine
    });

    return createSupplierPriceObservedEvent({
      source: sourceSystem,
      source_event_id: upstreamSourceEventId,
      source_thread_id: sourceThreadId,
      evidence: [{
        type: 'SUPPLIER_QUOTE',
        ref,
        hash: documentEnvelope.file_hash || null,
        label: documentEnvelope.file_name || null
      }],
      quote: {
        supplier_id: supplierId,
        supplier_quote_number: normalized.document_number,
        project_reference: first(
          structured.projectReference,
          structured.project_reference
        ),
        quote_date: normalized.document_date || '',
        valid_until: first(
          structured.validUntil,
          structured.valid_until
        ),
        currency: normalized.currency || 'ZAR',
        vat_basis: first(
          structured.vatBasis,
          structured.vat_basis
        ),
        source_document: documentEnvelope.file_name || '',
        supplier_contact: first(
          structured.supplierContact,
          structured.supplier_contact
        ),
        delivery_terms: first(
          structured.deliveryTerms,
          structured.delivery_terms
        ),
        payment_terms: first(
          structured.paymentTerms,
          structured.payment_terms
        ),
        notes:
          'Generated from validated 00A supplier-quote document envelope ' +
          documentEnvelope.document_id + '.'
      },
      line
    });
  });

  return {
    status: 'READY',
    document_id: documentEnvelope.document_id,
    supplier_id: supplierId,
    supplier_quote_number: normalized.document_number,
    event_count: events.length,
    events
  };
}

module.exports = {
  buildSupplierPriceEventsFromDocument,
  mapStructuredSupplierLine,
  lineNumber,
  driveLink,
  first
};
