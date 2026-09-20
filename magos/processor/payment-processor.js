'use strict';

const { EventProcessor } = require('./event-processor');
const { PaymentResolver } = require('./payment-resolver');
const { planPaymentObservation } = require('./payment-planner');

function createPaymentProcessor({ lookupService, now } = {}) {
  if (!lookupService) throw new Error('lookupService is required');

  const resolver = new PaymentResolver({ lookupService });

  return new EventProcessor({
    duplicateChecker: async (eventKey, envelope) => {
      const existingByKey =
        await lookupService.findPaymentEventByIdempotencyKey(eventKey);
      if (existingByKey) return true;

      const providerId =
        envelope?.payload?.payment?.provider_transaction_id || '';
      if (!providerId) return false;

      return Boolean(
        await lookupService.findPaymentEventByProviderTransactionId(providerId)
      );
    },
    resolver: (envelope) => resolver.resolve(envelope),
    planner: (envelope, match) =>
      planPaymentObservation(envelope, match, { now })
  });
}

module.exports = {
  createPaymentProcessor
};
