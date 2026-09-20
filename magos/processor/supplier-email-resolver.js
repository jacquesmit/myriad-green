'use strict';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function emailTokens(value) {
  return String(value || '')
    .split(/[;,\n]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function supplierHasEmail(supplier, email) {
  const target = normalizeEmail(email);
  if (!target) return false;
  return emailTokens(supplier?.email).includes(target);
}

class SupplierEmailResolver {
  constructor({
    findIntakeBySourceEvent = async () => null,
    findEntityByCanonicalId = async () => null,
    findSupplierCandidatesByEmail = async () => []
  } = {}) {
    this.findIntakeBySourceEvent = findIntakeBySourceEvent;
    this.findEntityByCanonicalId = findEntityByCanonicalId;
    this.findSupplierCandidatesByEmail = findSupplierCandidatesByEmail;
  }

  async resolve(envelope) {
    const email = envelope?.payload?.supplier_email || {};

    const existingIntake = await this.findIntakeBySourceEvent(
      envelope.source,
      envelope.source_event_id
    );
    if (existingIntake?.__source_system_mismatch) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'EXACT_REFERENCE',
        reason:
          'source_event_id already exists under a different source_system.',
        candidates: [{
          existing_source_system: existingIntake.source_system,
          source_event_id: envelope.source_event_id
        }]
      };
    }

    const suppliedSupplierId =
      email.supplier_id || envelope?.entity_hints?.supplier_id || '';

    if (suppliedSupplierId) {
      const supplier = await this.findEntityByCanonicalId(
        'Supplier',
        suppliedSupplierId
      );
      if (!supplier) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Supplied supplier_id did not resolve.',
          candidates: []
        };
      }

      const senderKnown = email.sender_email
        ? supplierHasEmail(supplier, email.sender_email)
        : false;

      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_ID',
        entity: {
          type: 'Supplier',
          id: suppliedSupplierId
        },
        canonical_ids: {
          supplier_id: suppliedSupplierId
        },
        supplier,
        sender_email_known: senderKnown,
        review_required_after_capture:
          Boolean(email.sender_email) && !senderKnown,
        review_reason_code:
          Boolean(email.sender_email) && !senderKnown
            ? 'SUPPLIER_CONTACT_EMAIL_REVIEW_REQUIRED'
            : '',
        review_reason:
          Boolean(email.sender_email) && !senderKnown
            ? 'Canonical supplier_id is exact, but the sender email is not listed in the supplier master. Retain the email as evidence and review the contact address before changing supplier identity data.'
            : '',
        candidates: []
      };
    }

    if (!email.sender_email) {
      return {
        status: 'UNRESOLVED',
        confidence: 0,
        basis: 'NONE',
        reason:
          'Supplier email requires an exact supplier_id or sender_email.',
        candidates: []
      };
    }

    const candidates = await this.findSupplierCandidatesByEmail(
      email.sender_email
    );

    if (candidates.length > 1) {
      return {
        status: 'AMBIGUOUS',
        confidence: 1,
        basis: 'EXACT_EMAIL',
        reason:
          'Exact sender email is listed against more than one supplier.',
        candidates: candidates.map((candidate) => ({
          supplier_id: candidate.supplier_id,
          supplier_name: candidate.supplier_name
        }))
      };
    }

    if (candidates.length === 0) {
      return {
        status: 'UNRESOLVED',
        confidence: 0,
        basis: 'NONE',
        reason:
          'Sender email is not an exact token in the canonical supplier master.',
        candidates: []
      };
    }

    const supplier = candidates[0].record;
    return {
      status: 'MATCHED',
      confidence: 1,
      basis: 'EXACT_EMAIL',
      entity: {
        type: 'Supplier',
        id: candidates[0].supplier_id
      },
      canonical_ids: {
        supplier_id: candidates[0].supplier_id
      },
      supplier,
      sender_email_known: true,
      review_required_after_capture: false,
      review_reason_code: '',
      review_reason: '',
      candidates: []
    };
  }
}

module.exports = {
  SupplierEmailResolver,
  normalizeEmail,
  emailTokens,
  supplierHasEmail
};
