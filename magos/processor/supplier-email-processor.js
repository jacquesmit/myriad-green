'use strict';

const { EventProcessor } = require('./event-processor');
const {
  SupplierEmailResolver
} = require('./supplier-email-resolver');
const {
  planSupplierEmail,
  reviewState
} = require('./supplier-email-planner');

function createSupplierEmailProcessor({ lookupService, now } = {}) {
  if (!lookupService) throw new Error('lookupService is required');

  const deps = lookupService.supplierEmailResolverDependencies();
  const resolver = new SupplierEmailResolver(deps);

  const base = new EventProcessor({
    duplicateChecker: async (eventKey, envelope) => {
      const existing = await deps.findIntakeBySourceEvent(
        envelope.source,
        envelope.source_event_id
      );
      return Boolean(
        existing &&
        !existing.__source_system_mismatch
      );
    },
    resolver: (envelope) => resolver.resolve(envelope),
    planner: (envelope, match) =>
      planSupplierEmail(envelope, match, { now })
  });

  return {
    async decide(envelope) {
      const decision = await base.decide(envelope);
      if (decision.decision !== 'AUTO_WRITE') return decision;

      const email = envelope?.payload?.supplier_email || {};
      const review = reviewState(email, decision.match || {});
      if (!review.required) return decision;

      return {
        ...decision,
        post_commit_review: {
          required: true,
          reason_code: review.reason_code,
          reason: review.reason,
          supplier_id:
            decision.match?.canonical_ids?.supplier_id || '',
          attachment_route_ready:
            review.attachment?.route_ready === true
        }
      };
    }
  };
}

module.exports = {
  createSupplierEmailProcessor
};
