'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSupplierPriceObservedEvent
} = require('../processor/supplier-price-observation');
const {
  SupplierPriceResolver
} = require('../processor/supplier-price-resolver');
const {
  planSupplierPriceObservation
} = require('../processor/supplier-price-planner');
const {
  createSupplierPriceProcessor
} = require('../processor/supplier-price-processor');

function event(lineOverrides = {}, quoteOverrides = {}) {
  return createSupplierPriceObservedEvent({
    source: 'GMAIL',
    source_event_id: 'MSG-1',
    source_thread_id: 'THREAD-1',
    evidence: [{ type: 'SUPPLIER_QUOTE', ref: 'gmail://MSG-1' }],
    quote: {
      supplier_id: 'SUP-AJ',
      supplier_quote_number: 'Q-100',
      quote_date: '2026-09-20',
      valid_until: '2026-10-20',
      currency: 'ZAR',
      vat_basis: 'VAT_15_PERCENT',
      source_document: 'Q-100.pdf',
      ...quoteOverrides
    },
    line: {
      source_line_no: 1,
      supplier_sku: 'SKU-1',
      source_description: 'Exact sourced item',
      quantity: 2,
      source_unit: 'EA',
      unit_price_ex_vat: 100,
      vat_rate: 0.15,
      line_total_ex_vat: 200,
      ...lineOverrides
    }
  }, {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });
}

function baseLookup(overrides = {}) {
  return {
    async findEntityByCanonicalId(type, id) {
      if (type === 'Supplier' && id === 'SUP-AJ') {
        return {
          supplier_id: 'SUP-AJ',
          supplier_approval_state: 'APPROVED',
          active_status: 'ACTIVE'
        };
      }
      if (type === 'Product' && id === 'PART-1') {
        return {
          part_id: 'PART-1',
          active_status: 'ACTIVE',
          preferred_supplier_id: 'SUP-AJ'
        };
      }
      return null;
    },
    async findSupplierQuoteByNumber() { return null; },
    async findSupplierSourceLineById() { return null; },
    async findSupplierPriceBySourceLineId() { return null; },
    async findProductBySupplierCode(supplierId, sku) {
      if (supplierId === 'SUP-AJ' && sku === 'SKU-1') {
        return {
          part_id: 'PART-1',
          supplier_code_primary: 'SKU-1',
          preferred_supplier_id: 'SUP-AJ',
          active_status: 'ACTIVE'
        };
      }
      return null;
    },
    ...overrides
  };
}

test('description-only source is captured but never promoted to Supplier_Prices', async () => {
  const env = event({
    supplier_sku: '',
    canonical_part_id: ''
  });
  const lookup = baseLookup({
    async findProductBySupplierCode() { return null; }
  });

  const decision = await createSupplierPriceProcessor({
    lookupService: lookup,
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.post_commit_review.required, true);
  assert.match(decision.post_commit_review.reason, /Description-only/);
  assert.equal(
    decision.transaction_plan.writes.some(x => x.sheet === 'Supplier_Prices'),
    false
  );

  const sourceWrite = decision.transaction_plan.writes
    .find(x => x.sheet === 'Supplier_Source_Lines');
  assert.equal(sourceWrite.values.processing_status, 'REVIEW_REQUIRED');
  assert.equal(sourceWrite.values.canonical_part_id, '');
});

test('exact canonical part promotes source line into one Supplier_Prices record', async () => {
  const env = event({
    canonical_part_id: 'PART-1'
  });
  const lookup = baseLookup();

  const resolver = new SupplierPriceResolver({ lookupService: lookup });
  const match = await resolver.resolve(env);
  assert.equal(match.price_promotion_allowed, true);
  assert.equal(match.part.part_id, 'PART-1');

  const plan = planSupplierPriceObservation(env, match, {
    now: () => new Date('2026-09-20T10:01:00Z')
  });

  assert.equal(plan.writes.length, 3);
  const price = plan.writes.find(x => x.sheet === 'Supplier_Prices');
  assert.ok(price);
  assert.equal(price.values.part_id, 'PART-1');
  assert.equal(price.values.unit_price_ex_vat, 100);
  assert.equal(price.values.unit_price_inc_vat, 115);
  assert.equal(price.values.line_value_inc_vat, 230);
  assert.equal(price.values.source_line_id, 'GMAIL|MSG-1|001');
  assert.equal(Object.hasOwn(price.values, 'quote_eligible'), false);
});

test('exact supplier SKU may resolve a canonical part only for that preferred supplier', async () => {
  const env = event({ canonical_part_id: '' });
  const resolver = new SupplierPriceResolver({
    lookupService: baseLookup()
  });

  const match = await resolver.resolve(env);
  assert.equal(match.part.part_id, 'PART-1');
  assert.equal(match.part_basis, 'EXACT_REFERENCE');
  assert.equal(match.price_promotion_allowed, true);
});

test('supplier SKU owned by another supplier does not promote price', async () => {
  const env = event({ canonical_part_id: '' });
  const lookup = baseLookup({
    async findProductBySupplierCode() {
      return {
        part_id: 'PART-X',
        preferred_supplier_id: 'SUP-OTHER',
        active_status: 'ACTIVE',
        __supplier_code_owner_mismatch: true
      };
    }
  });

  const match = await new SupplierPriceResolver({
    lookupService: lookup
  }).resolve(env);

  assert.equal(match.status, 'MATCHED');
  assert.equal(match.part, null);
  assert.equal(match.price_promotion_allowed, false);
  assert.match(match.review_reason, /another preferred supplier/);
});

test('non-approved supplier routes to review before any plan', async () => {
  const env = event();
  const lookup = baseLookup({
    async findEntityByCanonicalId(type, id) {
      if (type === 'Supplier') {
        return {
          supplier_id: id,
          supplier_approval_state: 'EXCLUDED',
          active_status: 'ACTIVE'
        };
      }
      return null;
    }
  });

  const decision = await createSupplierPriceProcessor({
    lookupService: lookup
  }).decide(env);

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'CONFLICTING_MATCH');
});

test('supplier quote number cannot silently cross suppliers', async () => {
  const env = event();
  const lookup = baseLookup({
    async findSupplierQuoteByNumber() {
      return {
        supplier_quote_id: 'SQT-OLD',
        supplier_id: 'SUP-OTHER',
        supplier_quote_number: 'Q-100'
      };
    }
  });

  const match = await new SupplierPriceResolver({
    lookupService: lookup
  }).resolve(env);

  assert.equal(match.status, 'CONFLICT');
  assert.match(match.reason, /different supplier/);
});

test('immutable source-line disagreement fails closed', async () => {
  const env = event();
  const lookup = baseLookup({
    async findSupplierSourceLineById() {
      return {
        source_line_id: 'GMAIL|MSG-1|001',
        supplier_id: 'SUP-AJ',
        supplier_quote_number: 'Q-100',
        source_line_no: '1',
        supplier_sku: 'SKU-1',
        source_description: 'DIFFERENT DESCRIPTION',
        quantity: '2',
        source_unit: 'EA',
        unit_price_ex_vat: '100',
        vat_rate: '0.15',
        line_total_ex_vat: '200',
        currency: 'ZAR'
      };
    }
  });

  const decision = await createSupplierPriceProcessor({
    lookupService: lookup
  }).decide(env);

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'CONFLICTING_MATCH');
});

test('existing exact quote is reused rather than duplicated', async () => {
  const env = event({ canonical_part_id: 'PART-1' });
  const lookup = baseLookup({
    async findSupplierQuoteByNumber() {
      return {
        supplier_quote_id: 'SQT-EXISTING',
        supplier_id: 'SUP-AJ',
        supplier_quote_number: 'Q-100'
      };
    }
  });

  const match = await new SupplierPriceResolver({
    lookupService: lookup
  }).resolve(env);
  const plan = planSupplierPriceObservation(env, match);

  assert.equal(
    plan.writes.some(x => x.sheet === 'Supplier_Quotes'),
    false
  );
  const price = plan.writes.find(x => x.sheet === 'Supplier_Prices');
  assert.equal(price.values.supplier_quote_id, 'SQT-EXISTING');
});

test('existing supplier price for same source line is not created again', async () => {
  const env = event({ canonical_part_id: 'PART-1' });
  const lookup = baseLookup({
    async findSupplierPriceBySourceLineId() {
      return {
        price_record_id: 'SPR-EXISTING',
        source_line_id: 'GMAIL|MSG-1|001',
        part_id: 'PART-1'
      };
    }
  });

  const match = await new SupplierPriceResolver({
    lookupService: lookup
  }).resolve(env);
  const plan = planSupplierPriceObservation(env, match);

  assert.equal(
    plan.writes.some(x => x.sheet === 'Supplier_Prices'),
    false
  );
});


test('missing VAT rate and unrecognized VAT basis blocks price promotion', async () => {
  const env = event({
    canonical_part_id: 'PART-1',
    vat_rate: null
  }, {
    vat_basis: ''
  });

  const decision = await createSupplierPriceProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.post_commit_review.required, true);
  assert.match(decision.post_commit_review.reason, /VAT-basis evidence/);
  assert.equal(
    decision.transaction_plan.writes.some(x => x.sheet === 'Supplier_Prices'),
    false
  );
});

test('recognized VAT basis may supply exact VAT rate when line rate is absent', async () => {
  const env = event({
    canonical_part_id: 'PART-1',
    vat_rate: null
  }, {
    vat_basis: 'VAT_15_PERCENT'
  });

  const match = await new SupplierPriceResolver({
    lookupService: baseLookup()
  }).resolve(env);
  assert.equal(match.price_promotion_allowed, true);

  const plan = planSupplierPriceObservation(env, match, {
    now: () => new Date('2026-09-20T10:01:00Z')
  });
  const price = plan.writes.find(x => x.sheet === 'Supplier_Prices');
  assert.equal(price.values.vat_rate, 0.15);
  assert.equal(price.values.unit_price_inc_vat, 115);
});
