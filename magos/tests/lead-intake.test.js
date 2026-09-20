'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createLeadSubmittedEvent
} = require('../processor/lead-observation');
const {
  LeadResolver
} = require('../processor/lead-resolver');
const {
  planLeadSubmitted,
  deterministicLeadIds
} = require('../processor/lead-planner');
const {
  createLeadProcessor
} = require('../processor/lead-processor');

function event(leadOverrides = {}, topOverrides = {}) {
  return createLeadSubmittedEvent({
    source: 'WEBSITE',
    source_event_id: 'WEBFORM-1001',
    evidence: [{
      type: 'WEBSITE_SUBMISSION',
      ref: 'https://myriadgreen.co.za/evidence/test-lead-1001'
    }],
    lead: {
      contact_name: 'Test Client',
      contact_phone: '+27 82 555 0101',
      contact_email: 'test.client@example.com',
      property_or_suburb: 'Pretoria East',
      suburb_area: 'Pretoria East',
      municipality: 'City of Tshwane',
      province: 'Gauteng',
      service_region: 'Pretoria East / Gauteng',
      service_category: 'Irrigation installation',
      service_detail: 'New automated irrigation system',
      issue_summary: 'New installation enquiry',
      source_type: 'WEBSITE_FORM',
      acquisition_source: 'WEBSITE',
      first_contact_channel: 'WEBSITE_FORM',
      record_origin: 'WEBSITE',
      ...leadOverrides
    },
    ...topOverrides
  }, {
    receivedAt: new Date('2026-09-20T10:00:00Z')
  });
}

function baseLookup(overrides = {}) {
  return {
    leadResolverDependencies() {
      return {
        findIntakeBySourceEvent:
          overrides.findIntakeBySourceEvent ||
          (async () => null),
        findCrmCandidatesByIdentity:
          overrides.findCrmCandidatesByIdentity ||
          (async () => []),
        findEntityByCanonicalId:
          overrides.findEntityByCanonicalId ||
          (async () => null)
      };
    }
  };
}

test('brand-new identified lead with service creates intake, client/contact row and first opportunity', async () => {
  const env = event();
  const processor = createLeadProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  });

  const decision = await processor.decide(env);
  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.post_commit_review, undefined);
  assert.equal(decision.match.status, 'CREATE_ALLOWED');
  assert.equal(decision.match.create_client_allowed, true);
  assert.equal(decision.match.create_opportunity_allowed, true);

  const sheets = decision.transaction_plan.writes.map(x => x.sheet);
  assert.deepEqual(sheets, [
    'Intake_Queue',
    'CRM_Master',
    'Jobs_Opportunities'
  ]);
  assert.equal(sheets.includes('Client_Sites'), false);

  const client = decision.transaction_plan.writes
    .find(x => x.sheet === 'CRM_Master').values;
  const opportunity = decision.transaction_plan.writes
    .find(x => x.sheet === 'Jobs_Opportunities').values;

  assert.match(client.crm_id, /^CRM-2026-A[A-F0-9]{12}$/);
  assert.match(client.contact_id, /^CON-2026-A[A-F0-9]{12}$/);
  assert.match(opportunity.opportunity_id, /^OPP-20260920-A[A-F0-9]{12}$/);
  assert.equal(opportunity.client_crm_id, client.crm_id);
  assert.equal(opportunity.contact_id, client.contact_id);
  assert.equal(client.property_id, '');
  assert.equal(opportunity.property_id, '');
  assert.equal(opportunity.job_id, '');
  assert.equal(opportunity.job_status, 'NO_JOB');
  assert.equal(opportunity.payment_status, 'NOT_APPLICABLE');
});

test('same source event produces stable deterministic IDs while different source event changes them', () => {
  const first = event();
  const replay = event();
  const other = event({}, { source_event_id: 'WEBFORM-1002' });

  assert.deepEqual(
    deterministicLeadIds(first),
    deterministicLeadIds(replay)
  );
  assert.notDeepEqual(
    deterministicLeadIds(first),
    deterministicLeadIds(other)
  );
});

test('duplicate source event is ignored before planning', async () => {
  const env = event();
  const processor = createLeadProcessor({
    lookupService: baseLookup({
      findIntakeBySourceEvent: async () => ({
        intake_id: 'INT-EXISTING',
        source_system: 'WEBSITE',
        source_event_id: 'WEBFORM-1001'
      })
    })
  });

  const decision = await processor.decide(env);
  assert.equal(decision.decision, 'IGNORE');
  assert.equal(decision.reason_code, 'DUPLICATE_EVENT');
  assert.equal(decision.transaction_plan, undefined);
});

test('name-only lead records intake only and opens follow-up review; name never creates CRM identity', async () => {
  const env = event({
    contact_phone: '',
    contact_email: '',
    service_category: 'Irrigation installation'
  });

  const decision = await createLeadProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.match.create_client_allowed, false);
  assert.equal(decision.match.create_opportunity_allowed, false);
  assert.equal(decision.post_commit_review.required, true);
  assert.equal(
    decision.post_commit_review.reason_code,
    'LEAD_IDENTITY_REVIEW_REQUIRED'
  );
  assert.deepEqual(
    decision.transaction_plan.writes.map(x => x.sheet),
    ['Intake_Queue']
  );

  const intake = decision.transaction_plan.writes[0].values;
  assert.equal(intake.match_status, 'DATA_GAP');
  assert.equal(intake.processing_status, 'REVIEW_REQUIRED');
  assert.equal(intake.matched_crm_id, '');
  assert.equal(intake.matched_opportunity_id, '');
});

test('identity without service creates client/contact but no opportunity and opens follow-up review', async () => {
  const env = event({ service_category: '' });

  const decision = await createLeadProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.match.create_client_allowed, true);
  assert.equal(decision.match.create_opportunity_allowed, false);
  assert.equal(
    decision.post_commit_review.reason_code,
    'LEAD_SERVICE_REVIEW_REQUIRED'
  );
  assert.deepEqual(
    decision.transaction_plan.writes.map(x => x.sheet),
    ['Intake_Queue', 'CRM_Master']
  );

  const client = decision.transaction_plan.writes
    .find(x => x.sheet === 'CRM_Master').values;
  assert.equal(client.opportunity_id, '');
  assert.equal(client.opportunity_stage, 'TO_CONFIRM');
});

test('exact existing client plus exact opportunity links intake only', async () => {
  const env = event({
    opportunity_id: 'OPP-EXISTING-1'
  });

  const existingClient = {
    crm_id: 'CRM-EXISTING-1',
    contact_id: 'CON-EXISTING-1',
    phone: '+27 82 555 0101'
  };
  const existingOpportunity = {
    opportunity_id: 'OPP-EXISTING-1',
    client_crm_id: 'CRM-EXISTING-1',
    contact_id: 'CON-EXISTING-1'
  };

  const decision = await createLeadProcessor({
    lookupService: baseLookup({
      findCrmCandidatesByIdentity: async () => [{
        crm_id: existingClient.crm_id,
        contact_id: existingClient.contact_id,
        matched_by: ['PHONE:phone'],
        record: existingClient
      }],
      findEntityByCanonicalId: async (type, id) => {
        if (type === 'Opportunity' && id === 'OPP-EXISTING-1') {
          return existingOpportunity;
        }
        return null;
      }
    }),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(decision.post_commit_review, undefined);
  assert.equal(decision.match.basis, 'EXACT_PHONE');
  assert.deepEqual(
    decision.transaction_plan.writes.map(x => x.sheet),
    ['Intake_Queue']
  );

  const intake = decision.transaction_plan.writes[0].values;
  assert.equal(intake.matched_crm_id, 'CRM-EXISTING-1');
  assert.equal(intake.matched_opportunity_id, 'OPP-EXISTING-1');
  assert.equal(intake.routing_action, 'LINK_EXISTING');
  assert.equal(intake.processing_status, 'LINKED');
});

test('exact existing client without exact opportunity captures intake and requires opportunity review', async () => {
  const existingClient = {
    crm_id: 'CRM-EXISTING-1',
    contact_id: 'CON-EXISTING-1'
  };

  const decision = await createLeadProcessor({
    lookupService: baseLookup({
      findCrmCandidatesByIdentity: async () => [{
        crm_id: existingClient.crm_id,
        contact_id: existingClient.contact_id,
        matched_by: ['EMAIL:email'],
        record: existingClient
      }]
    }),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(event());

  assert.equal(decision.decision, 'AUTO_WRITE');
  assert.equal(
    decision.post_commit_review.reason_code,
    'EXISTING_CLIENT_OPPORTUNITY_REVIEW_REQUIRED'
  );
  assert.deepEqual(
    decision.transaction_plan.writes.map(x => x.sheet),
    ['Intake_Queue']
  );
  assert.equal(
    decision.transaction_plan.writes[0].values.routing_action,
    'REVIEW_OPPORTUNITY'
  );
});

test('exact phone/email evidence pointing to different CRM clients is ambiguous and no plan is compiled', async () => {
  const decision = await createLeadProcessor({
    lookupService: baseLookup({
      findCrmCandidatesByIdentity: async () => [
        {
          crm_id: 'CRM-A',
          contact_id: 'CON-A',
          matched_by: ['PHONE:phone'],
          record: { crm_id: 'CRM-A', contact_id: 'CON-A' }
        },
        {
          crm_id: 'CRM-B',
          contact_id: 'CON-B',
          matched_by: ['EMAIL:email'],
          record: { crm_id: 'CRM-B', contact_id: 'CON-B' }
        }
      ]
    })
  }).decide(event());

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'AMBIGUOUS_MATCH');
  assert.equal(decision.transaction_plan, undefined);
});

test('supplied opportunity belonging to another CRM client fails closed', async () => {
  const env = event({
    crm_id: 'CRM-A',
    contact_id: 'CON-A',
    opportunity_id: 'OPP-B'
  });

  const decision = await createLeadProcessor({
    lookupService: baseLookup({
      findEntityByCanonicalId: async (type, id) => {
        if (type === 'Client' && id === 'CRM-A') {
          return {
            crm_id: 'CRM-A',
            contact_id: 'CON-A'
          };
        }
        if (type === 'Opportunity' && id === 'OPP-B') {
          return {
            opportunity_id: 'OPP-B',
            client_crm_id: 'CRM-B'
          };
        }
        return null;
      }
    })
  }).decide(env);

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'CONFLICTING_MATCH');
  assert.equal(decision.transaction_plan, undefined);
});

test('same source_event_id under another source system fails closed instead of duplicate no-op', async () => {
  const decision = await createLeadProcessor({
    lookupService: baseLookup({
      findIntakeBySourceEvent: async () => ({
        intake_id: 'INT-OTHER',
        source_system: 'WHATSAPP',
        source_event_id: 'WEBFORM-1001',
        __source_system_mismatch: true
      })
    })
  }).decide(event());

  assert.equal(decision.decision, 'REVIEW_REQUIRED');
  assert.equal(decision.reason_code, 'CONFLICTING_MATCH');
});

test('do-not-contact is written only when explicitly true; unknown remains blank', async () => {
  const unknownEnv = event({ do_not_contact: undefined });
  const trueEnv = event(
    {
      do_not_contact: true,
      opt_out_reason: 'Explicit request'
    },
    { source_event_id: 'WEBFORM-1003' }
  );

  const resolver = new LeadResolver({
    findIntakeBySourceEvent: async () => null,
    findCrmCandidatesByIdentity: async () => []
  });

  const unknownMatch = await resolver.resolve(unknownEnv);
  const unknownPlan = planLeadSubmitted(unknownEnv, unknownMatch, {
    now: () => new Date('2026-09-20T10:01:00Z')
  });
  const unknownClient = unknownPlan.writes
    .find(x => x.sheet === 'CRM_Master').values;
  assert.equal(unknownClient.do_not_contact, '');
  assert.equal(unknownClient.opt_out_reason, '');

  const trueMatch = await resolver.resolve(trueEnv);
  const truePlan = planLeadSubmitted(trueEnv, trueMatch, {
    now: () => new Date('2026-09-20T10:01:00Z')
  });
  const trueClient = truePlan.writes
    .find(x => x.sheet === 'CRM_Master').values;
  assert.equal(trueClient.do_not_contact, 'YES');
  assert.equal(trueClient.opt_out_reason, 'Explicit request');
});

test('address/property text is retained as context but never creates a Client_Sites mutation', async () => {
  const env = event({
    property_or_suburb: '123 Test Street, Pretoria East'
  });

  const decision = await createLeadProcessor({
    lookupService: baseLookup(),
    now: () => new Date('2026-09-20T10:01:00Z')
  }).decide(env);

  assert.equal(
    decision.transaction_plan.writes.some(x => x.sheet === 'Client_Sites'),
    false
  );

  const client = decision.transaction_plan.writes
    .find(x => x.sheet === 'CRM_Master').values;
  const opportunity = decision.transaction_plan.writes
    .find(x => x.sheet === 'Jobs_Opportunities').values;

  assert.equal(client.address, '123 Test Street, Pretoria East');
  assert.equal(client.property_id, '');
  assert.equal(opportunity.site_address, '123 Test Street, Pretoria East');
  assert.equal(opportunity.property_id, '');
});
