'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GovernedProcessorRegistry,
  UnsupportedGovernedEventTypeError,
  SUPPORTED_EVENT_TYPES
} = require('../processor/processor-registry');

function lookupService() {
  return {
    zeroAResolverDependencies() {
      return {
        findEvidenceByDriveFileId: async () => null,
        findEntityByCanonicalId: async () => null,
        findByDocumentNumber: async () => []
      };
    },
    async findPaymentEventByIdempotencyKey() { return null; },
    async findPaymentEventByProviderTransactionId() { return null; },
    async findEntityByCanonicalId() { return null; },
    async findInvoiceByDocumentNo() { return null; },
    async findPaymentControlByQuoteNo() { return null; },
    async findSupplierQuoteByNumber() { return null; },
    async findSupplierSourceLineById() { return null; },
    async findSupplierPriceBySourceLineId() { return null; },
    async findProductBySupplierCode() { return null; },
    leadResolverDependencies() {
      return {
        findIntakeBySourceEvent: async () => null,
        findCrmCandidatesByIdentity: async () => [],
        findEntityByCanonicalId: async () => null
      };
    },
    supplierEmailResolverDependencies() {
      return {
        findIntakeBySourceEvent: async () => null,
        findEntityByCanonicalId: async () => null,
        findSupplierCandidatesByEmail: async () => []
      };
    }
  };
}

function writer() {
  return {
    audit: {},
    async execute() {
      return { state: 'COMMITTED' };
    }
  };
}

test('registry exposes only explicitly governed event types', () => {
  const registry = new GovernedProcessorRegistry({
    lookupService: lookupService(),
    writer: writer()
  });

  assert.deepEqual(
    registry.supportedEventTypes().sort(),
    [...SUPPORTED_EVENT_TYPES].sort()
  );
  assert.equal(registry.supports('DOCUMENT_RECEIVED'), true);
  assert.equal(registry.supports('DOCUMENT_FILED'), true);
  assert.equal(registry.supports('PAYMENT_OBSERVED'), true);
  assert.equal(registry.supports('SUPPLIER_PRICE_OBSERVED'), true);
  assert.equal(registry.supports('LEAD_SUBMITTED'), true);
  assert.equal(registry.supports('SUPPLIER_EMAIL_RECEIVED'), true);
});

test('unregistered event type throws hard unsupported error with no generic fallback', () => {
  const registry = new GovernedProcessorRegistry({
    lookupService: lookupService(),
    writer: writer()
  });

  assert.throws(
    () => registry.processorFor('MESSAGE_RECEIVED'),
    (error) =>
      error instanceof UnsupportedGovernedEventTypeError &&
      error.code === 'UNSUPPORTED_GOVERNED_EVENT_TYPE'
  );
});

test('registered event types resolve their specific processor factory', () => {
  const registry = new GovernedProcessorRegistry({
    lookupService: lookupService(),
    writer: writer()
  });

  for (const type of SUPPORTED_EVENT_TYPES) {
    const processor = registry.processorFor(type);
    assert.equal(typeof processor.decide, 'function', type);
  }
});

test('runner requires writer audit ledger so observability cannot be bypassed', () => {
  const registry = new GovernedProcessorRegistry({
    lookupService: lookupService(),
    writer: {
      async execute() {
        return { state: 'COMMITTED' };
      }
    }
  });

  assert.throws(
    () => registry.runnerFor('PAYMENT_OBSERVED'),
    /must expose audit ledger/
  );
});
