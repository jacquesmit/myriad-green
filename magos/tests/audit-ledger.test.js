'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AuditLedger,
  isTransientSheetsError
} = require('../adapters/audit-ledger');

function makeLedger({ duplicate = false } = {}) {
  const calls = [];
  const headers = [
    'run_log_id','automation_id','provider_run_id','run_state','trigger_type',
    'started_at','completed_at','idempotency_key','input_scope','affected_record_ids',
    'writes_summary','readback_summary','error_or_blocker','evidence_link','logged_at'
  ];
  const row = [
    'ARL-1','MAGOS-DOC-EXTRACT-01','','FAILED','DRIVE_00A',
    '2026-09-20 10:00:00','','doc-extract:v1:file:hash','scope','','','','boom','',''
  ];

  const values = {
    async get(args) {
      calls.push({ type: 'get', range: args.range });
      if (args.range.endsWith('!1:1')) return { data: { values: [headers] } };
      if (args.range.includes('!H2:H')) {
        return {
          data: {
            values: duplicate
              ? [['doc-extract:v1:file:hash'], ['doc-extract:v1:file:hash']]
              : [['doc-extract:v1:file:hash']]
          }
        };
      }
      if (args.range.includes('!A2:O2')) return { data: { values: [row] } };
      if (args.range.includes('!A3:O3')) return { data: { values: [row] } };
      throw new Error('Unexpected range ' + args.range);
    },
    async update(args) {
      calls.push({ type: 'update', range: args.range, values: args.requestBody.values });
      return { data: {} };
    },
    async append() {
      throw new Error('append not expected');
    }
  };

  const ledger = Object.create(AuditLedger.prototype);
  ledger.spreadsheetId = 'audit-sheet';
  ledger.sheets = { spreadsheets: { values } };
  return { ledger, calls };
}

test('resolves only the live idempotency column before reading the exact row', async () => {
  const { ledger, calls } = makeLedger();
  const found = await ledger.findByKey(
    'Automation_Run_Log',
    'idempotency_key',
    'doc-extract:v1:file:hash'
  );

  assert.equal(found.rowNumber, 2);
  assert.equal(found.object.run_log_id, 'ARL-1');
  assert.deepEqual(
    calls.filter((c) => c.type === 'get').map((c) => c.range),
    [
      "'Automation_Run_Log'!1:1",
      "'Automation_Run_Log'!H2:H",
      "'Automation_Run_Log'!A2:O2"
    ]
  );
});

test('update resolves the current key row immediately before mutation', async () => {
  const { ledger, calls } = makeLedger();
  const updated = await ledger.updateObjectByKey(
    'Automation_Run_Log',
    'idempotency_key',
    'doc-extract:v1:file:hash',
    { run_state: 'RUNNING', error_or_blocker: '' }
  );

  assert.equal(updated, true);
  const update = calls.find((c) => c.type === 'update');
  assert.equal(update.range, "'Automation_Run_Log'!A2:O2");
  assert.equal(update.values[0][3], 'RUNNING');
  assert.equal(update.values[0][12], '');
});

test('duplicate idempotency keys fail closed instead of picking an arbitrary row', async () => {
  const { ledger } = makeLedger({ duplicate: true });
  await assert.rejects(
    ledger.findByKey(
      'Automation_Run_Log',
      'idempotency_key',
      'doc-extract:v1:file:hash'
    ),
    /Duplicate key idempotency_key/
  );
});


test('retries transient Google Sheets quota reads with bounded backoff', async () => {
  let attempts = 0;
  const waits = [];

  const ledger = Object.create(AuditLedger.prototype);
  ledger.spreadsheetId = 'audit-sheet';
  ledger.sheetsRetryAttempts = 3;
  ledger.sheetsRetryBaseMs = 10;
  ledger.sheetsRetryMaxMs = 100;
  ledger.sleepFn = async (ms) => { waits.push(ms); };
  ledger.sheets = {
    spreadsheets: {
      values: {
        async get() {
          attempts += 1;
          if (attempts === 1) {
            const error = new Error(
              "Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user'"
            );
            error.response = {
              status: 429,
              data: {
                error: {
                  code: 429,
                  status: 'RESOURCE_EXHAUSTED',
                  message: error.message
                }
              }
            };
            throw error;
          }
          return { data: { values: [['idempotency_key']] } };
        }
      }
    }
  };

  const headers = await ledger.getHeaders('Automation_Run_Log');
  assert.deepEqual(headers.headers, ['idempotency_key']);
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [10]);
});

test('does not retry non-transient Google Sheets permission failures', async () => {
  let attempts = 0;
  const waits = [];

  const ledger = Object.create(AuditLedger.prototype);
  ledger.spreadsheetId = 'audit-sheet';
  ledger.sheetsRetryAttempts = 3;
  ledger.sheetsRetryBaseMs = 10;
  ledger.sheetsRetryMaxMs = 100;
  ledger.sleepFn = async (ms) => { waits.push(ms); };
  ledger.sheets = {
    spreadsheets: {
      values: {
        async get() {
          attempts += 1;
          const error = new Error('The caller does not have permission');
          error.response = {
            status: 403,
            data: {
              error: {
                code: 403,
                status: 'PERMISSION_DENIED',
                message: error.message,
                errors: [{ reason: 'forbidden' }]
              }
            }
          };
          throw error;
        }
      }
    }
  };

  await assert.rejects(
    ledger.getHeaders('Automation_Run_Log'),
    /does not have permission/
  );
  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
});

test('recognises Google 403 rate-limit reasons as transient but not ordinary permission denial', () => {
  assert.equal(
    isTransientSheetsError({
      response: {
        status: 403,
        data: { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }
      }
    }),
    true
  );
  assert.equal(
    isTransientSheetsError({
      response: {
        status: 403,
        data: { error: { errors: [{ reason: 'forbidden' }] } }
      },
      message: 'The caller does not have permission'
    }),
    false
  );
});


test('does not raw-retry append after a transient response because commit state may be ambiguous', async () => {
  let appendAttempts = 0;
  const waits = [];

  const ledger = Object.create(AuditLedger.prototype);
  ledger.spreadsheetId = 'audit-sheet';
  ledger.sheetsRetryAttempts = 3;
  ledger.sheetsRetryBaseMs = 10;
  ledger.sheetsRetryMaxMs = 100;
  ledger.sleepFn = async (ms) => { waits.push(ms); };
  ledger.sheets = {
    spreadsheets: {
      values: {
        async get() {
          return { data: { values: [['idempotency_key']] } };
        },
        async append() {
          appendAttempts += 1;
          const error = new Error('Quota exceeded for write requests');
          error.response = {
            status: 429,
            data: {
              error: {
                code: 429,
                status: 'RESOURCE_EXHAUSTED',
                message: error.message
              }
            }
          };
          throw error;
        }
      }
    }
  };

  await assert.rejects(
    ledger.appendObject('Automation_Run_Log', { idempotency_key: 'writer:test' }),
    /Quota exceeded/
  );
  assert.equal(appendAttempts, 1);
  assert.deepEqual(waits, []);
});
