'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createRuntimeApp } = require('../runtime/app');
const {
  UnsupportedGovernedEventTypeError
} = require('../processor/processor-registry');
const {
  createFluentLeadIngressPayload
} = require('../adapters/fluent-forms-lead');

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await fn('http://127.0.0.1:' + address.port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(base, path, {
  method = 'GET',
  token = '',
  ingressToken = '',
  body
} = {}) {
  const headers = {};
  if (token) headers.authorization = 'Bearer ' + token;
  if (ingressToken) headers['x-magos-ingress-token'] = ingressToken;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json();
  return { status: response.status, payload };
}

function samplePlan() {
  return {
    idempotency_key: 'TEST|P2|1',
    event_type: 'RUNTIME_TEST',
    source_event_id: 'SRC-1',
    preconditions: [],
    writes: [{
      operation: 'UPDATE_BY_KEY',
      store: 'crm',
      sheet: 'Jobs_Opportunities',
      key: { header: 'opportunity_id', value: 'OPP-1' },
      changes: { job_status: 'TO_CONFIRM' },
      authority: 'AUTHORITATIVE',
      entity_type: 'Job',
      workbook_role: 'CRM_MASTER'
    }]
  };
}

test('health and readiness expose no business data', async () => {
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({})
  });

  await withServer(app, async (base) => {
    const health = await request(base, '/healthz');
    assert.equal(health.status, 200);
    assert.equal(health.payload.status, 'ok');

    const ready = await request(base, '/readyz');
    assert.equal(ready.status, 200);
    assert.equal(ready.payload.status, 'ready');
  });
});

test('transaction endpoint rejects missing or incorrect bearer token', async () => {
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({
      execute: async () => ({ state: 'COMMITTED' })
    })
  });

  await withServer(app, async (base) => {
    const missing = await request(base, '/v1/transactions', {
      method: 'POST',
      body: samplePlan()
    });
    assert.equal(missing.status, 401);

    const wrong = await request(base, '/v1/transactions', {
      method: 'POST',
      token: 'wrong',
      body: samplePlan()
    });
    assert.equal(wrong.status, 401);
  });
});

test('authenticated transaction returns writer commit result', async () => {
  let received;
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({
      execute: async (plan) => {
        received = plan;
        return { state: 'COMMITTED', transaction_id: 'TXN-1' };
      }
    })
  });

  await withServer(app, async (base) => {
    const plan = samplePlan();
    const result = await request(base, '/v1/transactions', {
      method: 'POST',
      token: 'secret-token',
      body: plan
    });
    assert.equal(result.status, 200);
    assert.equal(result.payload.state, 'COMMITTED');
    assert.equal(received.idempotency_key, plan.idempotency_key);
  });
});

test('retryable writer result is surfaced as HTTP 409', async () => {
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({
      execute: async () => ({ state: 'RETRY_REQUIRED', error: 'PRECONDITION_FAILED' })
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/transactions', {
      method: 'POST',
      token: 'secret-token',
      body: samplePlan()
    });
    assert.equal(result.status, 409);
    assert.equal(result.payload.state, 'RETRY_REQUIRED');
  });
});

test('credential probe calls the live audit adapter boundary', async () => {
  let probed = false;
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({
      audit: {
        getHeaders: async (sheet) => {
          probed = sheet === 'Automation_Run_Log';
          return { headers: ['run_log_id'] };
        }
      }
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/probes/google-sheets', {
      method: 'POST',
      token: 'secret-token',
      body: {}
    });
    assert.equal(result.status, 200);
    assert.equal(result.payload.google_sheets, 'reachable');
    assert.equal(probed, true);
  });
});


function sampleEvent() {
  return {
    schema_version: 'MAGOS-EVENT-ENVELOPE/V1',
    event_id: 'EVT-RUNTIME-1',
    source: 'TEST',
    source_event_id: 'SRC-EVT-1',
    event_type: 'PAYMENT_OBSERVED',
    occurred_at: '2026-09-20T10:00:00.000Z',
    received_at: '2026-09-20T10:00:01.000Z',
    idempotency_key: 'MAGOS_EVENT_V1|RUNTIME',
    actor: null,
    entity_hints: {},
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    evidence: [{ type: 'TEST', ref: 'test://event/1' }],
    payload: {},
    metadata: {}
  };
}

test('event decision endpoint is bearer-authenticated', async () => {
  const app = createRuntimeApp({
    token: 'secret-token',
    eventProcessorFactory: () => ({
      decide: async () => ({
        decision: 'REVIEW_REQUIRED',
        reason_code: 'TEST'
      })
    })
  });

  await withServer(app, async (base) => {
    const missing = await request(base, '/v1/events/decide', {
      method: 'POST',
      body: sampleEvent()
    });
    assert.equal(missing.status, 401);
  });
});

test('event decision endpoint returns processor decision without executing writer', async () => {
  let writerCalls = 0;
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({
      execute: async () => {
        writerCalls++;
        return { state: 'COMMITTED' };
      }
    }),
    eventProcessorFactory: () => ({
      decide: async (envelope) => ({
        schema_version: 'MAGOS-DECISION/V1',
        event_id: envelope.event_id,
        idempotency_key: envelope.idempotency_key,
        decision: 'REVIEW_REQUIRED',
        reason_code: 'NO_DETERMINISTIC_MATCH',
        rule_version: 'MAGOS-EVENT-PROCESSOR-01/V1'
      })
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/events/decide', {
      method: 'POST',
      token: 'secret-token',
      body: sampleEvent()
    });

    assert.equal(result.status, 202);
    assert.equal(result.payload.decision, 'REVIEW_REQUIRED');
    assert.equal(writerCalls, 0);
  });
});


test('governed event run endpoint is bearer-authenticated', async () => {
  let calls = 0;
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        calls += 1;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/events/run', {
      method: 'POST',
      body: sampleEvent()
    });

    assert.equal(result.status, 401);
    assert.equal(calls, 0);
  });
});

test('governed event run endpoint invokes dispatcher and returns commit', async () => {
  let received = null;
  const runtimeWriter = { audit: {} };
  let suppliedWriter = null;

  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => runtimeWriter,
    eventDispatcherFactory: ({ writer }) => {
      suppliedWriter = writer;
      return {
        async run(envelope) {
          received = envelope;
          return {
            state: 'COMMITTED',
            writer: {
              state: 'COMMITTED',
              transaction_id: 'TXN-EVENT-1'
            }
          };
        }
      };
    }
  });

  await withServer(app, async (base) => {
    const event = sampleEvent();
    const result = await request(base, '/v1/events/run', {
      method: 'POST',
      token: 'secret-token',
      body: event
    });

    assert.equal(result.status, 200);
    assert.equal(result.payload.state, 'COMMITTED');
    assert.equal(received.idempotency_key, event.idempotency_key);
    assert.equal(suppliedWriter, runtimeWriter);
  });
});

test('governed event run endpoint maps review and retry states', async () => {
  let state = 'REVIEW_REQUIRED';
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        return { state };
      }
    })
  });

  await withServer(app, async (base) => {
    const review = await request(base, '/v1/events/run', {
      method: 'POST',
      token: 'secret-token',
      body: sampleEvent()
    });
    assert.equal(review.status, 202);

    state = 'RETRY_REQUIRED';
    const retry = await request(base, '/v1/events/run', {
      method: 'POST',
      token: 'secret-token',
      body: sampleEvent()
    });
    assert.equal(retry.status, 409);
  });
});

test('governed event run endpoint rejects unregistered event type with 422', async () => {
  const app = createRuntimeApp({
    token: 'secret-token',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run(envelope) {
        throw new UnsupportedGovernedEventTypeError(envelope.event_type);
      }
    })
  });

  await withServer(app, async (base) => {
    const event = {
      ...sampleEvent(),
      event_type: 'SUPPLIER_EMAIL_RECEIVED'
    };
    const result = await request(base, '/v1/events/run', {
      method: 'POST',
      token: 'secret-token',
      body: event
    });

    assert.equal(result.status, 422);
    assert.equal(result.payload.error, 'UNSUPPORTED_GOVERNED_EVENT_TYPE');
    assert.equal(result.payload.event_type, 'SUPPLIER_EMAIL_RECEIVED');
  });
});


function sampleLeadIngress(overrides = {}) {
  return {
    source: 'WORDPRESS',
    source_event_id: 'WP-FORM-1001',
    evidence_ref: 'https://myriadgreen.co.za/wp-admin/admin.php?page=form-entry&id=1001',
    evidence_type: 'WEBSITE_FORM_ENTRY',
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    safety_attestation: {
      provider: 'TEST_SCANNER',
      scan_id: 'SCAN-1001',
      scanned_at: '2026-09-20T10:00:00Z'
    },
    lead: {
      contact_name: 'Test Lead',
      contact_phone: '+27 82 555 0199',
      contact_email: 'test.ingress@example.com',
      suburb_area: 'Pretoria East',
      service_category: 'Irrigation installation',
      issue_summary: 'New system enquiry'
    },
    ...overrides
  };
}

test('lead ingress is disabled unless a separate ingress token and source allowlist are configured', async () => {
  const app = createRuntimeApp({
    token: 'runtime-secret',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'anything',
      body: sampleLeadIngress()
    });

    assert.equal(result.status, 503);
    assert.equal(result.payload.error, 'MAGOS_LEAD_INGRESS_NOT_CONFIGURED');
  });
});

test('lead ingress does not accept the powerful runtime bearer token as ingress authentication', async () => {
  let calls = 0;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'WORDPRESS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        calls += 1;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      token: 'runtime-secret',
      body: sampleLeadIngress()
    });

    assert.equal(result.status, 401);
    assert.equal(calls, 0);
  });
});

test('lead ingress rejects sources outside the configured allowlist before dispatch', async () => {
  let calls = 0;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'WORDPRESS,FLUENT_FORMS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        calls += 1;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body: sampleLeadIngress({ source: 'META' })
    });

    assert.equal(result.status, 403);
    assert.equal(result.payload.error, 'LEAD_INGRESS_SOURCE_NOT_ALLOWED');
    assert.equal(calls, 0);
  });
});

test('lead ingress compiles canonical payload to LEAD_SUBMITTED and dispatches through governed runtime', async () => {
  let received = null;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: ['WORDPRESS'],
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run(envelope) {
        received = envelope;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body: sampleLeadIngress()
    });

    assert.equal(result.status, 200);
    assert.equal(result.payload.state, 'COMMITTED');
    assert.equal(received.event_type, 'LEAD_SUBMITTED');
    assert.equal(received.source, 'WORDPRESS');
    assert.equal(received.source_event_id, 'WP-FORM-1001');
    assert.equal(received.payload.lead.record_origin, 'WORDPRESS');
    assert.equal(received.payload.lead.acquisition_source, 'WORDPRESS');
    assert.equal(received.payload.lead.first_contact_channel, 'WORDPRESS');
    assert.equal(received.evidence[0].type, 'WEBSITE_FORM_ENTRY');
    assert.equal(received.guards.spam, 'CLEAR');
    assert.equal(result.payload.ingress.event_type, 'LEAD_SUBMITTED');
  });
});

test('unscanned lead ingress defaults every safety guard to UNKNOWN rather than CLEAR', async () => {
  let received = null;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'WORDPRESS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run(envelope) {
        received = envelope;
        return { state: 'REVIEW_REQUIRED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const body = sampleLeadIngress();
    delete body.guards;
    delete body.safety_attestation;

    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body
    });

    assert.equal(result.status, 202);
    assert.deepEqual(received.guards, {
      spam: 'UNKNOWN',
      phishing: 'UNKNOWN',
      explicit_content: 'UNKNOWN',
      malware: 'UNKNOWN',
      irrelevant: 'UNKNOWN'
    });
  });
});

test('lead ingress requires immutable evidence and source event identity', async () => {
  let calls = 0;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'WORDPRESS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        calls += 1;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const noEvidence = sampleLeadIngress({ evidence_ref: '' });
    const first = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body: noEvidence
    });
    assert.equal(first.status, 400);
    assert.equal(first.payload.error, 'LEAD_INGRESS_EVIDENCE_REQUIRED');

    const noEventId = sampleLeadIngress({ source_event_id: '' });
    const second = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body: noEventId
    });
    assert.equal(second.status, 400);
    assert.equal(second.payload.error, 'LEAD_INGRESS_EVENT_ID_REQUIRED');
    assert.equal(calls, 0);
  });
});


test('lead ingress rejects invalid safety guard values before governed dispatch', async () => {
  let calls = 0;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'WORDPRESS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        calls += 1;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const body = sampleLeadIngress({
      guards: {
        spam: 'SAFE_ENOUGH',
        phishing: 'CLEAR',
        explicit_content: 'CLEAR',
        malware: 'CLEAR',
        irrelevant: 'CLEAR'
      }
    });

    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body
    });

    assert.equal(result.status, 400);
    assert.equal(result.payload.error, 'INVALID_GUARD_VALUE');
    assert.equal(calls, 0);
  });
});


test('lead ingress rejects asserted safety decisions without scan provenance', async () => {
  let calls = 0;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'WORDPRESS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run() {
        calls += 1;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const body = sampleLeadIngress();
    delete body.safety_attestation;

    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body
    });

    assert.equal(result.status, 400);
    assert.equal(
      result.payload.error,
      'LEAD_INGRESS_GUARD_ATTESTATION_REQUIRED'
    );
    assert.equal(calls, 0);
  });
});

test('lead ingress carries safety scan provenance into the EventEnvelope metadata', async () => {
  let received = null;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'WORDPRESS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run(envelope) {
        received = envelope;
        return { state: 'COMMITTED' };
      }
    })
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body: sampleLeadIngress()
    });

    assert.equal(result.status, 200);
    assert.deepEqual(received.metadata.safety_attestation, {
      provider: 'TEST_SCANNER',
      scan_id: 'SCAN-1001',
      scanned_at: '2026-09-20T10:00:00.000Z'
    });
  });
});


test('Fluent Forms adapter survives the P5O HTTP ingress boundary without field inference', async () => {
  let received = null;
  const app = createRuntimeApp({
    token: 'runtime-secret',
    leadIngressToken: 'lead-secret',
    leadIngressSources: 'FLUENT_FORMS',
    writerFactory: () => ({ audit: {} }),
    eventDispatcherFactory: () => ({
      async run(envelope) {
        received = envelope;
        return { state: 'REVIEW_REQUIRED' };
      }
    })
  });

  const body = createFluentLeadIngressPayload({
    form_id: '17',
    entry_id: '9001',
    evidence_ref:
      'https://myriadgreen.co.za/wp-admin/admin.php?page=fluent_forms&entry_id=9001',
    form_name: 'Contact Us / Quote Request',
    fields: {
      exact_name: 'Controlled Test',
      exact_email: 'controlled@example.com',
      unknown_label: 'must not map'
    },
    fieldMap: {
      contact_name: 'exact_name',
      contact_email: 'exact_email'
    },
    sourceMetadata: {
      page_url: 'https://myriadgreen.co.za/contact-us/',
      utm_source: 'controlled-test'
    }
  });

  await withServer(app, async (base) => {
    const result = await request(base, '/v1/ingress/leads', {
      method: 'POST',
      ingressToken: 'lead-secret',
      body
    });

    assert.equal(result.status, 202);
    assert.equal(received.event_type, 'LEAD_SUBMITTED');
    assert.equal(received.source, 'FLUENT_FORMS');
    assert.equal(
      received.source_event_id,
      'FLUENT_FORMS|FORM:17|ENTRY:9001'
    );
    assert.equal(received.payload.lead.contact_name, 'Controlled Test');
    assert.equal(received.payload.lead.contact_email, 'controlled@example.com');
    assert.equal(
      Object.values(received.payload.lead).includes('must not map'),
      false
    );
    assert.equal(
      received.metadata.source_metadata.provider_form_id,
      '17'
    );
    assert.equal(
      received.metadata.source_metadata.provider_entry_id,
      '9001'
    );
    assert.equal(
      received.metadata.source_metadata.page_url,
      'https://myriadgreen.co.za/contact-us/'
    );
    assert.deepEqual(received.guards, {
      spam: 'UNKNOWN',
      phishing: 'UNKNOWN',
      explicit_content: 'UNKNOWN',
      malware: 'UNKNOWN',
      irrelevant: 'UNKNOWN'
    });
  });
});
