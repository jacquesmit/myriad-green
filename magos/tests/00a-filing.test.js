'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createEventEnvelope } = require('../processor/event-envelope');
const { CanonicalFolderResolver } = require('../processor/canonical-folder-resolver');
const {
  proposeZeroAFiling,
  executeZeroAFiling,
  buildDocumentFiledEvent,
  planDocumentFiled
} = require('../processor/00a-filing');
const { EventProcessor } = require('../processor/event-processor');

function receivedEvent() {
  return createEventEnvelope({
    source: 'DRIVE_00A',
    source_event_id: 'FILE-1',
    event_type: 'DOCUMENT_RECEIVED',
    occurred_at: '2026-09-20T10:00:00Z',
    received_at: '2026-09-20T10:00:01Z',
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [{ type: 'DRIVE_FILE', ref: 'drive://FILE-1' }],
    payload: { document: { drive_file_id: 'FILE-1' } }
  });
}

test('folder resolver obtains exact job folder and refuses name-only inference', async () => {
  const resolver = new CanonicalFolderResolver({
    lookupService: {
      async findEntityByCanonicalId(type, id) {
        if (type === 'Job' && id === 'JOB-1') {
          return {
            job_id: 'JOB-1',
            job_folder_link: 'https://drive.google.com/drive/folders/FOLDER_JOB_12345'
          };
        }
        return null;
      }
    }
  });

  const result = await resolver.resolve(receivedEvent(), {
    canonical_ids: { job_id: 'JOB-1' }
  });
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.folder_id, 'FOLDER_JOB_12345');

  const unresolved = await resolver.resolve(receivedEvent(), {
    canonical_ids: {}
  });
  assert.equal(unresolved.status, 'UNRESOLVED');
});

test('conflicting canonical IDs produce review instead of choosing a folder', async () => {
  const resolver = new CanonicalFolderResolver({
    lookupService: {
      async findEntityByCanonicalId(type) {
        if (type === 'Job') {
          return { job_folder_link: 'https://drive.google.com/drive/folders/FOLDER_JOB_12345' };
        }
        if (type === 'Quote') {
          return { drive_folder_id: 'FOLDER_QUOTE_67890' };
        }
        return null;
      }
    }
  });

  const proposal = await proposeZeroAFiling({
    envelope: receivedEvent(),
    match: {
      canonical_ids: { job_id: 'JOB-1', quote_id: 'QTE-1' }
    },
    folderResolver: resolver,
    drive: {
      async getMetadata() {
        throw new Error('Drive must not be read when folder identity conflicts');
      }
    },
    intakeFolderId: '00A_FOLDER'
  });

  assert.equal(proposal.status, 'REVIEW_REQUIRED');
  assert.equal(proposal.reason_code, 'FILING_FOLDER_CONFLICT');
});

test('file outside 00A and target routes to review', async () => {
  const resolver = {
    async resolve() {
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_ID',
        folder_id: 'TARGET'
      };
    }
  };

  const proposal = await proposeZeroAFiling({
    envelope: receivedEvent(),
    match: {},
    folderResolver: resolver,
    drive: {
      async getMetadata() {
        return {
          id: 'FILE-1',
          parents: ['OTHER'],
          webViewLink: 'drive://FILE-1'
        };
      }
    },
    intakeFolderId: '00A'
  });

  assert.equal(proposal.status, 'REVIEW_REQUIRED');
  assert.equal(proposal.reason_code, 'FILING_SOURCE_PARENT_MISMATCH');
});

test('safe 00A move is read back from exact target', async () => {
  const proposal = {
    status: 'READY',
    action: 'MOVE',
    file_id: 'FILE-1',
    source_folder_id: '00A',
    target_folder_id: 'TARGET',
    evidence_link: 'drive://FILE-1'
  };

  const result = await executeZeroAFiling(proposal, {
    drive: {
      async moveFile(spec) {
        assert.deepEqual(spec, {
          fileId: 'FILE-1',
          fromFolderId: '00A',
          toFolderId: 'TARGET'
        });
        return {
          noOp: false,
          after: {
            id: 'FILE-1',
            parents: ['TARGET'],
            webViewLink: 'drive://FILE-1'
          }
        };
      }
    }
  });

  assert.equal(result.moved, true);
  assert.deepEqual(result.readback.parents, ['TARGET']);
});

test('DOCUMENT_FILED child event has distinct idempotency from DOCUMENT_RECEIVED parent', () => {
  const parent = receivedEvent();
  const child = buildDocumentFiledEvent(parent, {
    file_id: 'FILE-1',
    source_folder_id: '00A',
    target_folder_id: 'TARGET',
    moved: true,
    readback: {
      parents: ['TARGET'],
      webViewLink: 'drive://FILE-1'
    }
  }, {
    receivedAt: new Date('2026-09-20T10:05:00Z')
  });

  assert.equal(child.event_type, 'DOCUMENT_FILED');
  assert.notEqual(child.idempotency_key, parent.idempotency_key);
  assert.equal(child.metadata.parent_event_id, parent.event_id);
  assert.equal(child.entity_hints.canonical_folder_id, 'TARGET');
});

test('filed event plans guarded Evidence_Index state update', async () => {
  const parent = receivedEvent();
  const child = buildDocumentFiledEvent(parent, {
    file_id: 'FILE-1',
    source_folder_id: '00A',
    target_folder_id: 'TARGET',
    moved: true,
    readback: {
      parents: ['TARGET'],
      webViewLink: 'drive://FILE-1'
    }
  }, {
    receivedAt: new Date('2026-09-20T10:05:00Z')
  });

  const processor = new EventProcessor({
    resolver: async () => ({
      status: 'MATCHED',
      confidence: 1,
      basis: 'EXACT_FILE_LINK',
      entity: { type: 'Evidence index', id: 'EVI-DRIVE-FILE-1' }
    }),
    planner: async (env, match) => planDocumentFiled(env, match)
  });

  const decision = await processor.decide(child);
  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.transaction_plan.writes[0].operation, 'PATCH_IF_MATCH');
  assert.equal(
    decision.transaction_plan.writes[0].expect.filed_state,
    'MATCHED_PENDING_FILING'
  );
  assert.equal(
    decision.transaction_plan.writes[0].changes.filed_state,
    'FILED'
  );
});
