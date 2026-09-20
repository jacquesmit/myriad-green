'use strict';

const { EventProcessor } = require('./event-processor');
const { LeadResolver } = require('./lead-resolver');
const { planLeadSubmitted } = require('./lead-planner');

function createLeadProcessor({ lookupService, now } = {}) {
  if (!lookupService) throw new Error('lookupService is required');

  const deps = lookupService.leadResolverDependencies();
  const resolver = new LeadResolver(deps);

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
      planLeadSubmitted(envelope, match, { now })
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
            reason_code:
              decision.match.review_reason_code ||
              'LEAD_FOLLOW_UP_REVIEW_REQUIRED',
            reason: decision.match.review_reason || '',
            crm_id: decision.match.canonical_ids?.crm_id || '',
            opportunity_id:
              decision.match.canonical_ids?.opportunity_id || ''
          }
        };
      }
      return decision;
    }
  };
}

module.exports = {
  createLeadProcessor
};
