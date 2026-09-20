'use strict';

const { ExactLookupService } = require('../adapters/exact-lookup-service');
const { EventProcessor } = require('./event-processor');
const { ZeroAResolver } = require('./resolve-00a-document');
const { planZeroADocument } = require('./plan-00a-document');
const { planDocumentFiled } = require('./00a-filing');
const { createPaymentProcessor } = require('./payment-processor');
const { createSupplierPriceProcessor } = require('./supplier-price-processor');
const { createLeadProcessor } = require('./lead-processor');
const { GovernedEventRunner } = require('./governed-event-runner');
const { EventObserver } = require('./event-observer');
const { ReviewManager } = require('./review-manager');
const { RetryController } = require('./retry-controller');

const SUPPORTED_EVENT_TYPES = Object.freeze([
  'DOCUMENT_RECEIVED',
  'DOCUMENT_FILED',
  'PAYMENT_OBSERVED',
  'SUPPLIER_PRICE_OBSERVED',
  'LEAD_SUBMITTED'
]);

class UnsupportedGovernedEventTypeError extends Error {
  constructor(eventType) {
    super('No governed processor is registered for event_type=' + String(eventType || ''));
    this.name = 'UnsupportedGovernedEventTypeError';
    this.code = 'UNSUPPORTED_GOVERNED_EVENT_TYPE';
    this.event_type = eventType || '';
  }
}

function createZeroAProcessor({
  lookupService,
  planner,
  now
}) {
  const resolver = new ZeroAResolver(
    lookupService.zeroAResolverDependencies()
  );

  return new EventProcessor({
    resolver: (envelope) => resolver.resolve(envelope),
    planner: (envelope, match) =>
      planner(envelope, match, { now })
  });
}

class GovernedProcessorRegistry {
  constructor({
    lookupService,
    writer,
    now
  } = {}) {
    if (!writer) throw new Error('writer is required');

    this.lookupService = lookupService || new ExactLookupService();
    this.writer = writer;
    this.now = now;

    this.factories = new Map([
      [
        'DOCUMENT_RECEIVED',
        () => createZeroAProcessor({
          lookupService: this.lookupService,
          planner: planZeroADocument,
          now: this.now
        })
      ],
      [
        'DOCUMENT_FILED',
        () => createZeroAProcessor({
          lookupService: this.lookupService,
          planner: planDocumentFiled,
          now: this.now
        })
      ],
      [
        'PAYMENT_OBSERVED',
        () => createPaymentProcessor({
          lookupService: this.lookupService,
          now: this.now
        })
      ],
      [
        'SUPPLIER_PRICE_OBSERVED',
        () => createSupplierPriceProcessor({
          lookupService: this.lookupService,
          now: this.now
        })
      ],
      [
        'LEAD_SUBMITTED',
        () => createLeadProcessor({
          lookupService: this.lookupService,
          now: this.now
        })
      ]
    ]);
  }

  supportedEventTypes() {
    return [...this.factories.keys()];
  }

  supports(eventType) {
    return this.factories.has(String(eventType || ''));
  }

  processorFor(eventType) {
    const factory = this.factories.get(String(eventType || ''));
    if (!factory) throw new UnsupportedGovernedEventTypeError(eventType);
    return factory();
  }

  runnerFor(eventType) {
    const processor = this.processorFor(eventType);
    const ledger = this.writer.audit;
    if (!ledger) {
      throw new Error('Governed runtime writer must expose audit ledger');
    }

    const observer = new EventObserver({ ledger });
    return new GovernedEventRunner({
      processor,
      writer: this.writer,
      observer,
      reviewManager: new ReviewManager({ ledger }),
      retryController: new RetryController({ ledger })
    });
  }

  async run(envelope) {
    const eventType = envelope?.event_type || '';
    return this.runnerFor(eventType).run(envelope);
  }
}

module.exports = {
  GovernedProcessorRegistry,
  UnsupportedGovernedEventTypeError,
  SUPPORTED_EVENT_TYPES,
  createZeroAProcessor
};
