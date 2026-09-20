'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSupplierEmailReceivedEvent
} = require('../processor/supplier-email-observation');
const {
  SupplierEmailResolver,
  emailTokens,
  supplierHasEmail
} = require('../processor/supplier-email-resolver');
const {
  planSupplierEmail,
  deterministicIntakeId
} = require('../processor/supplier-email-planner');
const {
  createSupplierEmailProcessor
} = require('../processor/supplier-email-processor');

function event(emailOverrides = {}, topOverrides = {}) {
  return createSupplierEmailReceivedEvent({
    source: 'GMAIL',
    source_event_id: 'GMAIL-MSG-1001',
    evidence: [{
      type: 'GMAIL_MESSAGE',
      ref: 'https://mail.google.com/mail/#all/GMAIL-MSG-1001'
    }],
    email: {
      source_thread_id: 'GMAIL-THREAD-1',
      sender_name: 'Ruan',
      sender_email: 'ruan@waterspot.co.za',
      recipient_email: 'irrigationsa@gmail.com',
      subject: 'Eco multislim quote',
      message_summary: 'Supplier sent updated tank quote.',
      business_document_type: 'SUPPLIER_QUOTE',
      attachment_filenames: ['eco-multislim-quote.pdf'],
      attachment_refs: ['gmail-attachment://eco-multislim-quote.pdf'],
      attachment_accessibility: 'ACCESSIBLE',
      ...emailOverrides
    },
    ...topOverrides
  }, {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });
}

function supplier(overrides = {}) {
  return {
    supplier_id: 'SUP-WATERSPOT-CENTURION',
    supplier_name: 'Water Spot',
    email: 'centurion@waterspot.co.za; ruan@waterspot.co.za',
    supplier_approval_state: 'APPROVED',
    active_status: 'ACTIVE',
    ...overrides
  };
}

function baseLookup(overrides = {}) {
  return {
    supplierEmailResolverDependencies() {
      return {
        findIntakeBySourceEvent:
          overrides.findIntakeBySourceEvent ||
          (async () => null),
        findEntityByCanonicalId:
          overrides.findEntityByCanonicalId ||
          (async (type, id) =>
            type === 'Supplier' &&
            id === 'SUP-WATERSPOT-CENTURION'
              ? supplier()
              : null),
        findSupplierCandidatesByEmail:
          overrides.findSupplierCandidatesByEmail ||
          (async (email) =>
            email === 'ruan@waterspot.co.za'
              ? [{
                  supplier_id: 'SUP-WATERSPOT-CENTURION',
                  supplier_name: 'Water Spot',
                  record: supplier()
                }]
              : [])
      };
    }
  };
}

test('exact sender email links supplier and creates Intake_Queue only', async () => {
  const env = event();
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.match.basis, 'EXACT_EMAIL');
  assert.equal(
    decision.match.canonical_ids.supplier_id,
    'SUP-WATERSPOT-CENTURION'
  );
  assert.equal(decision.post_commit_review, undefined);

  assert.deepEqual(
    decision.transaction_plan.writes.map(x => x.sheet),
    ['Intake_Queue']
  );

  const intake = decision.transaction_plan.writes[0].values;
  assert.equal(intake.supplier_id, 'SUP-WATERSPOT-CENTURION');
  assert.equal(intake.business_document_type, 'SUPPLIER_QUOTE');
  assert.equal(intake.routing_action, 'ROUTE_DOCUMENT_EXTRACTION');
  assert.equal(intake.processing_status, 'LINKED');
  assert.equal(
    decision.transaction_plan.writes.some(
      x => x.sheet === 'Supplier_Quotes' || x.sheet === 'Supplier_Prices'
    ),
    false
  );
});

test('explicit canonical supplier ID with known sender is accepted exactly', async () => {
  const env = event({
    supplier_id: 'SUP-WATERSPOT-CENTURION'
  });
  const resolver = new SupplierEmailResolver(
    baseLookup().supplierEmailResolverDependencies()
  );

  const match = await resolver.resolve(env);
  assert.equal(match.status, 'MATCHED');
  assert.equal(match.basis, 'EXACT_ID');
  assert.equal(match.sender_email_known, true);
  assert.equal(match.review_required_after_capture, false);
});

test('explicit supplier ID with unfamiliar sender records evidence but opens contact review', async () => {
  const env = event({
    supplier_id: 'SUP-WATERSPOT-CENTURION',
    sender_email: 'newrep@waterspot.co.za'
  });

  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.match.basis, 'EXACT_ID');
  assert.equal(decision.post_commit_review.required, true);
  assert.equal(
    decision.post_commit_review.reason_code,
    'SUPPLIER_CONTACT_EMAIL_REVIEW_REQUIRED'
  );
  assert.deepEqual(
    decision.transaction_plan.writes.map(x => x.sheet),
    ['Intake_Queue']
  );
  assert.equal(
    decision.transaction_plan.writes[0].values.processing_status,
    'REVIEW_REQUIRED'
  );
});

test('unknown sender email routes to review before any Intake mutation', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup({
      findSupplierCandidatesByEmail: async () => []
    })
  }).decide(event({
    sender_email: 'unknown@waterspot.co.za'
  }));

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'NO_DETERMINISTIC_MATCH');
  assert.equal(decision.transaction_plan, undefined);
});

test('same supplier domain without exact email token is not a supplier match', async () => {
  const env = event({
    sender_email: 'someone-else@waterspot.co.za'
  });
  const resolver = new SupplierEmailResolver({
    findIntakeBySourceEvent: async () => null,
    findSupplierCandidatesByEmail: async () => []
  });

  const match = await resolver.resolve(env);
  assert.equal(match.status, 'UNRESOLVED');
  assert.match(match.reason, /exact token/);
});

test('ambiguous exact supplier email routes to review', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup({
      findSupplierCandidatesByEmail: async () => [
        {
          supplier_id: 'SUP-A',
          supplier_name: 'Supplier A',
          record: supplier({ supplier_id: 'SUP-A' })
        },
        {
          supplier_id: 'SUP-B',
          supplier_name: 'Supplier B',
          record: supplier({ supplier_id: 'SUP-B' })
        }
      ]
    })
  }).decide(event());

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'AMBIGUOUS_MATCH');
});

test('duplicate source event is ignored before resolution/planning', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup({
      findIntakeBySourceEvent: async () => ({
        intake_id: 'INT-EXISTING',
        source_system: 'GMAIL',
        source_event_id: 'GMAIL-MSG-1001'
      })
    })
  }).decide(event());

  assert.equal(decision.decision, 'IGNORE');
  assert.equal(decision.reason_code, 'DUPLICATE_EVENT');
  assert.equal(decision.transaction_plan, undefined);
});

test('source_event_id collision under another source system fails closed', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup({
      findIntakeBySourceEvent: async () => ({
        intake_id: 'INT-OTHER',
        source_system: 'WHATSAPP',
        source_event_id: 'GMAIL-MSG-1001',
        __source_system_mismatch: true
      })
    })
  }).decide(event());

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'CONFLICTING_MATCH');
});

test('explicit review flag creates post-commit review without expanding business writes', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(event({
    requires_review: true,
    review_reason: 'Commercial terms need owner review.'
  }));

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.post_commit_review.required, true);
  assert.equal(
    decision.post_commit_review.reason_code,
    'SUPPLIER_EMAIL_REVIEW_REQUIRED'
  );
  assert.deepEqual(
    decision.transaction_plan.writes.map(x => x.sheet),
    ['Intake_Queue']
  );
});

test('deterministic supplier-email intake ID is stable per source event', () => {
  const first = event();
  const replay = event();
  const other = event({}, { source_event_id: 'GMAIL-MSG-1002' });

  assert.equal(
    deterministicIntakeId(first),
    deterministicIntakeId(replay)
  );
  assert.notEqual(
    deterministicIntakeId(first),
    deterministicIntakeId(other)
  );
});

test('supplier email token helpers require exact individual address tokens', () => {
  const row = supplier();
  assert.deepEqual(emailTokens(row.email), [
    'centurion@waterspot.co.za',
    'ruan@waterspot.co.za'
  ]);
  assert.equal(supplierHasEmail(row, 'Ruan@WaterSpot.co.za'), true);
  assert.equal(supplierHasEmail(row, 'other@waterspot.co.za'), false);
});

test('planner preserves attachment evidence as linkage only', async () => {
  const env = event();
  const resolver = new SupplierEmailResolver(
    baseLookup().supplierEmailResolverDependencies()
  );
  const match = await resolver.resolve(env);

  const plan = planSupplierEmail(env, match, {
    now: () => new Date('2026-09-20T10:01:00Z')
  });
  const values = plan.writes[0].values;

  assert.equal(
    values.attachment_filenames,
    'eco-multislim-quote.pdf'
  );
  assert.equal(
    values.attachment_refs,
    'gmail-attachment://eco-multislim-quote.pdf'
  );
  assert.equal(values.attachment_accessibility, 'ACCESSIBLE');
  assert.equal(values.routing_action, 'ROUTE_DOCUMENT_EXTRACTION');
  assert.equal(plan.writes.length, 1);
});
