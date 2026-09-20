'use strict';

const { EventProcessor } = require('./event-processor');
const { SupplierPriceResolver } = require('./supplier-price-resolver');
const {
  planSupplierPriceObservation
} = require('./supplier-price-planner');

function createSupplierPriceProcessor({ lookupService, now } = {}) {
  if (!lookupService) throw new Error('lookupService is required');

  const resolver = new SupplierPriceResolver({ lookupService });
  const base = new EventProcessor({
    resolver: (envelope) => resolver.resolve(envelope),
    planner: (envelope, match) =>
      planSupplierPriceObservation(envelope, match, { now })
  });

  return {
    async decide(envelope) {
      const decision = await base.decide(envelope);
      if (
        decision.decision === 'AUTO_WRITE' &&
        decision.match?.review_required_after_capture
      ) {
        return {
          ...decision,
          post_commit_review: {
            required: true,
            reason_code: 'SUPPLIER_PART_OR_PRICE_REVIEW_REQUIRED',
            reason: decision.match.review_reason,
            source_line_id:
              envelope?.payload?.supplier_price_observation?.line?.source_line_id ||
              ''
          }
        };
      }
      return decision;
    }
  };
}

module.exports = {
  createSupplierPriceProcessor
};
