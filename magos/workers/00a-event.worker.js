'use strict';

const { createEventEnvelope } = require('../processor/event-envelope');

function documentEnvelopeToEvent(documentEnvelope, {
  receivedAt = new Date(),
  occurredAt = null,
  canonicalIds = {},
  canonicalFolderId = '',
  canonicalFolderLink = ''
} = {}) {
  if (!documentEnvelope || typeof documentEnvelope !== 'object') {
    throw new Error('documentEnvelope is required');
  }
  if (!documentEnvelope.drive_file_id) {
    throw new Error('documentEnvelope.drive_file_id is required');
  }

  const evidenceRef = documentEnvelope.drive_file_id
    ? 'https://drive.google.com/file/d/' + documentEnvelope.drive_file_id + '/view'
    : '';

  return createEventEnvelope({
    source: 'DRIVE_00A',
    source_event_id: documentEnvelope.source_event_id || documentEnvelope.drive_file_id,
    event_type: 'DOCUMENT_RECEIVED',
    occurred_at: occurredAt || receivedAt,
    received_at: receivedAt,
    entity_hints: {
      drive_file_id: documentEnvelope.drive_file_id,
      ...canonicalIds,
      ...(canonicalFolderId ? { canonical_folder_id: canonicalFolderId } : {}),
      ...(canonicalFolderLink ? { canonical_folder_link: canonicalFolderLink } : {})
    },
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: documentEnvelope.document_type === 'OTHER' ? 'UNKNOWN' : 'CLEAR'
    },
    evidence: [{
      type: 'DRIVE_FILE',
      ref: evidenceRef,
      hash: documentEnvelope.file_hash || null,
      label: documentEnvelope.file_name || null
    }],
    payload: {
      document: structuredClone(documentEnvelope)
    },
    metadata: {
      document_rule_version: documentEnvelope.rule_version || null,
      extraction_method: documentEnvelope.extraction_method || null,
      review_required_upstream: Boolean(documentEnvelope.review_required)
    }
  });
}

module.exports = {
  documentEnvelopeToEvent
};
