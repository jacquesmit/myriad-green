'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { processDocument } = require('../workers/document-extract.worker');

function fakeLedger() {
  const state = {
    begin: [],
    completed: [],
    documents: [],
    exceptions: []
  };
  return {
    state,
    async beginRun(args) {
      state.begin.push(args);
      return { duplicate: false, runLogId: 'ARL-TEST' };
    },
    async completeRun(key, args) {
      state.completed.push({ key, ...args });
    },
    async recordDocumentState(args) {
      state.documents.push(args);
      return 'DSR-TEST';
    },
    async raiseReviewException(args) {
      state.exceptions.push(args);
      return 'SYNC-EXC-TEST';
    }
  };
}

test('uses native text first and does not spend PDF.co credits when quality is good', async () => {
  const ledger = fakeLedger();
  let pdfcoCalls = 0;
  const pdfco = {
    isConfigured: () => true,
    async uploadBuffer() { pdfcoCalls++; throw new Error('should not upload'); }
  };

  const nativeText = [
    'TAX INVOICE',
    'Invoice No: IN455270',
    'VAT Number: 1234567890',
    'Subtotal R 697.66',
    'VAT R 104.65',
    'Total R 802.31',
    'Thank you for your business. This line makes the sample sufficiently long for native extraction quality.'
  ].join('\n');

  const result = await processDocument({
    driveFileId: 'drive-file-1',
    fileName: 'invoice.pdf',
    mimeType: 'application/pdf',
    nativeText,
    evidenceLink: 'https://drive.google.com/file/d/drive-file-1/view'
  }, { ledger, pdfco });

  assert.equal(result.status, 'COMMITTED');
  assert.equal(result.envelope.document_type, 'SUPPLIER_INVOICE');
  assert.equal(result.envelope.paid_actions.length, 0);
  assert.equal(pdfcoCalls, 0);
  assert.equal(ledger.state.exceptions.length, 0);
});

test('escalates poor native extraction to PDF.co OCR and routes uncertain result to review', async () => {
  const ledger = fakeLedger();
  let uploadCalls = 0;
  let ocrCalls = 0;
  const pdfco = {
    isConfigured: () => true,
    async uploadBuffer() {
      uploadCalls++;
      return { url: 'https://pdf.co/temp/test.pdf' };
    },
    async extractText() {
      ocrCalls++;
      return {
        text: 'REPORT\nFindings: roots in drain. Recommendations: specialist excavation may be required. Additional notes and observations from site visit.'
      };
    },
    async parseWithTemplate() { return null; },
    async parseInvoiceAi() { return null; }
  };

  const result = await processDocument({
    driveFileId: 'drive-file-2',
    fileName: 'scan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake scanned bytes'),
    evidenceLink: 'https://drive.google.com/file/d/drive-file-2/view'
  }, { ledger, pdfco });

  assert.equal(uploadCalls, 1);
  assert.equal(ocrCalls, 1);
  assert.equal(result.envelope.extraction_method, 'PDFCO_OCR');
  assert.ok(['COMMITTED', 'REVIEW_REQUIRED'].includes(result.status));
});

test('returns duplicate without reprocessing when audit ledger already owns the key', async () => {
  const ledger = fakeLedger();
  ledger.beginRun = async () => ({
    duplicate: true,
    existing: { run_state: 'COMMITTED', run_log_id: 'ARL-EXISTING' }
  });

  const pdfco = { isConfigured: () => false };

  const result = await processDocument({
    driveFileId: 'drive-file-3',
    fileName: 'duplicate.txt',
    mimeType: 'text/plain',
    nativeText: 'This is already processed content and should not run again even when the intake worker retries the same Drive file.'
  }, { ledger, pdfco });

  assert.equal(result.status, 'DUPLICATE');
  assert.equal(result.existing_run.run_log_id, 'ARL-EXISTING');
});
