'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AuditLedger } = require('../adapters/audit-ledger');

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
