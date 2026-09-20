'use strict';

const { createEventEnvelope } = require('./event-envelope');
const { patchIfMatch, composeTransactionPlan } = require('../writer/operations');

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function driveFileLink(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view';
}

function driveFolderLink(folderId) {
  return 'https://drive.google.com/drive/folders/' + folderId;
}

async function proposeZeroAFiling({
  envelope,
  match,
  folderResolver,
  drive,
  intakeFolderId = process.env.MAGOS_00A_FOLDER_ID
}) {
  const fileId = required(
    envelope?.payload?.document?.drive_file_id || envelope?.entity_hints?.drive_file_id,
    'drive_file_id'
  );
  required(intakeFolderId, 'MAGOS_00A_FOLDER_ID');

  const folder = await folderResolver.resolve(envelope, match);
  if (folder.status !== 'MATCHED') {
    return {
      status: 'REVIEW_REQUIRED',
      reason_code:
        folder.status === 'CONFLICT'
          ? 'FILING_FOLDER_CONFLICT'
          : 'FILING_FOLDER_UNRESOLVED',
      reason: folder.reason || 'Canonical folder is not deterministically resolved.',
      folder
    };
  }

  const meta = await drive.getMetadata(fileId);
  const parents = meta.parents || [];
  const targetFolderId = folder.folder_id;

  if (parents.includes(targetFolderId) && !parents.includes(intakeFolderId)) {
    return {
      status: 'READY',
      action: 'NO_OP_ALREADY_FILED',
      file_id: fileId,
      source_folder_id: intakeFolderId,
      target_folder_id: targetFolderId,
      evidence_link: meta.webViewLink || driveFileLink(fileId),
      folder
    };
  }

  if (!parents.includes(intakeFolderId)) {
    return {
      status: 'REVIEW_REQUIRED',
      reason_code: 'FILING_SOURCE_PARENT_MISMATCH',
      reason:
        'File is not currently in the canonical 00A intake folder and is not already in the exact target folder.',
      actual_parents: parents,
      target_folder_id: targetFolderId,
      file_id: fileId,
      folder
    };
  }

  if (parents.length !== 1) {
    return {
      status: 'REVIEW_REQUIRED',
      reason_code: 'FILING_MULTIPLE_PARENTS',
      reason: '00A file has multiple current parents; move is not safe to infer.',
      actual_parents: parents,
      target_folder_id: targetFolderId,
      file_id: fileId,
      folder
    };
  }

  return {
    status: 'READY',
    action: 'MOVE',
    file_id: fileId,
    source_folder_id: intakeFolderId,
    target_folder_id: targetFolderId,
    evidence_link: meta.webViewLink || driveFileLink(fileId),
    folder
  };
}

async function executeZeroAFiling(proposal, { drive }) {
  if (proposal?.status !== 'READY') {
    throw new Error('READY filing proposal is required');
  }

  if (proposal.action === 'NO_OP_ALREADY_FILED') {
    const meta = await drive.getMetadata(proposal.file_id);
    if (!(meta.parents || []).includes(proposal.target_folder_id)) {
      throw new Error('ALREADY_FILED_READBACK_FAILED');
    }
    return {
      ...proposal,
      moved: false,
      readback: meta
    };
  }

  if (proposal.action !== 'MOVE') {
    throw new Error('Unsupported filing action ' + proposal.action);
  }

  const result = await drive.moveFile({
    fileId: proposal.file_id,
    fromFolderId: proposal.source_folder_id,
    toFolderId: proposal.target_folder_id
  });

  return {
    ...proposal,
    moved: !result.noOp,
    readback: result.after
  };
}

function buildDocumentFiledEvent(originalEnvelope, filingResult, {
  receivedAt = new Date()
} = {}) {
  const fileId = required(filingResult?.file_id, 'filingResult.file_id');
  const targetFolderId = required(
    filingResult?.target_folder_id,
    'filingResult.target_folder_id'
  );

  return createEventEnvelope({
    source: 'MAGOS_00A_FILING',
    source_event_id: fileId + '|' + targetFolderId,
    event_type: 'DOCUMENT_FILED',
    occurred_at: receivedAt,
    received_at: receivedAt,
    correlation_id: originalEnvelope.correlation_id || originalEnvelope.event_id,
    entity_hints: {
      drive_file_id: fileId,
      canonical_folder_id: targetFolderId,
      canonical_folder_link: driveFolderLink(targetFolderId)
    },
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [{
      type: 'DRIVE_MOVE_READBACK',
      ref:
        filingResult.readback?.webViewLink ||
        originalEnvelope.evidence?.[0]?.ref ||
        driveFileLink(fileId)
    }],
    payload: {
      document_filing: {
        drive_file_id: fileId,
        source_folder_id: filingResult.source_folder_id || '',
        target_folder_id: targetFolderId,
        moved: Boolean(filingResult.moved),
        parents_after: filingResult.readback?.parents || []
      }
    },
    metadata: {
      parent_event_id: originalEnvelope.event_id,
      parent_event_idempotency_key: originalEnvelope.idempotency_key
    }
  });
}

function planDocumentFiled(envelope, match) {
  const fileId = required(
    envelope?.entity_hints?.drive_file_id ||
      envelope?.payload?.document_filing?.drive_file_id,
    'drive_file_id'
  );
  const folderId = required(
    envelope?.entity_hints?.canonical_folder_id ||
      envelope?.payload?.document_filing?.target_folder_id,
    'canonical_folder_id'
  );
  const evidenceIndexId =
    match?.entity?.id || ('EVI-DRIVE-' + fileId);

  const write = patchIfMatch({
    store: 'crm',
    workbook_role: 'CRM',
    sheet: 'Evidence_Index',
    key: {
      header: 'evidence_index_id',
      value: evidenceIndexId
    },
    authority: 'AUTHORITATIVE',
    entity_type: 'Evidence index',
    intent: 'CONFIRM_00A_FILED',
    expect: {
      drive_file_id: fileId,
      filed_state: 'MATCHED_PENDING_FILING'
    },
    changes: {
      canonical_folder_id: folderId,
      canonical_folder_link: driveFolderLink(folderId),
      filed_state: 'FILED',
      evidence_link: envelope.evidence?.[0]?.ref || driveFileLink(fileId)
    },
    required_headers: [
      'evidence_index_id',
      'drive_file_id',
      'canonical_folder_id',
      'canonical_folder_link',
      'filed_state',
      'evidence_link'
    ]
  });

  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    input_scope: '00A_FILING',
    evidence_link: envelope.evidence?.[0]?.ref || '',
    preconditions: [],
    writes: [write]
  });
}

module.exports = {
  proposeZeroAFiling,
  executeZeroAFiling,
  buildDocumentFiledEvent,
  planDocumentFiled,
  driveFileLink,
  driveFolderLink
};
