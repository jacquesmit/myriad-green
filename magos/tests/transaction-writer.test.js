'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TransactionWriter } = require('../writer/transaction-writer');
const { upsertByKey, stateTransition, setIfEmpty, patchIfMatch, createIfAbsent, composeTransactionPlan } = require('../writer/operations');

class FakeStore {
  constructor(tables = {}) {
    this.tables = structuredClone(tables);
  }
  async getHeaders(sheet) {
    const rows = this.tables[sheet] || [];
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const map = Object.fromEntries(headers.map((h, i) => [h, i]));
    return { headers, map };
  }
  async findByKey(sheet, header, value) {
    const rows = this.tables[sheet] || [];
    const index = rows.findIndex((r) => String(r[header] ?? '') === String(value));
    return index < 0 ? null : { rowNumber: index + 2, object: structuredClone(rows[index]) };
  }
  async readObjects(sheet) {
    return structuredClone(this.tables[sheet] || []);
  }
  async updateFieldsByKey(sheet, header, value, changes) {
    const rows = this.tables[sheet] || [];
    const index = rows.findIndex((r) => String(r[header] ?? '') === String(value));
    if (index < 0) return null;
    const before = {};
    for (const [field, next] of Object.entries(changes)) {
      before[field] = rows[index][field] ?? '';
      rows[index][field] = next;
    }
    return { rowNumber: index + 2, before, changed: true };
  }
  async appendObject(sheet, object) {
    this.tables[sheet] ||= [];
    this.tables[sheet].push(structuredClone(object));
  }
  async deleteRowByKey(sheet, header, value) {
    const rows = this.tables[sheet] || [];
    const index = rows.findIndex((r) => String(r[header] ?? '') === String(value));
    if (index >= 0) rows.splice(index, 1);
    return index >= 0;
  }
}

class FakeAudit extends FakeStore {
  constructor(tables) {
    super(tables);
  }
  async beginRun({ idempotencyKey }) {
    const existing = await this.findByKey('Automation_Run_Log', 'idempotency_key', idempotencyKey);
    if (existing && existing.object.run_state === 'COMMITTED') {
      return { duplicate: true, existing: existing.object };
    }
    if (existing) {
      await this.updateFieldsByKey('Automation_Run_Log', 'idempotency_key', idempotencyKey, {
        run_state: 'RUNNING', error_or_blocker: ''
      });
      return { duplicate: false, retry: true, runLogId: existing.object.run_log_id };
    }
    await this.appendObject('Automation_Run_Log', {
      run_log_id: 'ARL-1', idempotency_key: idempotencyKey, run_state: 'RUNNING'
    });
    return { duplicate: false, retry: false, runLogId: 'ARL-1' };
  }
  async completeRun(key, values) {
    await this.updateFieldsByKey('Automation_Run_Log', 'idempotency_key', key, {
      run_state: values.state,
      affected_record_ids: values.affectedRecordIds,
      writes_summary: values.writesSummary,
      readback_summary: values.readbackSummary,
      error_or_blocker: values.errorOrBlocker
    });
  }
  async raiseSyncException({ idempotencyKey, exceptionType }) {
    const existing = await this.findByKey('Sync_Exceptions', 'idempotency_key', idempotencyKey);
    if (existing) {
      await this.updateFieldsByKey('Sync_Exceptions', 'idempotency_key', idempotencyKey, {
        status: 'OPEN', exception_type: exceptionType
      });
      return existing.object.exception_id;
    }
    await this.appendObject('Sync_Exceptions', {
      exception_id: 'SYNC-EXC-1', idempotency_key: idempotencyKey,
      status: 'OPEN', exception_type: exceptionType
    });
    return 'SYNC-EXC-1';
  }
  async resolveSyncException(key) {
    const existing = await this.findByKey('Sync_Exceptions', 'idempotency_key', key);
    if (!existing) return false;
    await this.updateFieldsByKey('Sync_Exceptions', 'idempotency_key', key, { status: 'RESOLVED' });
    return true;
  }
}

function fixtures() {
  const crm = new FakeStore({
    Jobs_Opportunities: [{
      opportunity_id: 'OPP-1', job_id: '', quote_number: '', job_status: 'ASSESSMENT_NEEDED'
    }]
  });
  const commercial = new FakeStore({
    Quotes: [{
      quote_id: 'QTE-1', opportunity_id: 'OPP-1', 'Quote Status': 'ACCEPTED'
    }],
    'Job Execution': [{
      'Execution ID': 'EXEC-SEED', 'Job ID': 'JOB-SEED', opportunity_id: 'OPP-SEED', quote_id: 'QTE-SEED'
    }]
  });
  const audit = new FakeAudit({
    Automation_Run_Log: [{
      run_log_id: '', idempotency_key: '', run_state: '', affected_record_ids: '',
      writes_summary: '', readback_summary: '', error_or_blocker: ''
    }],
    Sync_Exceptions: [{
      exception_id: '', idempotency_key: '', status: '', exception_type: ''
    }],
    Data_Ownership_Matrix: [{
      entity_type: 'Job', ownership_status: 'PASS',
      source_of_truth_workbook: 'Myriad Green Outreach CRM',
      source_of_truth_tab: 'Jobs_Opportunities'
    }],
    Cross_System_Links: [{
      link_id: 'LNK-009', automation_status: 'ACTIVE',
      destination_tab: 'Job Execution'
    }],
    Writer_Schema_Registry: [
      { workbook_role: 'CRM', sheet_name: 'Jobs_Opportunities', ordinal_1based: '1', expected_header: 'opportunity_id' },
      { workbook_role: 'CRM', sheet_name: 'Jobs_Opportunities', ordinal_1based: '2', expected_header: 'job_id' },
      { workbook_role: 'CRM', sheet_name: 'Jobs_Opportunities', ordinal_1based: '3', expected_header: 'quote_number' },
      { workbook_role: 'CRM', sheet_name: 'Jobs_Opportunities', ordinal_1based: '4', expected_header: 'job_status' },
      { workbook_role: 'COMMERCIAL', sheet_name: 'Job Execution', ordinal_1based: '1', expected_header: 'Execution ID' },
      { workbook_role: 'COMMERCIAL', sheet_name: 'Job Execution', ordinal_1based: '2', expected_header: 'Job ID' },
      { workbook_role: 'COMMERCIAL', sheet_name: 'Job Execution', ordinal_1based: '3', expected_header: 'opportunity_id' },
      { workbook_role: 'COMMERCIAL', sheet_name: 'Job Execution', ordinal_1based: '4', expected_header: 'quote_id' }
    ]
  });
  return { crm, commercial, audit };
}

function plan(expectStatus = 'ACCEPTED') {
  return {
    idempotency_key: 'writer:v1:qte-1',
    event_type: 'JOB_CREATE_FROM_ACCEPTED_QUOTE',
    source_event_id: 'QTE-1',
    preconditions: [{
      store: 'commercial', sheet: 'Quotes',
      key: { header: 'quote_id', value: 'QTE-1' },
      expect: { 'Quote Status': expectStatus, opportunity_id: 'OPP-1' }
    }],
    writes: [
      {
        store: 'crm', workbook_role: 'CRM', sheet: 'Jobs_Opportunities',
        operation: 'UPDATE_BY_KEY',
        key: { header: 'opportunity_id', value: 'OPP-1' },
        authority: 'AUTHORITATIVE', entity_type: 'Job',
        changes: { job_id: 'JOB-1', quote_number: 'Q-1', job_status: 'AWAITING_MATERIALS' }
      },
      {
        store: 'commercial', workbook_role: 'COMMERCIAL', sheet: 'Job Execution',
        operation: 'APPEND_IF_ABSENT',
        key: { header: 'Job ID', value: 'JOB-1' },
        authority: 'CROSS_SYSTEM_LINK', link_id: 'LNK-009',
        values: { 'Execution ID': 'EXEC-1', 'Job ID': 'JOB-1', opportunity_id: 'OPP-1', quote_id: 'QTE-1' }
      }
    ]
  };
}

test('commits authoritative job + linked execution and duplicate replay is a no-op', async () => {
  const { crm, commercial, audit } = fixtures();
  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });
  const first = await writer.execute(plan());
  assert.equal(first.state, 'COMMITTED');
  assert.equal((await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-1')).object.job_id, 'JOB-1');
  assert.equal((await commercial.findByKey('Job Execution', 'Job ID', 'JOB-1')).object.quote_id, 'QTE-1');

  const replay = await writer.execute(plan());
  assert.equal(replay.state, 'DUPLICATE_NO_OP');
  assert.equal(commercial.tables['Job Execution'].filter((r) => r['Job ID'] === 'JOB-1').length, 1);
});

test('precondition failure creates retry state and same idempotency key recovers', async () => {
  const { crm, commercial, audit } = fixtures();
  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });

  const failed = await writer.execute(plan('DRAFT'));
  assert.equal(failed.state, 'RETRY_REQUIRED');
  assert.equal((await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-1')).object.job_id, '');

  const recovered = await writer.execute(plan('ACCEPTED'));
  assert.equal(recovered.state, 'COMMITTED');
  assert.equal((await audit.findByKey('Sync_Exceptions', 'idempotency_key', 'writer:writer:v1:qte-1')).object.status, 'RESOLVED');
});


function operationPlan(id, write) {
  return composeTransactionPlan({
    idempotency_key: 'writer:ops:' + id,
    event_type: 'WRITER_OPERATION_TEST',
    source_event_id: 'SRC-' + id,
    writes: [write]
  });
}

function jobTarget(opportunityId = 'OPP-1') {
  return {
    store: 'crm',
    workbook_role: 'CRM',
    sheet: 'Jobs_Opportunities',
    key: { header: 'opportunity_id', value: opportunityId },
    authority: 'AUTHORITATIVE',
    entity_type: 'Job'
  };
}

test('new writer operations create and upsert canonical records through the same controls', async () => {
  const { crm, commercial, audit } = fixtures();
  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });

  const created = await writer.execute(operationPlan(
    'create',
    createIfAbsent({
      ...jobTarget('OPP-2'),
      intent: 'CREATE_JOB_RECORD',
      values: {
        job_id: 'JOB-2',
        quote_number: 'Q-2',
        job_status: 'ASSESSMENT_NEEDED'
      }
    })
  ));

  assert.equal(created.state, 'COMMITTED');
  assert.equal(
    (await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-2')).object.job_id,
    'JOB-2'
  );

  const upserted = await writer.execute(operationPlan(
    'upsert',
    upsertByKey({
      ...jobTarget('OPP-2'),
      intent: 'UPSERT_JOB_RECORD',
      values: {
        job_id: 'JOB-2',
        quote_number: 'Q-2',
        job_status: 'ASSESSMENT_NEEDED'
      },
      changes: { job_status: 'READY' }
    })
  ));

  assert.equal(upserted.state, 'COMMITTED');
  assert.equal(
    (await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-2')).object.job_status,
    'READY'
  );
});

test('STATE_TRANSITION and PATCH_IF_MATCH refuse stale live state', async () => {
  const { crm, commercial, audit } = fixtures();
  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });

  const transitioned = await writer.execute(operationPlan(
    'transition-pass',
    stateTransition({
      ...jobTarget(),
      intent: 'ADVANCE_JOB',
      state_field: 'job_status',
      from_state: 'ASSESSMENT_NEEDED',
      to_state: 'READY'
    })
  ));

  assert.equal(transitioned.state, 'COMMITTED');
  assert.equal(
    (await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-1')).object.job_status,
    'READY'
  );

  const staleTransition = await writer.execute(operationPlan(
    'transition-stale',
    stateTransition({
      ...jobTarget(),
      intent: 'ADVANCE_JOB',
      state_field: 'job_status',
      from_state: 'ASSESSMENT_NEEDED',
      to_state: 'DONE'
    })
  ));

  assert.equal(staleTransition.state, 'RETRY_REQUIRED');
  assert.match(staleTransition.error, /STATE_TRANSITION_REJECTED/);

  const stalePatch = await writer.execute(operationPlan(
    'patch-stale',
    patchIfMatch({
      ...jobTarget(),
      intent: 'PATCH_JOB_IF_CURRENT',
      expect: { job_status: 'ASSESSMENT_NEEDED' },
      changes: { quote_number: 'SHOULD-NOT-WRITE' }
    })
  ));

  assert.equal(stalePatch.state, 'RETRY_REQUIRED');
  assert.match(stalePatch.error, /PATCH_EXPECTATION_FAILED/);
  assert.equal(
    (await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-1')).object.quote_number,
    ''
  );
});

test('SET_IF_EMPTY fills missing values but does not overwrite established values', async () => {
  const { crm, commercial, audit } = fixtures();
  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });

  const filled = await writer.execute(operationPlan(
    'set-empty',
    setIfEmpty({
      ...jobTarget(),
      intent: 'SET_JOB_ID_IF_EMPTY',
      values: { job_id: 'JOB-1' }
    })
  ));

  assert.equal(filled.state, 'COMMITTED');
  assert.equal(
    (await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-1')).object.job_id,
    'JOB-1'
  );

  const conflict = await writer.execute(operationPlan(
    'set-empty-conflict',
    setIfEmpty({
      ...jobTarget(),
      intent: 'SET_JOB_ID_IF_EMPTY',
      values: { job_id: 'JOB-DIFFERENT' }
    })
  ));

  assert.equal(conflict.state, 'RETRY_REQUIRED');
  assert.match(conflict.error, /FIELD_NOT_EMPTY/);
  assert.equal(
    (await crm.findByKey('Jobs_Opportunities', 'opportunity_id', 'OPP-1')).object.job_id,
    'JOB-1'
  );
});


test('registryRows does not truncate Writer_Schema_Registry at 300 rows', async () => {
  let seenOptions = 'NOT_CALLED';
  const audit = {
    async readObjects(sheet, options) {
      assert.equal(sheet, 'Writer_Schema_Registry');
      seenOptions = options;
      return [];
    }
  };
  const writer = new TransactionWriter({
    stores: { audit },
    auditStore: audit
  });

  const rows = await writer.registryRows();
  assert.deepEqual(rows, []);
  assert.equal(seenOptions, undefined);
});
