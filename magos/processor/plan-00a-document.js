'use strict';

const {
  createIfAbsent,
  composeTransactionPlan
} = require('../writer/operations');

function evidenceType(documentType) {
  const map = {
    PAYMENT_PROOF: 'PAYMENT_NOTIFICATION',
    BANK_STATEMENT: 'BANK_STATEMENT',
    SUPPLIER_INVOICE: 'SUPPLIER_INVOICE',
    SUPPLIER_QUOTE: 'SUPPLIER_QUOTE',
    PURCHASE_ORDER: 'PURCHASE_ORDER',
    JOB_REPORT: 'JOB_REPORT',
    ORDER: 'ORDER',
    REPORT: 'REPORT'
  };
  return map[documentType] || 'DOCUMENT';
}

function privacyClass(documentType) {
  if (['PAYMENT_PROOF', 'BANK_STATEMENT', 'SUPPLIER_INVOICE'].includes(documentType)) {
    return 'RESTRICTED_FINANCIAL';
  }
  if (['JOB_REPORT', 'REPORT'].includes(documentType)) {
    return 'RESTRICTED_CLIENT_TECHNICAL';
  }
  return 'INTERNAL_BUSINESS';
}

function buildEvidenceValues(envelope, match, now = new Date()) {
  const doc = envelope.payload.document || {};
  const driveFileId = doc.drive_file_id;
  if (!driveFileId) throw new Error('drive_file_id is required for 00A evidence planning');

  const ids = match?.canonical_ids || {};
  const evidence = envelope.evidence?.[0] || {};
  const evidenceIndexId = 'EVI-DRIVE-' + driveFileId;

  return {
    evidence_index_id: evidenceIndexId,
    drive_file_id: driveFileId,
    file_name: doc.file_name || '',
    mime_type: doc.mime_type || '',
    evidence_type: evidenceType(doc.document_type),
    source_system: envelope.source,
    source_event_id: envelope.source_event_id,
    crm_id: ids.crm_id || '',
    opportunity_id: ids.opportunity_id || '',
    job_id: ids.job_id || '',
    quote_id: ids.quote_id || '',
    invoice_id: ids.invoice_id || '',
    payment_event_id: ids.payment_event_id || '',
    supplier_id: ids.supplier_id || '',
    canonical_folder_id: envelope.entity_hints?.canonical_folder_id || '',
    canonical_folder_link: envelope.entity_hints?.canonical_folder_link || '',
    evidence_link: evidence.ref || '',
    filed_state: envelope.entity_hints?.canonical_folder_id ? 'FILED' : 'MATCHED_PENDING_FILING',
    privacy_class: privacyClass(doc.document_type),
    public_use_consent: 'NO',
    captured_at: now.toISOString(),
    verified_at: '',
    idempotency_key: 'EVIDENCE|DRIVE|' + driveFileId,
    notes: [
      'Created by MAGOS P5B-00A from deterministic event evidence.',
      doc.document_type ? 'document_type=' + doc.document_type : '',
      doc.normalized?.document_number ? 'document_number=' + doc.normalized.document_number : ''
    ].filter(Boolean).join(' ')
  };
}

function planZeroADocument(envelope, match, { now = () => new Date() } = {}) {
  const values = buildEvidenceValues(envelope, match, now());

  const write = createIfAbsent({
    store: 'crm',
    workbook_role: 'CRM',
    sheet: 'Evidence_Index',
    key: {
      header: 'evidence_index_id',
      value: values.evidence_index_id
    },
    authority: 'AUTHORITATIVE',
    entity_type: 'Evidence index',
    intent: 'REGISTER_00A_EVIDENCE',
    values,
    required_headers: [
      'evidence_index_id',
      'drive_file_id',
      'evidence_type',
      'source_system',
      'source_event_id',
      'evidence_link',
      'filed_state',
      'idempotency_key'
    ]
  });

  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    input_scope: '00A_DOCUMENT',
    evidence_link: envelope.evidence?.[0]?.ref || '',
    preconditions: [],
    writes: [write]
  });
}

module.exports = {
  planZeroADocument,
  buildEvidenceValues,
  evidenceType,
  privacyClass
};
