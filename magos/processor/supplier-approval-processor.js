'use strict';

const { EventProcessor } = require('./event-processor');
const { stateTransition, composeTransactionPlan } = require('../writer/operations');

const STATES = Object.freeze(['VETTING', 'APPROVED', 'EXCLUDED', 'SUSPENDED']);

function normalized(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}
function approvalChange(envelope) {
  return envelope?.payload?.supplier_approval_change || {};
}
function reviewDecision(decision, code, reason) {
  return {
    ...decision,
    decision: 'REVIEW_REQUIRED',
    reason_code: code,
    reason,
    transaction_plan: undefined,
    review: {
      queue: 'Sync_Exceptions',
      event_id: decision.event_id,
      required_human_decision: true
    }
  };
}

async function resolveSupplierApproval(envelope, lookupService) {
  const change = approvalChange(envelope);
  const id = normalized(change.supplier_id);
  if (!id || id !== normalized(envelope?.entity_hints?.supplier_id)) {
    return { status: 'CONFLICT', basis: 'NONE', confidence: 0, reason: 'Exact matching supplier_id is required in payload and entity_hints.' };
  }
  const supplier = await lookupService.findEntityByCanonicalId('Supplier', id);
  if (!supplier || normalized(supplier.supplier_id) !== id) {
    return { status: 'UNRESOLVED', basis: 'EXACT_ID', confidence: 0, reason: 'Canonical supplier_id not found.' };
  }
  const current = normalized(supplier.supplier_approval_state);
  const expected = normalized(change.from_state);
  if (current !== expected) {
    return { status: 'CONFLICT', basis: 'EXACT_ID', confidence: 0, reason: 'Authoritative supplier approval state differs from declared from_state.' };
  }
  return {
    status: 'MATCHED',
    basis: 'EXACT_ID',
    confidence: 1,
    canonical_ids: { supplier_id: id },
    supplier: {
      supplier_id: id,
      supplier_approval_state: current,
      active_status: supplier.active_status
    }
  };
}

function planSupplierApproval(envelope, match) {
  const change = approvalChange(envelope);
  const from = normalized(change.from_state);
  const to = normalized(change.to_state);
  if (!STATES.includes(from) || !STATES.includes(to) || from === to) {
    throw new Error('Approval transition must change between supported lifecycle states.');
  }
  if (!match?.supplier || from !== match.supplier.supplier_approval_state) {
    throw new Error('Authoritative expected current state mismatch.');
  }
  const evidenceLink = normalized(envelope.evidence?.[0]?.ref);
  if (!evidenceLink) throw new Error('Approval authority evidence is required.');
  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    input_scope: 'SUPPLIER_APPROVAL_GOVERNANCE',
    evidence_link: evidenceLink,
    preconditions: [],
    writes: [
      stateTransition({
        store: 'supplier',
        workbook_role: 'SUPPLIER',
        sheet: 'Suppliers',
        key: { header: 'supplier_id', value: change.supplier_id },
        authority: 'AUTHORITATIVE',
        entity_type: 'Supplier',
        intent: 'GOVERNED_SUPPLIER_APPROVAL_CHANGE',
        state_field: 'supplier_approval_state',
        from_state: from,
        to_state: to,
        required_headers: ['supplier_id', 'supplier_approval_state', 'active_status']
      })
    ]
  });
}

function createSupplierApprovalProcessor({ lookupService } = {}) {
  if (!lookupService || typeof lookupService.findEntityByCanonicalId !== 'function') {
    throw new Error('Exact supplier lookup service required.');
  }
  const base = new EventProcessor({
    resolver: (envelope) => resolveSupplierApproval(envelope, lookupService),
    planner: planSupplierApproval
  });
  return {
    async decide(envelope) {
      // Only the existing authenticated governance ingress may submit an authorized event.
      // An approval decision is NOT inferred from supplier emails or identity fields.
      const change = approvalChange(envelope);
      const allowed = envelope?.source === 'MGOS_GOVERNANCE' &&
        envelope?.metadata?.approval_authorized === true &&
        Boolean(normalized(envelope?.actor?.id || envelope?.actor?.actor_id)) &&
        Boolean(normalized(change.supplier_id)) &&
        STATES.includes(normalized(change.from_state)) &&
        STATES.includes(normalized(change.to_state)) &&
        normalized(change.from_state) !== normalized(change.to_state);
      const decision = await base.decide(envelope);
      if (!allowed && decision.decision === 'AUTO_WRITE') {
        return reviewDecision(decision, 'SUPPLIER_APPROVAL_AUTHORITY_REQUIRED', 'Governance source, authorization attestation, actor ID and valid transition are required.');
      }
      return decision;
    }
  };
}
module.exports = { STATES, resolveSupplierApproval, planSupplierApproval, createSupplierApprovalProcessor };
