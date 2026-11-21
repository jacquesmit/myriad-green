'use strict';

// Pure, fail-closed agent owner resolver. No filesystem, credentials, or writes.
// Input rows come from the canonical MAGOS Agent Job Allocation Matrix snapshot;
// the runtime must verify snapshot provenance and version before using it.
function reject(reason) { return { status: 'REJECTED', reason_code: reason }; }
function nonempty(v) { return typeof v === 'string' && v.trim().length > 0; }
function splitIds(value) {
  return Array.isArray(value) ? value : String(value || '').split(',');
}
function resolveAgentTask(request, { agents, jobTypes, allocations } = {}) {
  if (!request || typeof request !== 'object') return reject('INVALID_REQUEST');
  const required = ['tenant_id', 'country_id', 'region_id', 'branch_id',
    'business_record_id', 'job_type_id', 'correlation_id', 'idempotency_key'];
  if (required.some(k => !nonempty(request[k]))) return reject('MISSING_REQUIRED_SCOPE_OR_IDENTITY');
  if (!Array.isArray(agents) || !Array.isArray(jobTypes) || !Array.isArray(allocations))
    return reject('CANONICAL_REGISTRY_UNAVAILABLE');
  const typeMatches = jobTypes.filter(r => r.Job_Type_ID === request.job_type_id);
  if (typeMatches.length !== 1) return reject(typeMatches.length ? 'DUPLICATE_JOB_TYPE' : 'UNKNOWN_JOB_TYPE');
  const matches = allocations.filter(r => r.Job_Type_ID === request.job_type_id);
  if (matches.length !== 1) return reject(matches.length ? 'AMBIGUOUS_OWNER_ALLOCATION' : 'MISSING_OWNER_ALLOCATION');
  const job = typeMatches[0], allocation = matches[0];
  const owner = allocation.Primary_Agent_ID;
  if (!nonempty(owner) || job.Primary_Agent_ID !== owner) return reject('OWNER_REGISTRY_CONFLICT');
  const ids = agents.filter(r => r.Agent_ID === owner);
  if (ids.length !== 1) return reject('UNKNOWN_OR_DUPLICATE_AGENT');
  const supports = splitIds(allocation.Support_Agent_IDs).map(x => String(x).trim()).filter(Boolean);
  if (new Set(supports).size !== supports.length || supports.includes(owner))
    return reject('INVALID_SUPPORT_ALLOCATION');
  if (supports.some(id => agents.filter(a => a.Agent_ID === id).length !== 1))
    return reject('UNKNOWN_SUPPORT_AGENT');
  // Workbook's generic permissions are not executable authority grants.
  // Scope/permission/state/evidence/approval require independently validated contracts.
  return {
    status: 'REVIEW_REQUIRED',
    reason_code: 'RUNTIME_AUTHORITY_CONTRACT_NOT_VALIDATED',
    task: {
      job_type_id: request.job_type_id,
      primary_agent_id: owner,
      support_agent_ids: supports,
      tenant_id: request.tenant_id,
      country_id: request.country_id,
      region_id: request.region_id,
      branch_id: request.branch_id,
      business_record_id: request.business_record_id,
      correlation_id: request.correlation_id,
      idempotency_key: request.idempotency_key,
      mutation_authorised: false
    }
  };
}
module.exports = { resolveAgentTask };
