'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyDocument } = require('../processor/classify-document');
const { normalizeDocument } = require('../processor/normalize-document');

test('classifies a supplier tax invoice', () => {
  const text = [
    'TAX INVOICE',
    'Invoice No: IN455270',
    'VAT Number: 1234567890',
    'Subtotal R 697.66',
    'VAT R 104.65',
    'Total R 802.31'
  ].join('\n');

  const result = classifyDocument({ text, fileName: 'supplier-invoice.pdf' });
  assert.equal(result.type, 'SUPPLIER_INVOICE');
  assert.ok(result.confidence >= 0.78);

  const normalized = normalizeDocument({ text, classification: result });
  assert.equal(normalized.document_number, 'IN455270');
  assert.equal(normalized.currency, 'ZAR');
  assert.equal(normalized.total, 802.31);
});

test('classifies a bank statement without treating it as payment proof', () => {
  const text = [
    'BANK STATEMENT',
    'Statement Period 01/09/2026 - 20/09/2026',
    'Opening Balance',
    'Transaction Date Debit Credit',
    'Closing Balance'
  ].join('\n');

  const result = classifyDocument({ text, fileName: 'statement.pdf' });
  assert.equal(result.type, 'BANK_STATEMENT');
});

test('keeps ambiguous content as OTHER', () => {
  const result = classifyDocument({ text: 'hello world', fileName: 'note.txt' });
  assert.equal(result.type, 'OTHER');
});
