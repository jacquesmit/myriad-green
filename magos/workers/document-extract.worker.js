'use strict';

const { sha256, documentIdempotencyKey } = require('../lib/hash');
const { extractNative } = require('../processor/native-extract');
const { classifyDocument } = require('../processor/classify-document');
const { normalizeDocument } = require('../processor/normalize-document');
const { PdfCoAdapter } = require('../adapters/pdfco');
const { AuditLedger } = require('../adapters/audit-ledger');

function parseTemplateMap() {
  const raw = process.env.PDFCO_TEMPLATE_MAP_JSON || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('PDFCO_TEMPLATE_MAP_JSON must be valid JSON');
  }
}

function extractionConfidence(method, textQuality) {
  if (!textQuality?.usable) return 0.35;
  if (method === 'PDFCO_OCR') return 0.88;
  if (method === 'PDF_PARSE') return 0.94;
  if (method === 'PROVIDED_NATIVE_TEXT' || method === 'TEXT_BUFFER') return 0.96;
  return 0.75;
}

async function processDocument(input, deps = {}) {
  const {
    driveFileId = '',
    fileName = 'document',
    mimeType = 'application/octet-stream',
    buffer = Buffer.alloc(0),
    nativeText = null,
    evidenceLink = '',
    sourceContext = {},
    triggerType = 'DRIVE_INTAKE'
  } = input || {};

  if (!driveFileId && !buffer?.length && nativeText == null) {
    throw new Error('A driveFileId, buffer, or nativeText is required');
  }

  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const contentBasis = bytes.length ? bytes : Buffer.from(String(nativeText || ''), 'utf8');
  const contentHash = sha256(contentBasis);
  const idempotencyKey = documentIdempotencyKey({ driveFileId, contentHash });

  const ledger = deps.ledger || new AuditLedger();
  const pdfco = deps.pdfco || new PdfCoAdapter();
  const begin = await ledger.beginRun({
    idempotencyKey,
    inputScope: JSON.stringify({ driveFileId, fileName, mimeType, contentHash }),
    evidenceLink,
    triggerType
  });

  if (begin.duplicate) {
    return {
      status: 'DUPLICATE',
      idempotency_key: idempotencyKey,
      existing_run: begin.existing
    };
  }

  try {
    let native = await extractNative({ buffer: bytes, mimeType, nativeText });
    let extractedText = native.text || '';
    let extractionMethod = native.method;
    let pdfcoUrl = null;
    const paidActions = [];

    if (!native.quality.usable && pdfco.isConfigured()) {
      const uploaded = await pdfco.uploadBuffer({ buffer: bytes, fileName, mimeType });
      pdfcoUrl = uploaded.url;
      paidActions.push('PDFCO_UPLOAD');

      const ocr = await pdfco.extractText({ url: pdfcoUrl });
      extractedText = ocr.text || '';
      extractionMethod = 'PDFCO_OCR';
      native = {
        ...native,
        quality: require('../processor/native-extract').quality(extractedText)
      };
      paidActions.push('PDFCO_OCR');
    }

    const classification = classifyDocument({
      text: extractedText,
      fileName,
      hints: sourceContext
    });

    let structured = null;
    const templateMap = parseTemplateMap();
    const templateId = templateMap[classification.type];

    if (pdfcoUrl && templateId) {
      structured = await pdfco.parseWithTemplate({ url: pdfcoUrl, templateId });
      paidActions.push('PDFCO_DOCUMENT_PARSER');
    } else if (
      pdfcoUrl &&
      classification.type === 'SUPPLIER_INVOICE' &&
      String(process.env.PDFCO_ENABLE_AI_INVOICE || '').toLowerCase() === 'true'
    ) {
      structured = await pdfco.parseInvoiceAi({ url: pdfcoUrl });
      paidActions.push('PDFCO_AI_INVOICE');
    }

    const normalized = normalizeDocument({
      text: extractedText,
      classification,
      structured: structured?.body || structured
    });

    const extractConfidence = extractionConfidence(extractionMethod, native.quality);
    const reviewRequired =
      !native.quality.usable ||
      classification.type === 'OTHER' ||
      classification.confidence < 0.78 ||
      extractConfidence < 0.8;

    const familyId = 'DOC-' + contentHash.slice(0, 20).toUpperCase();
    const envelope = {
      document_id: familyId,
      source_event_id: sourceContext.sourceEventId || driveFileId || familyId,
      drive_file_id: driveFileId || null,
      file_name: fileName,
      mime_type: mimeType,
      file_hash: contentHash,
      document_type: classification.type,
      classification_confidence: classification.confidence,
      classification_evidence: classification.evidence,
      extraction_confidence: extractConfidence,
      extraction_method: extractionMethod,
      extraction_quality: native.quality,
      paid_actions: paidActions,
      review_required: reviewRequired,
      normalized,
      idempotency_key: idempotencyKey,
      rule_version: 'MAGOS-DOC-EXTRACT-01/V1'
    };

    let documentStateId = '';
    if (driveFileId) {
      documentStateId = await ledger.recordDocumentState({
        driveFileId,
        familyId,
        documentType: classification.type,
        evidenceLink,
        notes: JSON.stringify({
          classificationConfidence: classification.confidence,
          extractionConfidence: extractConfidence,
          extractionMethod,
          reviewRequired
        })
      });
    }

    let exceptionId = '';
    if (reviewRequired && driveFileId) {
      exceptionId = await ledger.raiseReviewException({
        driveFileId,
        idempotencyKey,
        evidenceLink,
        sourceValue: JSON.stringify({
          type: classification.type,
          classificationConfidence: classification.confidence,
          extractionConfidence: extractConfidence,
          extractionMethod
        }),
        actionRequired: 'Review extracted text/classification; only release clear matches to the MAGOS transaction writer.'
      });
    }

    const finalState = reviewRequired ? 'REVIEW_REQUIRED' : 'COMMITTED';
    await ledger.completeRun(idempotencyKey, {
      state: finalState,
      affectedRecordIds: [documentStateId, exceptionId].filter(Boolean).join(','),
      writesSummary: 'Document_State_Register' + (exceptionId ? ' + Sync_Exceptions' : ''),
      readbackSummary: 'Idempotency key resolved and audit rows written through live headers.',
      errorOrBlocker: reviewRequired ? 'Human review required before authoritative business mutation.' : ''
    });

    return {
      status: finalState,
      envelope,
      document_state_id: documentStateId || null,
      exception_id: exceptionId || null
    };
  } catch (error) {
    await ledger.completeRun(idempotencyKey, {
      state: 'FAILED',
      errorOrBlocker: error.message
    }).catch(() => {});
    throw error;
  }
}

module.exports = { processDocument };
