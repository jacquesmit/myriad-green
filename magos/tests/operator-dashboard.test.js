'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { loadOperatorDashboard } = require('../processor/operator-dashboard');
const { createRuntimeApp } = require('../runtime/app');
const { AuditLedger } = require('../adapters/audit-ledger');

const tables = {
  Intake_Queue: [
    { intake_id: 'IN-1', source_event_id: 'same', source_system: 'GMAIL', source_type: 'WEBSITE_FORM', processing_status: 'NEW' },
    { intake_id: 'IN-2', source_event_id: 'same', source_system: 'WEBSITE', source_type: 'WEBSITE_FORM', processing_status: 'NEW' },
  ],
  CRM_Master: [{ crm_id: 'CRM-1', company: 'Example client' }],
  Jobs_Opportunities: [{ opportunity_id: 'DUP', job_id: 'J-1' }, { opportunity_id: 'DUP', job_id: 'J-2' }, { opportunity_id: 'O-1', job_id: 'J-3' }],
  Quotes: [{ quote_id: 'Q-1', 'Quote Status': 'SENT', 'Project / Scope': 'Irrigation' }],
  Bookings: [{ booking_id: 'B-1', appointment_start: '2026-11-12 09:00', mgos_booking_status: 'CONFIRMED', staff_technician: 'Crew A' }],
  'Payment Control': [
    { 'Control ID': 'P-1', 'Contract Value (R)': 2000, 'Deposit Required (R)': 1000, 'Financial Status': 'OPEN', payment_proof_drive_link: 'proof' },
    { 'Control ID': 'P-2', 'Contract Value (R)': 4000, 'Deposit Required (R)': 1000 },
  ],
  Payment_Allocations: [
    { control_id: 'P-1', allocation_id: 'A-1', allocation_state: 'CLEARED', allocation_type: 'DEPOSIT', amount: 500, evidence_link: 'bank' },
    { control_id: 'P-1', allocation_id: 'A-2', allocation_state: 'PROOF_ONLY', allocation_type: 'DEPOSIT', amount: 1000, evidence_link: 'proof' },
    { control_id: 'P-2', allocation_id: 'A-3', allocation_state: 'CLEARED', allocation_type: 'DEPOSIT', amount: 1000 },
  ],
  'Job Execution': [{ 'Execution ID': 'E-1', 'Job ID': 'J-3', 'Completion Sign-off': 'evidence' }],
  Procurement: [],
  Suppliers: [{ supplier_id: 'S-1', supplier_name: 'Example supplier', supplier_approval_state: 'VETTING' }],
  Sync_Exceptions: [],
};
const makeStores = (fail = '') => {
  const readObjects = async (name, options) => {
    assert.equal(options.maxRows, null);
    assert.ok(options.requiredHeaders.length > 0);
    if (name === fail) throw new Error('Register unavailable');
    return tables[name];
  };
  return Object.fromEntries(['crm', 'commercial', 'audit', 'supplier'].map(key => [key, { readObjects }]));
};

test('department dashboard reads canonical registers and quarantines conflicting keys', async () => {
  const result = await loadOperatorDashboard(makeStores());
  assert.equal(result.side_effects, false);
  assert.equal(result.overview_counts.open_leads, 2);
  assert.equal(result.overview_counts.active_jobs, 1);
  assert.equal(result.departments.jobs.state, 'PARTIAL');
  assert.equal(result.departments.jobs.records[0].status, 'REVIEW_REQUIRED');
  assert.equal(result.departments.jobs.records[0].details.job_id, undefined);
  assert.equal(result.departments.dispatch.records[0].details.Crew, 'Crew A');
  assert.equal(result.departments.evidence.records[0].details['Completion sign-off'], 'evidence');
  assert.equal(result.departments.suppliers.records[0].status, 'VETTING');
  assert.ok(result.attention.some(item => item.id === 'DUP'));
});

test('finance shows only cleared allocations and leaves unverified figures unknown', async () => {
  const result = await loadOperatorDashboard(makeStores());
  const [valid, invalid] = result.departments.finance.records;
  assert.equal(valid.details['Cleared deposit (ZAR)'], 500);
  assert.equal(valid.details['Contract balance (ZAR)'], 1500);
  assert.equal(valid.details['Payment proof'], 'proof');
  assert.equal(invalid.status, 'REVIEW_REQUIRED');
  assert.equal(invalid.details['Total cleared receipts (ZAR)'], null);
});

test('register failure is explicit and does not erase healthy departments', async () => {
  const result = await loadOperatorDashboard(makeStores('Payment_Allocations'));
  assert.equal(result.departments.finance.state, 'UNAVAILABLE');
  assert.equal(result.departments.finance.records, undefined);
  assert.equal(result.departments.quotes.state, 'LIVE');
});

test('dashboard uses a dedicated read credential with no access to writer routes', async () => {
  const app = createRuntimeApp({ token: 'writer-secret', operatorReadToken: 'operator-secret',
    writerFactory: () => ({ stores: makeStores() }) });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = { 'X-MAGOS-Operator-Token': 'operator-secret' };
    assert.equal((await fetch(base + '/v1/operator/dashboard')).status, 401);
    assert.equal((await fetch(base + '/v1/operator/dashboard', { headers: { 'X-MAGOS-Operator-Token': 'writer-secret' } })).status, 401);
    const dashboard = await fetch(base + '/v1/operator/dashboard', { headers });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.headers.get('cache-control'), 'private, no-store');
    assert.equal((await dashboard.json()).schema_version, 'MAGOS_OPERATOR_DASHBOARD/V1');
    for (const path of ['/v1/transactions', '/v1/events/run', '/v1/probes/google-sheets']) {
      assert.equal((await fetch(base + path, { method: 'POST', headers: {
        ...headers, Authorization: 'Bearer operator-secret',
      } })).status, 401);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('dashboard Sheets reads reject duplicate headers and can include rows past the old limit', async () => {
  const ledger = Object.create(AuditLedger.prototype);
  ledger.spreadsheetId = 'fixture';
  ledger.withSheetsRetry = async (_, read) => read();
  ledger.getHeaders = async () => ({ headers: ['record_id', 'state'] });
  ledger.sheets = { spreadsheets: { values: { get: async request => {
    assert.equal(request.range, "'Queue'!A2:B");
    return { data: { values: Array.from({ length: 1002 }, (_, i) => ['ID-' + i, 'OPEN']) } };
  } } } };
  const rows = await ledger.readObjects('Queue', { maxRows: null, requiredHeaders: ['record_id'] });
  assert.equal(rows.at(-1).record_id, 'ID-1001');
  ledger.getHeaders = async () => ({ headers: ['record_id', 'record_id'] });
  await assert.rejects(ledger.readObjects('Queue', { maxRows: null, requiredHeaders: ['record_id'] }), /Unexpected register schema/);
});
