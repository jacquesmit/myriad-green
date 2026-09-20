'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createIfAbsent,
  upsertByKey,
  patchIfMatch,
  stateTransition,
  setIfEmpty,
  attachEvidence,
  setSnapshot,
  createProcurementRequirement,
  recordSupplierPrice,
  allocatePayment,
  composeTransactionPlan,
  createJobFromAcceptedScope
} = require('../writer/operations');

function authoritativeTarget(keyValue = 'R1') {
  return {
    store: 'crm',
    workbook_role: 'CRM',
    sheet: 'Jobs_Opportunities',
    key: { header: 'opportunity_id', value: keyValue },
    authority: 'AUTHORITATIVE',
    entity_type: 'Job'
  };
}

test('operation constructors preserve canonical keys and semantic intent', () => {
  const create = createIfAbsent({
    ...authoritativeTarget('OPP-2'),
    intent: 'CREATE_RECORD',
    values: { job_id: 'JOB-2' }
  });
  assert.equal(create.operation, 'CREATE_IF_ABSENT');
  assert.equal(create.values.opportunity_id, 'OPP-2');
  assert.equal(create.intent, 'CREATE_RECORD');

  assert.equal(
    upsertByKey({
      ...authoritativeTarget(),
      values: { job_status: 'READY' }
    }).operation,
    'UPSERT_BY_KEY'
  );

  assert.equal(
    patchIfMatch({
      ...authoritativeTarget(),
      expect: { job_status: 'READY' },
      changes: { job_status: 'DONE' }
    }).operation,
    'PATCH_IF_MATCH'
  );

  assert.equal(
    stateTransition({
      ...authoritativeTarget(),
      state_field: 'job_status',
      from_state: 'READY',
      to_state: 'DONE'
    }).operation,
    'STATE_TRANSITION'
  );

  assert.equal(
    setIfEmpty({
      ...authoritativeTarget(),
      values: { job_id: 'JOB-1' }
    }).operation,
    'SET_IF_EMPTY'
  );
});

test('business helpers compile to governed writer primitives', () => {
  assert.equal(
    attachEvidence({
      ...authoritativeTarget(),
      field: 'quote_number',
      evidence: 'Q-1'
    }).intent,
    'ATTACH_EVIDENCE'
  );

  assert.equal(
    setSnapshot({
      ...authoritativeTarget(),
      field: 'job_status',
      snapshot: 'READY'
    }).intent,
    'SET_SNAPSHOT'
  );

  assert.equal(
    createProcurementRequirement({
      ...authoritativeTarget('OPP-3'),
      values: { job_id: 'JOB-3' }
    }).intent,
    'CREATE_PROCUREMENT_REQUIREMENT'
  );

  assert.equal(
    recordSupplierPrice({
      ...authoritativeTarget('OPP-4'),
      values: { job_id: 'JOB-4' }
    }).intent,
    'RECORD_SUPPLIER_PRICE'
  );

  assert.equal(
    allocatePayment({
      ...authoritativeTarget('OPP-5'),
      values: { job_id: 'JOB-5' }
    }).intent,
    'ALLOCATE_PAYMENT'
  );
});

test('composeTransactionPlan and accepted-scope recipe produce multi-write plans', () => {
  const simple = composeTransactionPlan({
    idempotency_key: 'ops:1',
    event_type: 'TEST',
    source_event_id: 'SRC-1',
    writes: [
      setIfEmpty({
        ...authoritativeTarget(),
        values: { job_id: 'JOB-1' }
      })
    ]
  });
  assert.equal(simple.writes.length, 1);

  const job = createJobFromAcceptedScope({
    idempotency_key: 'job:q1',
    source_event_id: 'QTE-1',
    quote_preconditions: [{
      store: 'commercial',
      sheet: 'Quotes',
      key: { header: 'quote_id', value: 'QTE-1' },
      expect: { 'Quote Status': 'ACCEPTED' }
    }],
    job_target: authoritativeTarget(),
    job_changes: { job_id: 'JOB-1' },
    execution_target: {
      store: 'commercial',
      workbook_role: 'COMMERCIAL',
      sheet: 'Job Execution',
      key: { header: 'Job ID', value: 'JOB-1' },
      link_id: 'LNK-009'
    },
    execution_values: {
      'Execution ID': 'EXEC-1',
      opportunity_id: 'OPP-1',
      quote_id: 'QTE-1'
    }
  });

  assert.equal(job.writes.length, 2);
  assert.equal(job.writes[0].operation, 'UPDATE_BY_KEY');
  assert.equal(job.writes[1].operation, 'CREATE_IF_ABSENT');
  assert.equal(job.writes[1].authority, 'CROSS_SYSTEM_LINK');
  assert.equal(job.writes[1].values['Job ID'], 'JOB-1');
});
