'use strict';

const CANONICAL_HINTS = [
  ['crm_id', 'CRM'],
  ['opportunity_id', 'Opportunity'],
  ['job_id', 'Job'],
  ['quote_id', 'Quote'],
  ['invoice_id', 'Invoice'],
  ['payment_event_id', 'Payment'],
  ['supplier_id', 'Supplier']
];

function array(value) {
  return Array.isArray(value) ? value : [];
}

function exactCandidates(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.candidates)) return result.candidates;
  return [result];
}

class ZeroAResolver {
  constructor({
    findEvidenceByDriveFileId = async () => null,
    findEntityByCanonicalId = async () => null,
    findByDocumentNumber = async () => []
  } = {}) {
    this.findEvidenceByDriveFileId = findEvidenceByDriveFileId;
    this.findEntityByCanonicalId = findEntityByCanonicalId;
    this.findByDocumentNumber = findByDocumentNumber;
  }

  async resolve(envelope) {
    const doc = envelope?.payload?.document || {};
    const driveFileId = doc.drive_file_id || envelope?.entity_hints?.drive_file_id || null;

    if (!driveFileId) {
      return {
        status: 'UNRESOLVED',
        confidence: 0,
        basis: 'NONE',
        reason: '00A document has no immutable Drive file ID.',
        candidates: []
      };
    }

    const existingEvidence = await this.findEvidenceByDriveFileId(driveFileId);
    if (existingEvidence) {
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_FILE_LINK',
        entity: {
          type: 'Evidence index',
          id: existingEvidence.evidence_index_id || ('EVI-DRIVE-' + driveFileId)
        },
        canonical_ids: {
          crm_id: existingEvidence.crm_id || '',
          opportunity_id: existingEvidence.opportunity_id || '',
          job_id: existingEvidence.job_id || '',
          quote_id: existingEvidence.quote_id || '',
          invoice_id: existingEvidence.invoice_id || '',
          payment_event_id: existingEvidence.payment_event_id || '',
          supplier_id: existingEvidence.supplier_id || ''
        },
        candidates: []
      };
    }

    const hints = {
      ...(envelope.entity_hints || {}),
      ...(doc.normalized?.structured_fields?.canonical_ids || {})
    };

    const verified = {};
    for (const [field, entityType] of CANONICAL_HINTS) {
      const value = hints[field];
      if (!value) continue;
      const found = await this.findEntityByCanonicalId(entityType, value);
      if (!found) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: field + '=' + value + ' was supplied but did not resolve.',
          candidates: []
        };
      }
      verified[field] = value;
    }

    if (Object.keys(verified).length) {
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_ID',
        entity: {
          type: 'Evidence index',
          id: 'EVI-DRIVE-' + driveFileId
        },
        canonical_ids: verified,
        candidates: []
      };
    }

    const documentNumber = doc.normalized?.document_number || null;
    if (documentNumber) {
      const result = await this.findByDocumentNumber(
        doc.document_type || 'OTHER',
        documentNumber
      );
      const candidates = exactCandidates(result);

      if (candidates.length === 1) {
        const candidate = candidates[0];
        return {
          status: 'MATCHED',
          confidence: 1,
          basis: 'EXACT_REFERENCE',
          entity: {
            type: 'Evidence index',
            id: 'EVI-DRIVE-' + driveFileId
          },
          canonical_ids: candidate.canonical_ids || {},
          matched_reference: documentNumber,
          candidates: []
        };
      }

      if (candidates.length > 1) {
        return {
          status: 'AMBIGUOUS',
          confidence: 1,
          basis: 'EXACT_REFERENCE',
          reason: 'Document reference matched more than one canonical record.',
          candidates
        };
      }
    }

    return {
      status: 'UNRESOLVED',
      confidence: 0,
      basis: 'NONE',
      reason: 'No deterministic canonical entity match found.',
      candidates: []
    };
  }
}

module.exports = {
  ZeroAResolver,
  CANONICAL_HINTS
};
