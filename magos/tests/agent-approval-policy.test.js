'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planAgentTask}=require('../agents/agent-router');
const {verifyAgentApproval}=require('../agents/agent-approval-policy');
const task={
  job_type_id:'JT-007',tenant_id:'MYRIAD_GREEN',jurisdiction_id:'ZA',
  branch_id:'PRETORIA',canonical_record_id:'PAY-TEST-1',source:'GMAIL',
  source_event_id:'MSG-TEST-10',evidence_refs:['test:bank:10'],
  effect:'WRITE_BUSINESS_RECORD',guards_verified:true,source_freshness_verified:true
};
const p=planAgentTask(task);
const now=new Date('2026-11-21T13:00:00Z');
const receipt={
  origin:'CANONICAL_APPROVAL_STORE',approval_id:'APP-TEST-10',
  plan_idempotency_key:p.idempotency_key,tenant_id:p.tenant_id,
  jurisdiction_id:p.jurisdiction_id,branch_id:p.branch_id,
  canonical_record_id:p.canonical_record_id,job_type_id:p.job_type_id,
  status:'APPROVED',approved_by:'OWNER-TEST',implemented_by:'AG-010',
  evidence_ref:'test:approval:10',approved_at:'2026-11-21T12:00:00Z',
  expires_at:'2026-11-21T14:00:00Z',
  approval_receipt_validated_by_trusted_adapter:true,used:false
};
const liveAuthority={
  verified:true,owner_agent_id:p.agent_id,job_type_id:p.job_type_id,
  permissions_verified:true,snapshot_matches_current:true,source_freshness_verified:true
};
test('independent approval only makes a task eligible for further governed event review',()=>{
 const r=verifyAgentApproval(p,{receipt,liveAuthority,now});
 assert.equal(r.status,'ELIGIBLE_FOR_GOVERNED_EVENT_REVIEW');
 assert.equal(r.execution_authorized,false);
});
test('approval from inbound AI payload is not canonical',()=>{
 const r=verifyAgentApproval(p,{receipt:{...receipt,origin:'AI_PROMPT'},liveAuthority,now});
 assert.ok(r.blockers.includes('CANONICAL_APPROVAL_MISSING'));
});
test('mismatched branch and task cannot use another approval',()=>{
 const r=verifyAgentApproval(p,{receipt:{...receipt,branch_id:'JOHANNESBURG',plan_idempotency_key:'OTHER'},liveAuthority,now});
 assert.ok(r.blockers.includes('APPROVAL_SCOPE_MISMATCH'));
 assert.ok(r.blockers.includes('APPROVAL_PLAN_MISMATCH'));
});
test('agent cannot self approve',()=>{
 const r=verifyAgentApproval(p,{receipt:{...receipt,approved_by:'AG-010'},liveAuthority,now});
 assert.ok(r.blockers.includes('SELF_APPROVAL'));
});
test('stale registry or missing verified permissions blocks',()=>{
 const r=verifyAgentApproval(p,{receipt,liveAuthority:{...liveAuthority,permissions_verified:false,snapshot_matches_current:false},now});
 assert.ok(r.blockers.includes('PERMISSIONS_NOT_VERIFIED'));
 assert.ok(r.blockers.includes('STALE_ALLOCATION_SNAPSHOT'));
});
test('expired or replayed approval blocks',()=>{
 const r=verifyAgentApproval(p,{receipt:{...receipt,expires_at:'2026-11-21T12:30:00Z',used:true},liveAuthority,now});
 assert.ok(r.blockers.includes('APPROVAL_EXPIRED_OR_INVALID'));
 assert.ok(r.blockers.includes('APPROVAL_REPLAY'));
});
test('no trusted provider verification means blocked',()=>{
 const r=verifyAgentApproval(p,{receipt:{...receipt,approval_receipt_validated_by_trusted_adapter:false},liveAuthority,now});
 assert.ok(r.blockers.includes('APPROVAL_PROVENANCE_NOT_VERIFIED'));
});
test('blocked plan cannot become eligible through approval',()=>{
 const blocked=planAgentTask({...task,tenant_id:''});
 const r=verifyAgentApproval(blocked,{receipt,liveAuthority,now});
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.blockers.includes('INVALID_OR_BLOCKED_PLAN'));
});
test('missing authority blocks',()=>{
 const r=verifyAgentApproval(p,{receipt,now});
 assert.ok(r.blockers.includes('LIVE_AUTHORITY_NOT_VERIFIED'));
});
