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

function supplierStatusReview(supplier = {}) {
  const approval = String(
    supplier.supplier_approval_state || ''
  ).trim().toUpperCase();
  const active = String(
    supplier.active_status || ''
  ).trim().toUpperCase();

  if (approval === 'APPROVED' && active === 'ACTIVE') {
    return null;
  }

  return {
    reason_code: 'SUPPLIER_STATUS_REVIEW_REQUIRED',
    reason:
      'Supplier identity is exact, but automated downstream handling is blocked ' +
      'because the supplier is not both APPROVED and ACTIVE.',
    approval_state: approval,
    active_status: active
  };
}

function reviewSummary(supplier, senderKnown, senderEmail) {
  const reasons = [];
  const codes = [];

  const statusReview = supplierStatusReview(supplier);
  if (statusReview) {
    codes.push(statusReview.reason_code);
    reasons.push(statusReview.reason);
  }

  if (senderEmail && !senderKnown) {
    codes.push('SUPPLIER_CONTACT_EMAIL_REVIEW_REQUIRED');
    reasons.push(
      'Canonical supplier_id is exact, but the sender email is not listed ' +
      'in the supplier master. Retain the email as evidence and review the ' +
      'contact address before changing supplier identity data.'
    );
  }

  return {
    required: reasons.length > 0,
    reason_code:
      codes.length === 1
        ? codes[0]
        : (codes.length ? 'SUPPLIER_EMAIL_REVIEW_REQUIRED' : ''),
    reason: reasons.join(' '),
    reason_codes: codes
  };
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
      const review = reviewSummary(
        supplier,
        senderKnown,
        email.sender_email
      );

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
        review_required_after_capture: review.required,
        review_reason_code: review.reason_code,
        review_reason: review.reason,
        review_reason_codes: review.reason_codes,
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
        candidates: candidates.map(candidate => ({
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
    const review = reviewSummary(
      supplier,
      true,
      email.sender_email
    );

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
      review_required_after_capture: review.required,
      review_reason_code: review.reason_code,
      review_reason: review.reason,
      review_reason_codes: review.reason_codes,
      candidates: []
    };
  }
}

module.exports = {
  SupplierEmailResolver,
  normalizeEmail,
  emailTokens,
  supplierHasEmail,
  supplierStatusReview,
  reviewSummary
};
