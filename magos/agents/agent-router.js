'use strict';

// MAGOS AG-001 routing proposal boundary. A local snapshot is NOT live authority.
// Only existing EventEnvelope -> governed processor -> Transaction Writer may mutate.
const crypto = require('node:crypto');
const allocation = require('../rules/agent-allocation.snapshot.v1.json');
const { resolveAgentTask } = require('../processor/agent-owner-resolver');

const EFFECTS = Object.freeze(['READ', 'DRAFT', 'WRITE_BUSINESS_RECORD',
  'SEND_EXTERNAL_MESSAGE', 'ISSUE_QUOTE', 'ISSUE_INVOICE', 'RELEASE_PROCUREMENT',
  'BOOK_JOB', 'CHANGE_PRICE', 'DEPLOY_PRODUCTION', 'DELETE_RECORD', 'CHARGE_PAYMENT']);
const MUTATIONS = new Set(EFFECTS.filter(x => x !== 'READ' && x !== 'DRAFT'));
const HIGH_RISK = new Set(EFFECTS.filter(x => x !== 'READ' && x !== 'DRAFT'));
const VALID_STATES = new Set(['PROPOSED', 'AWAITING_APPROVAL', 'BLOCKED']);
const CATALOG = Object.freeze(Object.fromEntries(allocation.agents.map(x =>
  [x.agent_id, Object.freeze({name:x.name,domain:x.domain,priority:x.priority})])));
const ROUTES = new Map(allocation.jobs.map(x => [x.job_type_id,x]));

function clean(value) { return typeof value === 'string' ? value.trim() : ''; }

function planAgentTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) throw new TypeError('task must be an object');
  const job_type_id=clean(task.job_type_id).toUpperCase();
  const effect=clean(task.effect || 'READ').toUpperCase();
  const scope = ['tenant_id','jurisdiction_id','country_id','region_id','branch_id','canonical_record_id','correlation_id','source','source_event_id'];
  if (!EFFECTS.includes(effect)) throw new Error('Unknown effect: '+effect);
  const route=ROUTES.get(job_type_id);
  const evidence_refs=Array.isArray(task.evidence_refs) ? task.evidence_refs : [];
  if (!evidence_refs.every(x=>typeof x==='string' && x.trim().length>0)) {
    throw new Error('evidence_refs must be nonempty strings');
  }
  const blockers=[];
  if (!route) blockers.push('BLOCKED_UNREGISTERED_JOB_TYPE');
  if (scope.some(k=>!clean(task[k]))) blockers.push('BLOCKED_SCOPE_OR_IDENTITY');
  if (!evidence_refs.length) blockers.push('BLOCKED_EVIDENCE');
  if (task.identity_conflict===true) blockers.push('BLOCKED_IDENTITY_CONFLICT');
  if (task.guard_state === 'UNKNOWN' || task.guard_state === 'TO_CONFIRM' || task.guard_state === 'BLOCKED') blockers.push('BLOCKED_UNVERIFIED_GUARD');
  if (effect === 'SEND_EXTERNAL_MESSAGE' && task.contact_opt_out !== false) blockers.push('BLOCKED_CONTACT_CONSENT');
  if (route?.registered_only) blockers.push('BLOCKED_REGISTRATION_ONLY');
  if (MUTATIONS.has(effect) && task.guards_verified !== true) blockers.push('BLOCKED_AUTHORITY');
  if (MUTATIONS.has(effect) && task.source_freshness_verified !== true) blockers.push('BLOCKED_SOURCE_FRESHNESS');
  const catalog = {
    agents:allocation.agents.map(x=>({Agent_ID:x.agent_id})),
    jobTypes:allocation.job_types.map(x=>({Job_Type_ID:x.job_type_id,Primary_Agent_ID:x.primary_agent_id})),
    allocations:allocation.jobs.map(x=>({Job_Type_ID:x.job_type_id,Primary_Agent_ID:x.primary_agent_id,Support_Agent_IDs:x.support_agent_ids.join(',')}))
  };
  const ownerCheck=resolveAgentTask({
    tenant_id:clean(task.tenant_id),country_id:clean(task.country_id),
    region_id:clean(task.region_id),branch_id:clean(task.branch_id),
    business_record_id:clean(task.canonical_record_id),
    job_type_id,correlation_id:clean(task.correlation_id),
    idempotency_key:'ROUTING_SCOPE_CHECK'
  },catalog);
  if(ownerCheck.status!=='REVIEW_REQUIRED') blockers.push('CANONICAL_ROUTING_'+ownerCheck.reason_code);
  const agent_id=ownerCheck.task?.primary_agent_id || route?.primary_agent_id || null;
  if (route && !CATALOG[agent_id]) blockers.push('BLOCKED_OWNER_CONFLICT');
  if (task.requested_agent_id && task.requested_agent_id !== agent_id) blockers.push('BLOCKED_OWNER_CONFLICT');
  // A user/AI supplied approval flag cannot authorize or bypass the writer.
  const payload=scope.map(k=>clean(task[k]));
  const idempotency_key='agent:v2:'+crypto.createHash('sha256').update(
    JSON.stringify([job_type_id,effect,...payload])
  ).digest('hex');
  const approval_required=MUTATIONS.has(effect) || route?.human_approval === 'YES';
  return Object.freeze({
    schema_version:'MAGOS_AGENT_PLAN_V2',
    job_type_id,
    agent_id,
    supporting_agent_ids:route?.support_agent_ids || [],
    effect,
    tenant_id:clean(task.tenant_id),
    jurisdiction_id:clean(task.jurisdiction_id),
    country_id:clean(task.country_id),
    region_id:clean(task.region_id),
    correlation_id:clean(task.correlation_id),
    branch_id:clean(task.branch_id),
    canonical_record_id:clean(task.canonical_record_id),
    source:clean(task.source),
    source_event_id:clean(task.source_event_id),
    evidence_refs:[...evidence_refs],
    idempotency_key,
    state:blockers.length?'BLOCKED':approval_required?'AWAITING_APPROVAL':'PROPOSED',
    blockers:[...new Set(blockers)],
    approval_required,
    execution_authorized:false,
    next_boundary:'GOVERNED_EVENT_RUNNER',
    authority:'PROPOSAL_ONLY_SNAPSHOT_NOT_LIVE',
    qa_agent_id:job_type_id.startsWith('JT-1')?'AG-026':'AG-013'
  });
}

module.exports={CATALOG, HIGH_RISK, VALID_STATES, planAgentTask};
