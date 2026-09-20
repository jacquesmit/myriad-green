'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createRuntimeApp } = require('../runtime/app');

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

async function request(base, path, { method = 'GET', token = '', body } = {}) {
  const headers = {};
  if (token) headers.authorization = 'Bearer ' + token;
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
