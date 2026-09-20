'use strict';

const { EventProcessor } = require('./event-processor');
const {
  SupplierEmailResolver
} = require('./supplier-email-resolver');
const {
  planSupplierEmail
} = require('./supplier-email-planner');

function createSupplierEmailProcessor({ lookupService, now } = {}) {
  if (!lookupService) throw new Error('lookupService is required');

  const deps = lookupService.supplierEmailResolverDependencies();
  const resolver = new SupplierEmailResolver(deps);

  const base = new EventProcessor({
    duplicateChecker: async (eventKey, envelope) => {
      try {
        const existing = await deps.findIntakeBySourceEvent(
          envelope.source,
          envelope.source_event_id
        );
        return Boolean(
          existing &&
          !existing.__source_system_mismatch
        );
      } catch {
        return false;
      }
    },
    resolver: (envelope) => resolver.resolve(envelope),
    planner: (envelope, match) =>
      planSupplierEmail(envelope, match, { now })
  });

  return {
    async decide(envelope) {
      const decision = await base.decide(envelope);
      const email = envelope?.payload?.supplier_email || {};
      if (
        decision.decision === 'AUTO_WRITE' &&
        (
          decision.match?.review_required_after_capture ||
          email.requires_review
        )
      ) {
        return {
          ...decision,
          post_commit_review: {
            required: true,
            reason_code:
              decision.match?.review_reason_code ||
              'SUPPLIER_EMAIL_REVIEW_REQUIRED',
            reason: [
              decision.match?.review_reason || '',
              email.requires_review
                ? (email.review_reason || 'Supplier email requires explicit review.')
                : ''
            ].filter(Boolean).join(' '),
            supplier_id:
              decision.match?.canonical_ids?.supplier_id || ''
          }
        };
      }
      return decision;
    }
  };
}

module.exports = {
  createSupplierEmailProcessor
};
