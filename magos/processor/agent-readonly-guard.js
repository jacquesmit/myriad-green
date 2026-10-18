'use strict';
const { resolveAgentTask } = require('./agent-owner-resolver');
function reject(reason_code) { return {status:'REJECTED',reason_code,mutation_authorised:false}; }
function inspectTask(request,catalog,manifest,ledger) {
 if (!ledger || typeof ledger.record !== 'function') return reject('AUDIT_SINK_REQUIRED');
 if (!manifest || manifest.production_dispatch_enabled !== false || manifest.lifecycle !== 'REGISTERED_NOT_ACTIVE' || !Array.isArray(manifest.agent_roles) || !Array.isArray(manifest.scoped_write_permissions) || manifest.scoped_write_permissions.length) return reject('UNVERIFIED_MANIFEST');
 const match=resolveAgentTask(request,catalog);
 if(match.status!=='REVIEW_REQUIRED' || !match.task) return match;
 const roles=manifest.agent_roles.filter(x=>x.agent_id===match.task.primary_agent_id);
 if(roles.length!==1 || roles[0].status!=='REGISTERED_NOT_ACTIVE' || !roles[0].owned_job_types.includes(request.job_type_id) || !roles[0].allowed_runtime_actions.includes('READ_ONLY_INSPECT')) return reject('AGENT_NOT_AUTHORISED');
 if(request.action!=='READ_ONLY_INSPECT')return reject('ACTION_NOT_ALLOWED');
 if(!Array.isArray(request.evidence_refs) || !request.evidence_refs.length)return reject('EVIDENCE_REQUIRED');
 const receipt={agent_id:match.task.primary_agent_id,job_type_id:request.job_type_id,correlation_id:request.correlation_id,idempotency_key:request.idempotency_key,business_record_id:request.business_record_id,evidence_refs:request.evidence_refs,state:'REVIEW_REQUIRED',mutation_authorised:false};
 if(ledger.record(receipt)!==true)return reject('AUDIT_NOT_CONFIRMED');
 return {status:'REVIEW_REQUIRED',reason_code:'STAGING_ONLY',task:match.task,receipt};
}
module.exports={inspectTask};
