'use strict';

// Reuses existing MAGOS Sync_Exceptions, not a competing agent task database.
// This adapter is NOT exposed to unauthenticated sources. It never executes
// agent tasks or approves its own queued review.
const { AuditLedger } = require('../adapters/audit-ledger');
function reviewKey(plan) { return 'review:agent:'+String(plan.idempotency_key); }

class AgentReviewQueue {
  constructor({ ledger }={}) { this.ledger=ledger||new AuditLedger(); }
  async enqueue(plan) {
    if (!plan || plan.schema_version!=='MAGOS_AGENT_PLAN_V2' ||
      !['BLOCKED','AWAITING_APPROVAL'].includes(plan.state) ||
      plan.execution_authorized!==false || !plan.idempotency_key ||
      !plan.canonical_record_id) throw new Error('Invalid agent review proposal');
    const key=reviewKey(plan);
    const prior=await this.ledger.findByKey('Sync_Exceptions','idempotency_key',key);
    if(prior) {
      return {state:'DUPLICATE_NO_OP',review_key:key,exception_id:prior.object.exception_id};
    }
    // Compact, non-sensitive review metadata only. Do not copy untrusted
    // full provider messages, internal margin/pricing or personal data.
    const summary={
      schema_version:plan.schema_version,job_type_id:plan.job_type_id,
      agent_id:plan.agent_id,tenant_id:plan.tenant_id,
      jurisdiction_id:plan.jurisdiction_id,branch_id:plan.branch_id,
      canonical_record_id:plan.canonical_record_id,
      source:plan.source,source_event_id:plan.source_event_id,
      effect:plan.effect,state:plan.state,blockers:plan.blockers,
      idempotency_key:plan.idempotency_key
    };
    const exception_id=await this.ledger.raiseSyncException({
      idempotencyKey:key,entityType:'MAGOS_AGENT_TASK_REVIEW',
      recordId:plan.canonical_record_id,sourceSystem:'MAGOS AG-001',
      destinationSystem:'MAGOS AG-030 / AG-013',
      exceptionType:plan.state==='BLOCKED'?'AGENT_TASK_BLOCKED':'AGENT_APPROVAL_REQUIRED',
      severity:'MEDIUM',sourceValue:JSON.stringify(summary),destinationValue:'',
      actionRequired:'Validate live ownership, scope, source evidence and approval using existing MAGOS governance before any child event. Do not authorize this proposal directly.',
      evidence:plan.evidence_refs[0]||'',ruleId:'MAGOS-AGENT-ORCHESTRATION-V2'
    });
    const readback=await this.ledger.findByKey('Sync_Exceptions','idempotency_key',key);
    if(!readback || readback.object.exception_id!==exception_id ||
       readback.object.record_id!==plan.canonical_record_id) {
      throw new Error('AGENT_REVIEW_READBACK_FAILED');
    }
    return {state:'REVIEW_RECORDED',review_key:key,exception_id};
  }
}
module.exports={AgentReviewQueue,reviewKey};
