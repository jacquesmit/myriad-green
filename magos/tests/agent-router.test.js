'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planAgentTask,CATALOG}=require('../agents/agent-router');
const base={
  job_type_id:'JT-002',tenant_id:'MYRIAD_GREEN',
  jurisdiction_id:'ZA',branch_id:'PRETORIA',
  canonical_record_id:'CRM-TEST-001',
  source:'GMAIL',source_event_id:'msg-test-001',evidence_refs:['test:gmail:msg-test-001']
};
test('canonical Drive snapshot covers 38 registered agents',()=>{
  assert.equal(Object.keys(CATALOG).length,38);
  assert.equal(CATALOG['AG-001'].name,'MAGOS Control Tower');
});
test('routes lead qualification to AG-003 not generic SALES',()=>{
  const p=planAgentTask(base);
  assert.equal(p.agent_id,'AG-003');
  assert.equal(p.state,'PROPOSED');
  assert.equal(p.execution_authorized,false);
  assert.equal(p.authority,'PROPOSAL_ONLY_SNAPSHOT_NOT_LIVE');
  assert.equal(p.idempotency_key,planAgentTask({...base}).idempotency_key);
});
test('routes exact source job type to canonical independent owner',()=>{
  assert.equal(planAgentTask({...base,job_type_id:'JT-001'}).agent_id,'AG-002');
  assert.equal(planAgentTask({...base,job_type_id:'JT-007'}).agent_id,'AG-010');
  assert.equal(planAgentTask({...base,job_type_id:'JT-009'}).agent_id,'AG-006');
  assert.equal(planAgentTask({...base,job_type_id:'JT-201'}).agent_id,'AG-012');
  assert.equal(planAgentTask({...base,job_type_id:'JT-105'}).agent_id,'AG-020');
});
test('rejects unknown job types',()=>{
  const p=planAgentTask({...base,job_type_id:'JT-999'});
  assert.equal(p.state,'BLOCKED');
  assert.ok(p.blockers.includes('BLOCKED_UNREGISTERED_JOB_TYPE'));
});
test('rejects missing scope and empty evidence',()=>{
  const p=planAgentTask({...base,tenant_id:'',evidence_refs:[]});
  assert.ok(p.blockers.includes('BLOCKED_SCOPE_OR_IDENTITY'));
  assert.ok(p.blockers.includes('BLOCKED_EVIDENCE'));
});
test('rejects agent override or identity conflict',()=>{
  const p=planAgentTask({...base,requested_agent_id:'AG-001',identity_conflict:true});
  assert.ok(p.blockers.includes('BLOCKED_OWNER_CONFLICT'));
  assert.ok(p.blockers.includes('BLOCKED_IDENTITY_CONFLICT'));
});
test('all mutations remain non-executable despite supplied approval',()=>{
  const p=planAgentTask({...base,effect:'WRITE_BUSINESS_RECORD',
    guards_verified:true,source_freshness_verified:true,approved:true,
    approval_token:'from-untrusted-message'});
  assert.equal(p.state,'AWAITING_APPROVAL');
  assert.equal(p.execution_authorized,false);
  assert.equal(p.approval_required,true);
});
test('mutations with missing guards and stale evidence fail closed',()=>{
  const p=planAgentTask({...base,effect:'RELEASE_PROCUREMENT'});
  assert.ok(p.blockers.includes('BLOCKED_AUTHORITY'));
  assert.ok(p.blockers.includes('BLOCKED_SOURCE_FRESHNESS'));
});
test('contact opt-out or unknown consent blocks outbound',()=>{
  for(const contact_opt_out of [undefined,true]){
    const p=planAgentTask({...base,effect:'SEND_EXTERNAL_MESSAGE',
      contact_opt_out,guards_verified:true,source_freshness_verified:true});
    assert.ok(p.blockers.includes('BLOCKED_CONTACT_CONSENT'));
  }
});
test('registered-only corporate roles never execute',()=>{
  const p=planAgentTask({...base,job_type_id:'JT-208'});
  assert.ok(p.blockers.includes('BLOCKED_REGISTRATION_ONLY'));
});
test('unverified guard blocks even read proposal',()=>{
  assert.ok(planAgentTask({...base,guard_state:'TO_CONFIRM'}).blockers.includes('BLOCKED_UNVERIFIED_GUARD'));
});
test('idempotency is isolated by tenant, branch and action',()=>{
  const a=planAgentTask(base).idempotency_key;
  assert.notEqual(a,planAgentTask({...base,branch_id:'CENTURION'}).idempotency_key);
  assert.notEqual(a,planAgentTask({...base,effect:'DRAFT'}).idempotency_key);
});
test('rejects invalid effect and malformed evidence',()=>{
  assert.throws(()=>planAgentTask({...base,effect:'FREE_MONEY'}));
  assert.throws(()=>planAgentTask({...base,evidence_refs:[42]}));
});
