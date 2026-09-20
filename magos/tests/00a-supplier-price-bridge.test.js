'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSupplierPriceEventsFromDocument,
  mapStructuredSupplierLine
} = require('../processor/00a-supplier-price-bridge');

function document(overrides = {}) {
  return {
    document_id: 'DOC-1',
    source_event_id: 'DRIVE-FILE-1',
    drive_file_id: 'DRIVE-FILE-1',
    file_name: 'Q-100.pdf',
    file_hash: 'a'.repeat(64),
    document_type: 'SUPPLIER_QUOTE',
    review_required: false,
    normalized: {
      document_number: 'Q-100',
      document_date: '2026-09-20',
      currency: 'ZAR',
      line_items: [{
        lineNo: 1,
        sku: 'SKU-1',
        description: '25 mm valve',
        quantity: 2,
        unit: 'EA',
        unitPriceExVat: 100,
        vatRate: 0.15,
        lineTotalExVat: 200
      }],
      structured_fields: {
        vatBasis: 'VAT_15_PERCENT',
        validUntil: '2026-10-20'
      }
    },
    ...overrides
  };
}

test('validated 00A supplier quote becomes one P5J event per structured line', () => {
  const result = buildSupplierPriceEventsFromDocument(document(), {
    supplierId: 'SUP-AJ'
  });

  assert.equal(result.status, 'READY');
  assert.equal(result.event_count, 1);
  const event = result.events[0];
  assert.equal(event.event_type, 'SUPPLIER_PRICE_OBSERVED');
  assert.equal(event.entity_hints.supplier_id, 'SUP-AJ');
  assert.equal(
    event.payload.supplier_price_observation.line.source_line_id,
    'DRIVE_00A|DRIVE-FILE-1|001'
  );
  assert.equal(
    event.payload.supplier_price_observation.quote.supplier_quote_number,
    'Q-100'
  );
});

test('00A document already requiring review emits no pricing events', () => {
  const result = buildSupplierPriceEventsFromDocument(document({
    review_required: true
  }), {
    supplierId: 'SUP-AJ'
  });

  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.reason_code, 'DOCUMENT_EXTRACTION_REVIEW_REQUIRED');
  assert.deepEqual(result.events, []);
});

test('missing canonical supplier identity routes to review', () => {
  const result = buildSupplierPriceEventsFromDocument(document());
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.reason_code, 'SUPPLIER_ID_REQUIRED');
  assert.deepEqual(result.events, []);
});

test('missing supplier quote number routes to review', () => {
  const doc = document();
  doc.normalized.document_number = null;
  const result = buildSupplierPriceEventsFromDocument(doc, {
    supplierId: 'SUP-AJ'
  });

  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.reason_code, 'SUPPLIER_QUOTE_NUMBER_REQUIRED');
});

test('missing structured line items routes to review', () => {
  const doc = document();
  doc.normalized.line_items = [];
  const result = buildSupplierPriceEventsFromDocument(doc, {
    supplierId: 'SUP-AJ'
  });

  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.reason_code, 'SUPPLIER_LINE_ITEMS_REQUIRED');
});

test('line mapping uses declared field aliases but does not infer a canonical part', () => {
  const line = mapStructuredSupplierLine({
    lineNumber: 7,
    itemCode: 'ABC',
    itemDescription: 'Some item',
    qty: 3,
    uom: 'EA',
    priceExVat: 20,
    taxRate: '15%',
    amountExVat: 60
  }, 0);

  assert.equal(line.source_line_no, 7);
  assert.equal(line.supplier_sku, 'ABC');
  assert.equal(line.quantity, 3);
  assert.equal(line.unit_price_ex_vat, 20);
  assert.equal(line.canonical_part_id, '');
});

test('controlled line-to-part map may carry an exact part hint for later verification', () => {
  const result = buildSupplierPriceEventsFromDocument(document(), {
    supplierId: 'SUP-AJ',
    canonicalPartIdsByLine: {
      '1': 'PART-1'
    }
  });

  assert.equal(
    result.events[0].payload.supplier_price_observation.line.canonical_part_id,
    'PART-1'
  );
});
