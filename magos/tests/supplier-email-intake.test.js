'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSupplierEmailReceivedEvent
} = require('../processor/supplier-email-observation');
const {
  SupplierEmailResolver
} = require('../processor/supplier-email-resolver');
const {
  planSupplierEmail,
  deterministicIntakeId
} = require('../processor/supplier-email-planner');
const {
  createSupplierEmailProcessor
} = require('../processor/supplier-email-processor');

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

function safeGuards() {
  return {
    spam: 'CLEAR',
    phishing: 'CLEAR',
    explicit_content: 'CLEAR',
    malware: 'CLEAR',
    irrelevant: 'CLEAR'
  };
}

function safeAttestation() {
  return {
    provider: 'TEST_EMAIL_SCANNER',
    scan_id: 'SCAN-GMAIL-1001',
    scanned_at: '2026-09-20T09:59:00Z'
  };
}

function event(emailOverrides = {}, topOverrides = {}) {
  const base = {
    source: 'GMAIL',
    source_event_id: 'GMAIL-MSG-1001',
    evidence: [{
      type: 'GMAIL_MESSAGE',
      ref: 'gmail://message/GMAIL-MSG-1001'
    }],
    guards: safeGuards(),
    safety_attestation: safeAttestation(),
    email: {
      source_thread_id: 'GMAIL-THREAD-1',
      sender_name: 'Ruan',
      sender_email: 'ruan@waterspot.co.za',
      recipient_email: 'irrigationsa@gmail.com',
      subject: 'Eco multislim quote',
      message_summary: 'Supplier sent updated tank quote.',
      business_document_type: 'SUPPLIER_QUOTE',
      attachment_filenames: ['eco-multislim-quote.pdf'],
      attachment_refs: ['gmail-attachment://ATT-1'],
      attachment_accessibility: 'ACCESSIBLE',
      ...emailOverrides
    }
  };
  return createSupplierEmailReceivedEvent({
    ...base,
    ...topOverrides
  }, {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });
}

function baseLookup(overrides = {}) {
  const deps = {
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

  return {
    supplierEmailResolverDependencies() {
      return deps;
    }
  };
}

test('unscanned supplier email defaults to UNKNOWN guards and cannot auto-write', async () => {
  const env = createSupplierEmailReceivedEvent({
    source: 'GMAIL',
    source_event_id: 'GMAIL-MSG-UNKNOWN-GUARDS',
    evidence: [{
      type: 'GMAIL_MESSAGE',
      ref: 'gmail://message/GMAIL-MSG-UNKNOWN-GUARDS'
    }],
    email: {
      sender_email: 'ruan@waterspot.co.za',
      subject: 'Quote'
    }
  }, {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });

  assert.deepEqual(env.guards, {
    spam: 'UNKNOWN',
    phishing: 'UNKNOWN',
    explicit_content: 'UNKNOWN',
    malware: 'UNKNOWN',
    irrelevant: 'UNKNOWN'
  });

  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup()
  }).decide(env);

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.transaction_plan, undefined);
});

test('asserted supplier-email guard decisions require scan provenance', () => {
  assert.throws(
    () => createSupplierEmailReceivedEvent({
      source: 'GMAIL',
      source_event_id: 'GMAIL-MSG-NO-ATTEST',
      evidence: [{
        type: 'GMAIL_MESSAGE',
        ref: 'gmail://message/GMAIL-MSG-NO-ATTEST'
      }],
      guards: safeGuards(),
      email: {
        sender_email: 'ruan@waterspot.co.za'
      }
    }),
    error =>
      error.code === 'SUPPLIER_EMAIL_GUARD_ATTESTATION_REQUIRED'
  );
});

test('supplier email requires immutable source evidence', () => {
  assert.throws(
    () => createSupplierEmailReceivedEvent({
      source: 'GMAIL',
      source_event_id: 'GMAIL-MSG-NO-EVIDENCE',
      guards: safeGuards(),
      safety_attestation: safeAttestation(),
      email: {
        sender_email: 'ruan@waterspot.co.za'
      }
    }),
    error => error.code === 'SUPPLIER_EMAIL_EVIDENCE_REQUIRED'
  );
});

test('exact approved supplier email creates Intake_Queue only', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(event());

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.match.basis, 'EXACT_EMAIL');
  assert.equal(decision.post_commit_review, undefined);
  assert.deepEqual(
    decision.transaction_plan.writes.map(write => write.sheet),
    ['Intake_Queue']
  );

  const values = decision.transaction_plan.writes[0].values;
  assert.match(values.intake_id, /^INT-SUPMAIL-/);
  assert.equal(values.supplier_id, 'SUP-WATERSPOT-CENTURION');
  assert.equal(values.processing_status, 'LINKED');
  assert.equal(values.routing_action, 'ROUTE_DOCUMENT_EXTRACTION');
  assert.equal(values.attachment_accessibility, 'ACCESSIBLE');
});

test('explicit exact supplier ID with unfamiliar sender retains intake but opens review', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(event({
    supplier_id: 'SUP-WATERSPOT-CENTURION',
    sender_email: 'newrep@waterspot.co.za'
  }));

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.match.basis, 'EXACT_ID');
  assert.equal(decision.post_commit_review.required, true);
  assert.equal(
    decision.post_commit_review.reason_code,
    'SUPPLIER_CONTACT_EMAIL_REVIEW_REQUIRED'
  );
  assert.equal(
    decision.transaction_plan.writes[0].values.processing_status,
    'REVIEW_REQUIRED'
  );
});

test('inactive or excluded exact supplier retains evidence but blocks downstream handling', async () => {
  const lookup = baseLookup({
    findSupplierCandidatesByEmail: async () => [{
      supplier_id: 'SUP-WATERSPOT-CENTURION',
      supplier_name: 'Water Spot',
      record: supplier({
        supplier_approval_state: 'EXCLUDED',
        active_status: 'INACTIVE'
      })
    }]
  });

  const decision = await createSupplierEmailProcessor({
    lookupService: lookup,
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(event());

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.post_commit_review.required, true);
  assert.equal(
    decision.post_commit_review.reason_code,
    'SUPPLIER_STATUS_REVIEW_REQUIRED'
  );
  assert.equal(
    decision.transaction_plan.writes[0].values.processing_status,
    'REVIEW_REQUIRED'
  );
});

test('filename without retained attachment reference routes to review, not extraction', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(event({
    attachment_filenames: ['quote.pdf'],
    attachment_refs: [],
    attachment_accessibility: 'UNKNOWN'
  }));

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.post_commit_review.required, true);

  const values = decision.transaction_plan.writes[0].values;
  assert.equal(values.routing_action, 'REVIEW_ATTACHMENT_ACCESS');
  assert.equal(values.processing_status, 'REVIEW_REQUIRED');
  assert.match(values.review_reason, /no retrievable attachment reference/);
});

test('attachment reference that is not confirmed ACCESSIBLE routes to review', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(event({
    attachment_filenames: ['quote.pdf'],
    attachment_refs: ['gmail-attachment://ATT-X'],
    attachment_accessibility: 'INACCESSIBLE'
  }));

  const values = decision.transaction_plan.writes[0].values;
  assert.equal(values.routing_action, 'REVIEW_ATTACHMENT_ACCESS');
  assert.equal(values.processing_status, 'REVIEW_REQUIRED');
  assert.match(values.review_reason, /not confirmed as ACCESSIBLE/);
});

test('attachment filename/reference count mismatch routes to review', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup()
  }).decide(event({
    attachment_filenames: ['one.pdf', 'two.pdf'],
    attachment_refs: ['gmail-attachment://ATT-ONE'],
    attachment_accessibility: 'ACCESSIBLE'
  }));

  assert.equal(decision.post_commit_review.required, true);
  assert.equal(
    decision.transaction_plan.writes[0].values.routing_action,
    'REVIEW_ATTACHMENT_ACCESS'
  );
});

test('unknown supplier sender routes to review before Intake mutation', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup({
      findSupplierCandidatesByEmail: async () => []
    })
  }).decide(event({
    sender_email: 'unknown@example.co.za'
  }));

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'NO_DETERMINISTIC_MATCH');
  assert.equal(decision.transaction_plan, undefined);
});

test('ambiguous exact sender routes to review', async () => {
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

test('duplicate supplier email is ignored before planning', async () => {
  const decision = await createSupplierEmailProcessor({
    lookupService: baseLookup({
      findIntakeBySourceEvent: async () => ({
        intake_id: 'INT-SUPMAIL-EXISTING',
        source_system: 'GMAIL',
        source_event_id: 'GMAIL-MSG-1001'
      })
    })
  }).decide(event());

  assert.equal(decision.decision, 'IGNORE');
  assert.equal(decision.reason_code, 'DUPLICATE_EVENT');
  assert.equal(decision.transaction_plan, undefined);
});

test('source event collision under another source fails closed', async () => {
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

test('deterministic supplier-email intake ID is stable across replay', () => {
  const first = event();
  const replay = event();
  const other = event({}, {
    source_event_id: 'GMAIL-MSG-1002',
    evidence: [{
      type: 'GMAIL_MESSAGE',
      ref: 'gmail://message/GMAIL-MSG-1002'
    }]
  });

  assert.equal(
    deterministicIntakeId(first),
    deterministicIntakeId(replay)
  );
  assert.notEqual(
    deterministicIntakeId(first),
    deterministicIntakeId(other)
  );
});

test('planner never creates supplier/commercial mutations', async () => {
  const env = event();
  const resolver = new SupplierEmailResolver(
    baseLookup().supplierEmailResolverDependencies()
  );
  const match = await resolver.resolve(env);
  const plan = planSupplierEmail(env, match);

  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].store, 'crm');
  assert.equal(plan.writes[0].sheet, 'Intake_Queue');
  assert.equal(
    plan.writes.some(write =>
      ['Supplier_Quotes', 'Supplier_Prices', 'Purchase_Orders'].includes(write.sheet)
    ),
    false
  );
});
