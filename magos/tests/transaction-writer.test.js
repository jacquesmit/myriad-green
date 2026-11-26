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


test('stale reconciliation marks no-run unapplied plan safe for same-key retry', async () => {
  const { crm, commercial, audit } = fixtures();
  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });

  const result = await writer.reconcileStalePlan(plan());
  assert.equal(result.state, 'RETRY_REQUIRED');
  assert.equal(result.reason_code, 'STALE_EXECUTING_NO_WRITER_RUN');
  assert.equal(result.inspection.business_state, 'NOT_APPLIED');
});


test('stale RUNNING writer reconciles COMMITTED only after exact authoritative read-back', async () => {
  const { crm, commercial, audit } = fixtures();
  crm.tables.Jobs_Opportunities[0].job_id = 'JOB-1';
  crm.tables.Jobs_Opportunities[0].quote_number = 'Q-1';
  crm.tables.Jobs_Opportunities[0].job_status = 'AWAITING_MATERIALS';
  commercial.tables['Job Execution'].push({
    'Execution ID': 'EXEC-1',
    'Job ID': 'JOB-1',
    opportunity_id: 'OPP-1',
    quote_id: 'QTE-1'
  });
  audit.tables.Automation_Run_Log.push({
    run_log_id: 'ARL-STALE-1',
    idempotency_key: 'writer:v1:qte-1',
    run_state: 'RUNNING',
    affected_record_ids: '',
    writes_summary: '',
    readback_summary: '',
    error_or_blocker: ''
  });

  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });

  const result = await writer.reconcileStalePlan(plan());
  assert.equal(result.state, 'COMMITTED');
  assert.equal(result.reason_code, 'STALE_RUNNING_RECONCILED_COMMITTED');

  const run = await audit.findByKey(
    'Automation_Run_Log',
    'idempotency_key',
    'writer:v1:qte-1'
  );
  assert.equal(run.object.run_state, 'COMMITTED');
});


test('stale RUNNING writer with no declared mutation becomes RETRY_REQUIRED', async () => {
  const { crm, commercial, audit } = fixtures();
  audit.tables.Automation_Run_Log.push({
    run_log_id: 'ARL-STALE-2',
    idempotency_key: 'writer:v1:qte-1',
    run_state: 'RUNNING',
    affected_record_ids: '',
    writes_summary: '',
    readback_summary: '',
    error_or_blocker: ''
  });

  const writer = new TransactionWriter({
    stores: { audit, crm, commercial },
    auditStore: audit
  });

  const result = await writer.reconcileStalePlan(plan());
  assert.equal(result.state, 'RETRY_REQUIRED');
  assert.equal(result.reason_code, 'STALE_RUNNING_NO_BUSINESS_MUTATION');

  const run = await audit.findByKey(
    'Automation_Run_Log',
    'idempotency_key',
    'writer:v1:qte-1'
  );
  assert.equal(run.object.run_state, 'RETRY_REQUIRED');

  const exception = await audit.findByKey(
    'Sync_Exceptions',
    'idempotency_key',
    'writer:writer:v1:qte-1'
  );
  assert.equal(exception.object.status, 'OPEN');
});


// CORE-003 synthetic integration: actual lead processor -> actual P3 writer.
// Only storage and identity lookup are substituted; no network or live records.
const { createLeadSubmittedEvent } = require('../processor/lead-observation');
const { createLeadProcessor } = require('../processor/lead-processor');
const { deterministicLeadIds } = require('../processor/lead-planner');

const leadSchemas = {
  Intake_Queue: 'intake_id received_at source_system source_type source_event_id source_thread_id sender_name sender_email recipient_email subject_or_file_name contact_name contact_email contact_phone company property_or_suburb service_category urgency source_link match_status matched_crm_id matched_opportunity_id routing_action processing_status review_reason last_checked_at notes',
  CRM_Master: 'date_added company lead_type priority phone preferred_call_number email address recommended_services next_action crm_status notes owner response_status opportunity_stage quote_status job_status review_status post_status do_not_contact opt_out_reason last_action_date next_follow_up_date conversation_summary outcome preferred_email lead_direction record_origin acquisition_source first_contact_channel source_detail source_evidence source_confidence first_touch_date landing_page_or_campaign crm_id contact_id property_id opportunity_id source_message_id',
  Jobs_Opportunities: 'project_record_id opportunity_id job_id client_crm_id contact_id property_id client_name phone site_address suburb_area municipality province service_region primary_service service_detail issue_summary document_date job_status payment_status review_status post_status next_action next_follow_up_date client_input_evidence_link media_consent_status source created_at updated_at'
};

function syntheticLeadFixture() {
  const tables = {}, registry = [];
  for (const [sheet, fields] of Object.entries(leadSchemas)) {
    const headers = fields.split(' ');
    tables[sheet] = [Object.fromEntries(headers.map(h => [h, '']))];
    headers.forEach((h,i) => registry.push({workbook_role:'CRM',sheet_name:sheet,ordinal_1based:String(i+1),expected_header:h}));
  }
  const crm = new FakeStore(tables);
  const { audit } = fixtures();
  audit.tables.Writer_Schema_Registry = registry;
  audit.tables.Data_Ownership_Matrix = [
    ['Source event','Intake_Queue'],['Client','CRM_Master'],['Opportunity','Jobs_Opportunities']
  ].map(([entity_type,source_of_truth_tab]) => ({entity_type,source_of_truth_tab,ownership_status:'PASS',source_of_truth_workbook:'Myriad Green Outreach CRM'}));
  const env = createLeadSubmittedEvent({
    source:'WEBSITE',source_event_id:'SYNTHETIC-CORE003-001',
    evidence:[{type:'WEBSITE_SUBMISSION',ref:'https://example.com/synthetic/core003'}],
    lead:{contact_name:'Synthetic Test Client',contact_email:'core003@example.com',service_category:'Irrigation installation',property_or_suburb:'Pretoria East'}
  }, {receivedAt:new Date('2026-11-26T08:00:00Z')});
  const processor = createLeadProcessor({
    lookupService:{leadResolverDependencies:()=>({
      findIntakeBySourceEvent:async(source,id)=>(await crm.readObjects('Intake_Queue')).find(r=>r.source_system===source&&r.source_event_id===id)||null,
      findCrmCandidatesByIdentity:async()=>[],
      findEntityByCanonicalId:async()=>null
    })},
    now:()=>new Date('2026-11-26T08:01:00Z')
  });
  const writer = new TransactionWriter({stores:{crm,audit},auditStore:audit});
  return {crm,audit,env,processor,writer};
}

test('CORE-003 synthetic website enquiry commits canonical intake, client and opportunity; exact readback and replay', async()=>{
  const {crm,audit,env,processor,writer}=syntheticLeadFixture();
  const ids=deterministicLeadIds(env);
  const decision=await processor.decide(env);
  assert.equal(decision.decision,'AUTO_WRITE',JSON.stringify(decision));
  const plan=decision.transaction_plan;
  assert.deepEqual(plan.writes.map(w=>w.sheet),['Intake_Queue','CRM_Master','Jobs_Opportunities']);
  const result=await writer.execute(plan);
  assert.equal(result.state,'COMMITTED',JSON.stringify(result));
  const intake=(await crm.findByKey('Intake_Queue','intake_id',ids.intake_id)).object;
  const client=(await crm.findByKey('CRM_Master','crm_id',ids.crm_id)).object;
  const opp=(await crm.findByKey('Jobs_Opportunities','opportunity_id',ids.opportunity_id)).object;
  assert.equal(intake.matched_crm_id,client.crm_id);
  assert.equal(intake.matched_opportunity_id,opp.opportunity_id);
  assert.equal(opp.client_crm_id,client.crm_id);
  assert.equal(opp.contact_id,client.contact_id);
  assert.equal(opp.primary_service,'Irrigation installation');
  assert.equal(opp.job_status,'NO_JOB');
  assert.equal(opp.payment_status,'NOT_APPLICABLE');
  assert.equal((await writer.inspectPlanState(plan)).business_state,'APPLIED');
  assert.equal((await audit.findByKey('Automation_Run_Log','idempotency_key',plan.idempotency_key)).object.run_state,'COMMITTED');
  assert.equal((await writer.execute(plan)).state,'DUPLICATE_NO_OP');
  assert.equal((await processor.decide(env)).decision,'IGNORE');
  for(const w of plan.writes) assert.equal((await crm.readObjects(w.sheet)).filter(r=>r[w.key.header]===w.key.value).length,1);
});

test('CORE-003 authority rejection cannot create synthetic canonical lead records',async()=>{
  const {crm,audit,env,processor,writer}=syntheticLeadFixture();
  const decision=await processor.decide(env);
  audit.tables.Data_Ownership_Matrix.find(r=>r.entity_type==='Opportunity').ownership_status='BLOCK';
  const result=await writer.execute(decision.transaction_plan);
  assert.notEqual(result.state,'COMMITTED');
  for(const w of decision.transaction_plan.writes) assert.equal(await crm.findByKey(w.sheet,w.key.header,w.key.value),null);
});
