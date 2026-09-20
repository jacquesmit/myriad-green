'use strict';

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function normalizeKey(key) {
  if (!key || typeof key !== 'object') throw new Error('key is required');
  return {
    header: required(key.header, 'key.header'),
    value: required(key.value, 'key.value')
  };
}

function baseTarget(spec = {}) {
  const key = normalizeKey(spec.key);
  const authority = required(spec.authority, 'authority');
  if (!['AUTHORITATIVE', 'CROSS_SYSTEM_LINK'].includes(authority)) {
    throw new Error('authority must be AUTHORITATIVE or CROSS_SYSTEM_LINK');
  }
  if (authority === 'AUTHORITATIVE' && !spec.entity_type) {
    throw new Error('entity_type is required for AUTHORITATIVE writes');
  }
  if (authority === 'CROSS_SYSTEM_LINK' && !spec.link_id) {
    throw new Error('link_id is required for CROSS_SYSTEM_LINK writes');
  }

  return {
    store: required(spec.store, 'store'),
    workbook_role: required(spec.workbook_role, 'workbook_role'),
    sheet: required(spec.sheet, 'sheet'),
    key,
    authority,
    ...(spec.entity_type ? { entity_type: spec.entity_type } : {}),
    ...(spec.link_id ? { link_id: spec.link_id } : {}),
    ...(spec.require_registry === false ? { require_registry: false } : {}),
    ...(Array.isArray(spec.required_headers) && spec.required_headers.length
      ? { required_headers: [...spec.required_headers] }
      : {}),
    ...(spec.intent ? { intent: spec.intent } : {})
  };
}

function valuesWithCanonicalKey(key, values = {}) {
  const out = { ...values };
  if (Object.prototype.hasOwnProperty.call(out, key.header)) {
    if (String(out[key.header]) !== String(key.value)) {
      throw new Error(
        'values.' + key.header + ' conflicts with canonical key ' + key.value
      );
    }
  } else {
    out[key.header] = key.value;
  }
  return out;
}

function updateByKey(spec) {
  const target = baseTarget(spec);
  if (!spec.changes || typeof spec.changes !== 'object' || !Object.keys(spec.changes).length) {
    throw new Error('changes are required for UPDATE_BY_KEY');
  }
  return {
    ...target,
    operation: 'UPDATE_BY_KEY',
    changes: { ...spec.changes }
  };
}

function appendIfAbsent(spec) {
  const target = baseTarget(spec);
  return {
    ...target,
    operation: 'APPEND_IF_ABSENT',
    values: valuesWithCanonicalKey(target.key, spec.values || {})
  };
}

function createIfAbsent(spec) {
  const target = baseTarget(spec);
  return {
    ...target,
    operation: 'CREATE_IF_ABSENT',
    values: valuesWithCanonicalKey(target.key, spec.values || {})
  };
}

function upsertByKey(spec) {
  const target = baseTarget(spec);
  if (!spec.values || typeof spec.values !== 'object') {
    throw new Error('values are required for UPSERT_BY_KEY');
  }
  return {
    ...target,
    operation: 'UPSERT_BY_KEY',
    values: valuesWithCanonicalKey(target.key, spec.values),
    ...(spec.changes ? { changes: { ...spec.changes } } : {})
  };
}

function patchIfMatch(spec) {
  const target = baseTarget(spec);
  if (!spec.expect || typeof spec.expect !== 'object' || !Object.keys(spec.expect).length) {
    throw new Error('expect is required for PATCH_IF_MATCH');
  }
  if (!spec.changes || typeof spec.changes !== 'object' || !Object.keys(spec.changes).length) {
    throw new Error('changes are required for PATCH_IF_MATCH');
  }
  return {
    ...target,
    operation: 'PATCH_IF_MATCH',
    expect: { ...spec.expect },
    changes: { ...spec.changes }
  };
}

function stateTransition(spec) {
  const target = baseTarget(spec);
  const stateField = required(spec.state_field, 'state_field');
  const toState = required(spec.to_state, 'to_state');
  const fromStates = Array.isArray(spec.from_states)
    ? [...spec.from_states]
    : (spec.from_state !== undefined ? [spec.from_state] : []);

  if (!fromStates.length) throw new Error('from_state or from_states is required');

  return {
    ...target,
    operation: 'STATE_TRANSITION',
    state_field: stateField,
    from_states: fromStates,
    to_state: toState,
    ...(spec.changes ? { changes: { ...spec.changes } } : {})
  };
}

function setIfEmpty(spec) {
  const target = baseTarget(spec);
  if (!spec.values || typeof spec.values !== 'object' || !Object.keys(spec.values).length) {
    throw new Error('values are required for SET_IF_EMPTY');
  }
  return {
    ...target,
    operation: 'SET_IF_EMPTY',
    values: { ...spec.values }
  };
}

function createLinkedRecord(spec) {
  return createIfAbsent({
    ...spec,
    authority: 'CROSS_SYSTEM_LINK',
    intent: spec.intent || 'CREATE_LINKED_RECORD'
  });
}

function recordImmutableEvent(spec) {
  return createIfAbsent({
    ...spec,
    intent: spec.intent || 'RECORD_IMMUTABLE_EVENT'
  });
}

function attachEvidence(spec) {
  const field = required(spec.field || 'evidence_link', 'field');
  return updateByKey({
    ...spec,
    intent: spec.intent || 'ATTACH_EVIDENCE',
    changes: {
      ...(spec.changes || {}),
      [field]: required(spec.evidence, 'evidence')
    }
  });
}

function setSnapshot(spec) {
  const field = required(spec.field, 'field');
  return updateByKey({
    ...spec,
    intent: spec.intent || 'SET_SNAPSHOT',
    changes: {
      ...(spec.changes || {}),
      [field]: required(spec.snapshot, 'snapshot')
    }
  });
}

function registerDocument(spec) {
  return createIfAbsent({
    ...spec,
    intent: spec.intent || 'REGISTER_DOCUMENT'
  });
}

function createProcurementRequirement(spec) {
  return createIfAbsent({
    ...spec,
    intent: spec.intent || 'CREATE_PROCUREMENT_REQUIREMENT'
  });
}

function recordSupplierPrice(spec) {
  return createIfAbsent({
    ...spec,
    intent: spec.intent || 'RECORD_SUPPLIER_PRICE'
  });
}

function allocatePayment(spec) {
  return createIfAbsent({
    ...spec,
    intent: spec.intent || 'ALLOCATE_PAYMENT'
  });
}

function composeTransactionPlan({
  idempotency_key,
  event_type,
  source_event_id,
  preconditions = [],
  writes,
  transaction_id,
  trigger_type,
  input_scope,
  evidence_link
}) {
  required(idempotency_key, 'idempotency_key');
  required(event_type, 'event_type');
  required(source_event_id, 'source_event_id');
  if (!Array.isArray(preconditions)) throw new Error('preconditions must be an array');
  if (!Array.isArray(writes) || !writes.length) throw new Error('writes are required');

  return {
    ...(transaction_id ? { transaction_id } : {}),
    idempotency_key,
    event_type,
    source_event_id,
    ...(trigger_type ? { trigger_type } : {}),
    ...(input_scope ? { input_scope } : {}),
    ...(evidence_link ? { evidence_link } : {}),
    preconditions: structuredClone(preconditions),
    writes: structuredClone(writes)
  };
}

function createJobFromAcceptedScope({
  idempotency_key,
  source_event_id,
  quote_preconditions,
  job_target,
  job_changes,
  execution_target,
  execution_values,
  evidence_link,
  event_type = 'JOB_CREATE_FROM_ACCEPTED_SCOPE'
}) {
  if (!Array.isArray(quote_preconditions) || !quote_preconditions.length) {
    throw new Error('quote_preconditions are required');
  }

  return composeTransactionPlan({
    idempotency_key,
    event_type,
    source_event_id,
    evidence_link,
    preconditions: quote_preconditions,
    writes: [
      updateByKey({
        ...job_target,
        intent: 'CREATE_JOB_HEADER_FROM_ACCEPTED_SCOPE',
        changes: job_changes
      }),
      createLinkedRecord({
        ...execution_target,
        intent: 'CREATE_JOB_EXECUTION_LINK',
        values: execution_values
      })
    ]
  });
}

module.exports = {
  required,
  baseTarget,
  valuesWithCanonicalKey,
  updateByKey,
  appendIfAbsent,
  createIfAbsent,
  upsertByKey,
  patchIfMatch,
  stateTransition,
  setIfEmpty,
  createLinkedRecord,
  recordImmutableEvent,
  attachEvidence,
  setSnapshot,
  registerDocument,
  createProcurementRequirement,
  recordSupplierPrice,
  allocatePayment,
  composeTransactionPlan,
  createJobFromAcceptedScope
};
