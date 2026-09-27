'use strict';

const crypto = require('crypto');

const DEFAULT_IDS = {
  audit: process.env.MAGOS_AUDIT_SPREADSHEET_ID || '1Y4iP2mVCIph8MrIL51mo-KpzgUkZbWW7ZUIlkH8lOTw',
  crm: process.env.MAGOS_CRM_SPREADSHEET_ID || '1kV3qTzzXxzRPzLj1rgBDS-B0KgKU_FCw8HQwFVxlOno',
  commercial: process.env.MAGOS_COMMERCIAL_SPREADSHEET_ID || '1NJxYXRMS_6HU53wWqgSJh9jhf2jlLRa-Avi0ZfMLoNc',
  supplier: process.env.MAGOS_SUPPLIER_SPREADSHEET_ID || '11MpTf4A9S2NeCH8uQMGmDVW0Rwgit2Ze--7jLYu0Ztk'
};

const STORE_NAMES = {
  audit: 'MGOS Global Audit & Remediation Register V1',
  crm: 'Myriad Green Outreach CRM',
  commercial: 'CRM - Quote & Invoice Register 2026',
  supplier: 'Myriad Green Master Parts & Pricing Library V1'
};

function createDefaultStores() {
  const { AuditLedger } = require('../adapters/audit-ledger');
  return {
    audit: new AuditLedger({ spreadsheetId: DEFAULT_IDS.audit }),
    crm: new AuditLedger({ spreadsheetId: DEFAULT_IDS.crm }),
    commercial: new AuditLedger({ spreadsheetId: DEFAULT_IDS.commercial }),
    supplier: new AuditLedger({ spreadsheetId: DEFAULT_IDS.supplier })
  };
}

function sameValue(a, b) {
  const left = a === null || a === undefined ? '' : String(a).trim();
  const right = b === null || b === undefined ? '' : String(b).trim();
  return left === right;
}

function assertPlan(plan) {
  for (const field of ['idempotency_key', 'event_type', 'source_event_id']) {
    if (!plan?.[field]) throw new Error('TransactionPlan missing ' + field);
  }
  if (!Array.isArray(plan.preconditions)) {
    throw new Error('TransactionPlan.preconditions must be an array');
  }
  if (!Array.isArray(plan.writes) || !plan.writes.length) {
    throw new Error('TransactionPlan.writes must contain at least one mutation');
  }
}

class WriterControlError extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.name = 'WriterControlError';
    this.code = code;
    this.retryable = retryable;
  }
}

class TransactionWriter {
  constructor({ stores, auditStore, storeNames = STORE_NAMES } = {}) {
    this.stores = stores || createDefaultStores();
    this.audit = auditStore || this.stores.audit;
    this.storeNames = storeNames;
    if (!this.audit) throw new Error('audit store is required');
  }

  store(name) {
    const store = this.stores[name];
    if (!store) throw new WriterControlError('STORE_NOT_CONFIGURED', 'Unknown store: ' + name);
    return store;
  }

  async registryRows() {
    // Use AuditLedger's full default registry capacity. The live registry now exceeds
    // 300 rows; truncating here makes valid later schema rows invisible to P3.
    return this.audit.readObjects('Writer_Schema_Registry');
  }

  requiredHeadersForOperation(op) {
    return new Set([
      op.key?.header,
      op.state_field,
      ...Object.keys(op.changes || {}),
      ...Object.keys(op.values || {}),
      ...Object.keys(op.expect || {}),
      ...(op.required_headers || [])
    ].filter(Boolean));
  }

  async validateRegisteredSchema(op, cachedRegistry) {
    const store = this.store(op.store);
    const live = await store.getHeaders(op.sheet);
    const required = this.requiredHeadersForOperation(op);

    for (const header of required) {
      if (live.map[header] === undefined) {
        throw new WriterControlError(
          'LIVE_SCHEMA_MISMATCH',
          op.store + '/' + op.sheet + ' is missing live header ' + header
        );
      }
    }

    if (op.require_registry === false) return live;
    const rows = cachedRegistry.filter(
      (row) => row.workbook_role === op.workbook_role && row.sheet_name === op.sheet
    );
    for (const header of required) {
      const registered = rows.find((row) => row.expected_header === header);
      if (!registered) {
        throw new WriterControlError(
          'SCHEMA_NOT_REGISTERED',
          op.workbook_role + '/' + op.sheet + ' header not registered: ' + header
        );
      }
      const ordinal = Number(registered.ordinal_1based);
      const actual = live.headers[ordinal - 1] || '';
      if (actual !== header) {
        throw new WriterControlError(
          'LIVE_SCHEMA_ORDINAL_MISMATCH',
          op.workbook_role + '/' + op.sheet + ' expected ' + header +
          ' at ordinal ' + ordinal + ' but found ' + actual
        );
      }
    }
    return live;
  }

  async validateAuthority(op) {
    if (op.authority === 'AUTHORITATIVE') {
      const owner = await this.audit.findByKey(
        'Data_Ownership_Matrix', 'entity_type', op.entity_type
      );
      if (!owner) {
        throw new WriterControlError(
          'OWNER_NOT_FOUND',
          'No Data_Ownership_Matrix row for ' + op.entity_type
        );
      }
      const row = owner.object;
      if (row.ownership_status !== 'PASS') {
        throw new WriterControlError(
          'OWNER_NOT_PASS',
          op.entity_type + ' ownership is not PASS'
        );
      }
      if (row.source_of_truth_tab !== op.sheet) {
        throw new WriterControlError(
          'WRONG_AUTHORITY_TAB',
          op.entity_type + ' is owned by ' + row.source_of_truth_tab + ', not ' + op.sheet
        );
      }
      const expectedWorkbook = this.storeNames[op.store];
      if (expectedWorkbook && row.source_of_truth_workbook !== expectedWorkbook) {
        throw new WriterControlError(
          'WRONG_AUTHORITY_WORKBOOK',
          op.entity_type + ' is owned by ' + row.source_of_truth_workbook +
          ', not ' + expectedWorkbook
        );
      }
      return;
    }

    if (op.authority === 'CROSS_SYSTEM_LINK') {
      if (!op.link_id) {
        throw new WriterControlError(
          'LINK_ID_REQUIRED',
          'Cross-system mutation requires link_id'
        );
      }
      const link = await this.audit.findByKey(
        'Cross_System_Links', 'link_id', op.link_id
      );
      if (!link) {
        throw new WriterControlError(
          'LINK_NOT_FOUND',
          'Missing Cross_System_Links row ' + op.link_id
        );
      }
      if (link.object.automation_status !== 'ACTIVE') {
        throw new WriterControlError(
          'LINK_NOT_ACTIVE',
          op.link_id + ' automation_status=' + link.object.automation_status
        );
      }
      if (link.object.destination_tab !== op.sheet) {
        throw new WriterControlError(
          'LINK_DESTINATION_MISMATCH',
          op.link_id + ' targets ' + link.object.destination_tab + ', not ' + op.sheet
        );
      }
      return;
    }

    throw new WriterControlError(
      'AUTHORITY_MODE_REQUIRED',
      'Mutation must declare AUTHORITATIVE or CROSS_SYSTEM_LINK'
    );
  }

  async validatePreconditions(preconditions) {
    for (const pre of preconditions) {
      const store = this.store(pre.store);
      const found = await store.findByKey(
        pre.sheet, pre.key.header, pre.key.value
      );
      if (!found) {
        throw new WriterControlError(
          'PRECONDITION_ROW_NOT_FOUND',
          pre.store + '/' + pre.sheet + ' missing ' +
          pre.key.header + '=' + pre.key.value,
          { retryable: true }
        );
      }
      for (const [field, expected] of Object.entries(pre.expect || {})) {
        if (!sameValue(found.object[field], expected)) {
          throw new WriterControlError(
            'PRECONDITION_FAILED',
            pre.store + '/' + pre.sheet + ' ' + field +
            ' expected=' + expected + ' actual=' + found.object[field],
            { retryable: true }
          );
        }
      }
    }
  }

  assertAppendKey(op, values) {
    if (!Object.prototype.hasOwnProperty.call(values, op.key.header)) {
      throw new WriterControlError(
        'CANONICAL_KEY_MISSING',
        op.store + '/' + op.sheet + ' append is missing canonical key field ' +
        op.key.header
      );
    }
    if (!sameValue(values[op.key.header], op.key.value)) {
      throw new WriterControlError(
        'CANONICAL_KEY_CONFLICT',
        op.store + '/' + op.sheet + ' append key ' + op.key.header +
        ' expected=' + op.key.value + ' actual=' + values[op.key.header]
      );
    }
  }

  async updateExisting(op, store, existing, desired) {
    const entries = Object.entries(desired || {});
    if (!entries.length) {
      throw new WriterControlError(
        'EMPTY_UPDATE',
        op.operation + ' requires at least one field to change'
      );
    }

    const already = entries.every(([field, value]) =>
      sameValue(existing.object[field], value)
    );
    if (already) {
      return {
        noOp: true,
        compensation: null,
        affected: op.key.value,
        readback: existing.object
      };
    }

    const before = {};
    for (const [field] of entries) {
      before[field] = existing.object[field] ?? '';
    }

    await store.updateFieldsByKey(
      op.sheet, op.key.header, op.key.value, desired
    );

    const readback = await store.findByKey(
      op.sheet, op.key.header, op.key.value
    );
    for (const [field, expected] of entries) {
      if (!readback || !sameValue(readback.object[field], expected)) {
        throw new WriterControlError(
          'WRITE_READBACK_FAILED',
          op.store + '/' + op.sheet + ' failed read-back for ' + field,
          { retryable: true }
        );
      }
    }

    return {
      noOp: false,
      compensation: {
        type: 'UPDATE_BY_KEY',
        store: op.store,
        sheet: op.sheet,
        key: op.key,
        changes: before
      },
      affected: op.key.value,
      readback: readback.object
    };
  }

  async appendNew(op, store, values) {
    this.assertAppendKey(op, values);
    await store.appendObject(op.sheet, values);

    const readback = await store.findByKey(
      op.sheet, op.key.header, op.key.value
    );
    if (!readback) {
      throw new WriterControlError(
        'APPEND_READBACK_FAILED',
        op.store + '/' + op.sheet + ' append not found by canonical key',
        { retryable: true }
      );
    }

    for (const [field, expected] of Object.entries(values)) {
      if (!sameValue(readback.object[field], expected)) {
        throw new WriterControlError(
          'APPEND_READBACK_FAILED',
          op.store + '/' + op.sheet + ' read-back mismatch for ' + field,
          { retryable: true }
        );
      }
    }

    return {
      noOp: false,
      compensation: {
        type: 'DELETE_BY_KEY',
        store: op.store,
        sheet: op.sheet,
        key: op.key
      },
      affected: op.key.value,
      readback: readback.object
    };
  }

  async applyMutation(op) {
    const store = this.store(op.store);
    const existing = await store.findByKey(
      op.sheet, op.key.header, op.key.value
    );
    const operation = op.operation === 'CREATE_IF_ABSENT'
      ? 'APPEND_IF_ABSENT'
      : op.operation;

    if (operation === 'UPDATE_BY_KEY') {
      if (!existing) {
        throw new WriterControlError(
          'WRITE_TARGET_NOT_FOUND',
          op.store + '/' + op.sheet + ' missing ' +
          op.key.header + '=' + op.key.value,
          { retryable: true }
        );
      }
      return this.updateExisting(op, store, existing, op.changes || {});
    }

    if (operation === 'APPEND_IF_ABSENT') {
      const desired = op.values || {};
      this.assertAppendKey(op, desired);
      if (existing) {
        const same = Object.entries(desired).every(([field, value]) =>
          sameValue(existing.object[field], value)
        );
        if (!same) {
          throw new WriterControlError(
            'APPEND_KEY_CONFLICT',
            op.store + '/' + op.sheet + ' already contains conflicting ' +
            op.key.header + '=' + op.key.value
          );
        }
        return {
          noOp: true,
          compensation: null,
          affected: op.key.value,
          readback: existing.object
        };
      }
      return this.appendNew(op, store, desired);
    }

    if (operation === 'UPSERT_BY_KEY') {
      if (existing) {
        const desired = op.changes && Object.keys(op.changes).length
          ? op.changes
          : op.values;
        return this.updateExisting(op, store, existing, desired || {});
      }
      return this.appendNew(op, store, op.values || {});
    }

    if (operation === 'PATCH_IF_MATCH') {
      if (!existing) {
        throw new WriterControlError(
          'WRITE_TARGET_NOT_FOUND',
          op.store + '/' + op.sheet + ' missing ' +
          op.key.header + '=' + op.key.value,
          { retryable: true }
        );
      }
      for (const [field, expected] of Object.entries(op.expect || {})) {
        if (!sameValue(existing.object[field], expected)) {
          throw new WriterControlError(
            'PATCH_EXPECTATION_FAILED',
            op.store + '/' + op.sheet + ' ' + field +
            ' expected=' + expected + ' actual=' + existing.object[field],
            { retryable: true }
          );
        }
      }
      return this.updateExisting(op, store, existing, op.changes || {});
    }

    if (operation === 'STATE_TRANSITION') {
      if (!existing) {
        throw new WriterControlError(
          'WRITE_TARGET_NOT_FOUND',
          op.store + '/' + op.sheet + ' missing ' +
          op.key.header + '=' + op.key.value,
          { retryable: true }
        );
      }
      if (!op.state_field || op.to_state === undefined) {
        throw new WriterControlError(
          'STATE_TRANSITION_INVALID',
          'STATE_TRANSITION requires state_field and to_state'
        );
      }

      const current = existing.object[op.state_field] ?? '';
      const allowed = Array.isArray(op.from_states)
        ? op.from_states
        : (op.from_state !== undefined ? [op.from_state] : []);

      if (!sameValue(current, op.to_state) &&
          !allowed.some((state) => sameValue(current, state))) {
        throw new WriterControlError(
          'STATE_TRANSITION_REJECTED',
          op.store + '/' + op.sheet + ' ' + op.state_field +
          ' cannot transition from ' + current + ' to ' + op.to_state,
          { retryable: true }
        );
      }

      return this.updateExisting(op, store, existing, {
        ...(op.changes || {}),
        [op.state_field]: op.to_state
      });
    }

    if (operation === 'SET_IF_EMPTY') {
      if (!existing) {
        throw new WriterControlError(
          'WRITE_TARGET_NOT_FOUND',
          op.store + '/' + op.sheet + ' missing ' +
          op.key.header + '=' + op.key.value,
          { retryable: true }
        );
      }

      const toWrite = {};
      for (const [field, desired] of Object.entries(op.values || {})) {
        const current = existing.object[field] ?? '';
        if (sameValue(current, desired)) continue;
        if (!sameValue(current, '')) {
          throw new WriterControlError(
            'FIELD_NOT_EMPTY',
            op.store + '/' + op.sheet + ' ' + field +
            ' already has value=' + current
          );
        }
        toWrite[field] = desired;
      }

      if (!Object.keys(toWrite).length) {
        return {
          noOp: true,
          compensation: null,
          affected: op.key.value,
          readback: existing.object
        };
      }

      return this.updateExisting(op, store, existing, toWrite);
    }

    throw new WriterControlError(
      'OPERATION_NOT_SUPPORTED',
      'Unsupported operation ' + op.operation
    );
  }

  async compensate(records) {
    const outcomes = [];
    for (const record of [...records].reverse()) {
      try {
        const store = this.store(record.store);
        if (record.type === 'UPDATE_BY_KEY') {
          await store.updateFieldsByKey(
            record.sheet,
            record.key.header,
            record.key.value,
            record.changes
          );
        } else if (record.type === 'DELETE_BY_KEY') {
          await store.deleteRowByKey(
            record.sheet,
            record.key.header,
            record.key.value
          );
        }
        outcomes.push({ ok: true, record });
      } catch (error) {
        outcomes.push({
          ok: false,
          record,
          error: error.message
        });
      }
    }
    return outcomes;
  }

  desiredFieldsForOperation(op, existing) {
    const operation =
      op.operation === 'CREATE_IF_ABSENT'
        ? 'APPEND_IF_ABSENT'
        : op.operation;

    if (operation === 'UPDATE_BY_KEY' || operation === 'PATCH_IF_MATCH') {
      return op.changes || {};
    }
    if (operation === 'APPEND_IF_ABSENT') return op.values || {};
    if (operation === 'UPSERT_BY_KEY') {
      if (existing && op.changes && Object.keys(op.changes).length) {
        return op.changes;
      }
      return op.values || {};
    }
    if (operation === 'STATE_TRANSITION') {
      return {
        ...(op.changes || {}),
        [op.state_field]: op.to_state
      };
    }
    if (operation === 'SET_IF_EMPTY') return op.values || {};
    return {};
  }

  async inspectPlanState(plan) {
    assertPlan(plan);
    const writerRun = await this.audit.findByKey(
      'Automation_Run_Log',
      'idempotency_key',
      plan.idempotency_key
    );
    const writes = [];

    for (const op of plan.writes) {
      const store = this.store(op.store);
      const existing = await store.findByKey(
        op.sheet,
        op.key.header,
        op.key.value
      );
      const operation =
        op.operation === 'CREATE_IF_ABSENT'
          ? 'APPEND_IF_ABSENT'
          : op.operation;

      if (!existing) {
        writes.push({
          store: op.store,
          sheet: op.sheet,
          key: op.key,
          operation,
          state: ['APPEND_IF_ABSENT', 'UPSERT_BY_KEY'].includes(operation)
            ? 'NOT_APPLIED'
            : 'CONFLICT'
        });
        continue;
      }

      const desired = this.desiredFieldsForOperation(op, existing.object);
      const entries = Object.entries(desired);
      const matched = entries.filter(([field, value]) =>
        sameValue(existing.object[field], value)
      ).length;

      let state = 'CONFLICT';
      if (entries.length && matched === entries.length) state = 'APPLIED';
      else if (operation !== 'APPEND_IF_ABSENT' && matched === 0) {
        state = 'NOT_APPLIED';
      } else if (matched > 0) {
        state = 'PARTIAL';
      }

      writes.push({
        store: op.store,
        sheet: op.sheet,
        key: op.key,
        operation,
        state
      });
    }

    const allApplied =
      writes.length > 0 &&
      writes.every((item) => item.state === 'APPLIED');
    const allNotApplied =
      writes.length > 0 &&
      writes.every((item) => item.state === 'NOT_APPLIED');

    return {
      writer_run: writerRun?.object || null,
      writer_run_state: writerRun?.object?.run_state || '',
      business_state: allApplied
        ? 'APPLIED'
        : (allNotApplied ? 'NOT_APPLIED' : 'PARTIAL_OR_CONFLICT'),
      writes
    };
  }

  async reconcileStalePlan(plan) {
    const inspection = await this.inspectPlanState(plan);
    const auditState = inspection.writer_run_state;
    const exceptionKey = 'writer:' + plan.idempotency_key;

    const failClosed = async (reasonCode, reason) => {
      if (inspection.writer_run) {
        await this.audit.completeRun(plan.idempotency_key, {
          state: 'FAILED',
          affectedRecordIds:
            inspection.writer_run.affected_record_ids || '',
          writesSummary:
            inspection.writer_run.writes_summary || '',
          readbackSummary:
            'Stale execution reconciliation failed closed. business_state=' +
            inspection.business_state,
          errorOrBlocker: reasonCode + ': ' + reason
        });
      }

      await this.audit.raiseSyncException({
        idempotencyKey: exceptionKey,
        entityType: plan.event_type,
        recordId: plan.source_event_id,
        destinationSystem: 'MAGOS authoritative stores',
        exceptionType: reasonCode,
        severity: 'HIGH',
        sourceValue: plan.idempotency_key,
        destinationValue: JSON.stringify(inspection.writes),
        actionRequired:
          'Investigate stale EXECUTING reconciliation before replay. Preserve original event and writer idempotency keys.',
        evidence: plan.evidence_link || ''
      });

      return {
        state: 'FAILED',
        reason_code: reasonCode,
        reason,
        inspection,
        writer_run: inspection.writer_run
      };
    };

    if (auditState === 'COMMITTED') {
      if (inspection.business_state !== 'APPLIED') {
        return failClosed(
          'STALE_COMMITTED_READBACK_MISMATCH',
          'P3 audit is COMMITTED but authoritative read-back does not match every declared write.'
        );
      }
      return {
        state: 'COMMITTED',
        reason_code: 'STALE_EXECUTING_RECONCILED_COMMITTED',
        reason:
          'P3 audit is COMMITTED and all declared authoritative writes read back exactly.',
        inspection,
        writer_run: inspection.writer_run
      };
    }

    if (auditState === 'RUNNING') {
      if (inspection.business_state === 'APPLIED') {
        await this.audit.completeRun(plan.idempotency_key, {
          state: 'COMMITTED',
          affectedRecordIds:
            inspection.writer_run?.affected_record_ids || '',
          writesSummary:
            inspection.writer_run?.writes_summary ||
            'Recovered stale RUNNING transaction by exact authoritative read-back.',
          readbackSummary:
            'All declared fields read back exactly during stale RUNNING reconciliation.',
          errorOrBlocker: ''
        });
        await this.audit.resolveSyncException(
          exceptionKey,
          plan.evidence_link || ''
        );
        const reconciled = await this.audit.findByKey(
          'Automation_Run_Log',
          'idempotency_key',
          plan.idempotency_key
        );
        return {
          state: 'COMMITTED',
          reason_code: 'STALE_RUNNING_RECONCILED_COMMITTED',
          reason:
            'Stale P3 RUNNING audit reconciled to COMMITTED after exact authoritative read-back.',
          inspection,
          writer_run: reconciled?.object || inspection.writer_run
        };
      }

      if (inspection.business_state === 'NOT_APPLIED') {
        await this.audit.completeRun(plan.idempotency_key, {
          state: 'RETRY_REQUIRED',
          affectedRecordIds: '',
          writesSummary: '',
          readbackSummary:
            'No declared business mutation is present after stale RUNNING execution.',
          errorOrBlocker:
            'STALE_RUNNING_NO_BUSINESS_MUTATION: safe same-key retry required.'
        });
        await this.audit.raiseSyncException({
          idempotencyKey: exceptionKey,
          entityType: plan.event_type,
          recordId: plan.source_event_id,
          destinationSystem: 'MAGOS authoritative stores',
          exceptionType: 'STALE_RUNNING_NO_BUSINESS_MUTATION',
          severity: 'HIGH',
          sourceValue: plan.idempotency_key,
          destinationValue: 'No declared business mutation present.',
          actionRequired:
            'Replay the original event with the same idempotency key after stale-run reconciliation.',
          evidence: plan.evidence_link || ''
        });
        const retryRun = await this.audit.findByKey(
          'Automation_Run_Log',
          'idempotency_key',
          plan.idempotency_key
        );
        return {
          state: 'RETRY_REQUIRED',
          reason_code: 'STALE_RUNNING_NO_BUSINESS_MUTATION',
          reason:
            'Stale P3 RUNNING audit has no declared business mutation; same-key retry is safe.',
          inspection,
          writer_run: retryRun?.object || inspection.writer_run
        };
      }

      return failClosed(
        'STALE_RUNNING_PARTIAL_OR_CONFLICT',
        'Stale P3 RUNNING execution has partial or conflicting authoritative state.'
      );
    }

    if (auditState === 'RETRY_REQUIRED') {
      if (inspection.business_state === 'NOT_APPLIED') {
        return {
          state: 'RETRY_REQUIRED',
          reason_code: 'STALE_EXECUTING_WRITER_RETRY_REQUIRED',
          reason:
            'P3 already records RETRY_REQUIRED and no declared mutation remains.',
          inspection,
          writer_run: inspection.writer_run
        };
      }
      return failClosed(
        'STALE_RETRY_READBACK_CONFLICT',
        'P3 records RETRY_REQUIRED but authoritative state is not cleanly unapplied.'
      );
    }

    if (auditState === 'FAILED') {
      return {
        state: 'FAILED',
        reason_code: 'STALE_EXECUTING_WRITER_FAILED',
        reason:
          inspection.writer_run?.error_or_blocker ||
          'P3 writer already records FAILED.',
        inspection,
        writer_run: inspection.writer_run
      };
    }

    if (!inspection.writer_run) {
      if (inspection.business_state === 'NOT_APPLIED') {
        return {
          state: 'RETRY_REQUIRED',
          reason_code: 'STALE_EXECUTING_NO_WRITER_RUN',
          reason:
            'No P3 writer run exists and no declared business mutation is present; same-key retry is safe.',
          inspection,
          writer_run: null
        };
      }
      return failClosed(
        'STALE_EXECUTING_UNAUDITED_MUTATION',
        'No P3 writer audit exists but authoritative state is applied, partial, or conflicting.'
      );
    }

    return failClosed(
      'STALE_EXECUTING_UNKNOWN_WRITER_STATE',
      'Unsupported P3 writer run_state=' + auditState
    );
  }

  async execute(plan) {
    assertPlan(plan);
    const transactionId = plan.transaction_id || 'TXN-' + crypto.randomUUID();
    const exceptionKey = 'writer:' + plan.idempotency_key;

    const begin = await this.audit.beginRun({
      idempotencyKey: plan.idempotency_key,
      inputScope: plan.input_scope || plan.event_type,
      evidenceLink: plan.evidence_link || '',
      triggerType: plan.trigger_type || 'MAGOS_TRANSACTION',
      automationId: 'MAGOS-TRANSACTION-WRITER-V1'
    });

    if (begin.duplicate) {
      return {
        transaction_id: transactionId,
        state: 'DUPLICATE_NO_OP',
        duplicate: true,
        existing_run: begin.existing
      };
    }

    const applied = [];
    const affected = [];
    const summaries = [];

    try {
      const registry = await this.registryRows();
      for (const op of plan.writes) {
        await this.validateAuthority(op);
        await this.validateRegisteredSchema(op, registry);
      }

      await this.validatePreconditions(plan.preconditions);

      for (const op of plan.writes) {
        const result = await this.applyMutation(op);
        if (result.compensation) applied.push(result.compensation);
        affected.push(result.affected);
        summaries.push(
          (op.intent ? op.intent + ': ' : '') +
          op.operation + ' ' + op.store + '/' + op.sheet + ' ' +
          op.key.header + '=' + op.key.value +
          (result.noOp ? ' [NO_OP]' : ' [WRITTEN]')
        );
      }

      await this.audit.completeRun(plan.idempotency_key, {
        state: 'COMMITTED',
        affectedRecordIds: [...new Set(affected)].join(' | '),
        writesSummary: summaries.join('; '),
        readbackSummary:
          'All declared fields read back from live headers and canonical keys.',
        errorOrBlocker: ''
      });

      await this.audit.resolveSyncException(
        exceptionKey,
        plan.evidence_link || ''
      );

      const auditReadback = await this.audit.findByKey(
        'Automation_Run_Log',
        'idempotency_key',
        plan.idempotency_key
      );

      if (!auditReadback || auditReadback.object.run_state !== 'COMMITTED') {
        throw new WriterControlError(
          'AUDIT_READBACK_FAILED',
          'Automation_Run_Log did not read back COMMITTED',
          { retryable: true }
        );
      }

      return {
        transaction_id: transactionId,
        state: 'COMMITTED',
        duplicate: false,
        affected_record_ids: [...new Set(affected)],
        writes: summaries,
        audit: auditReadback.object
      };
    } catch (error) {
      const compensation = applied.length
        ? await this.compensate(applied)
        : [];
      const compensationFailed = compensation.some((item) => !item.ok);
      const state = compensationFailed ? 'FAILED' : 'RETRY_REQUIRED';
      const errorText =
        (error.code ? error.code + ': ' : '') + error.message;

      try {
        await this.audit.completeRun(plan.idempotency_key, {
          state,
          affectedRecordIds: [...new Set(affected)].join(' | '),
          writesSummary: summaries.join('; '),
          readbackSummary: compensation.length
            ? 'Failure path executed; compensation=' +
              JSON.stringify(
                compensation.map((x) => ({
                  ok: x.ok,
                  type: x.record.type
                }))
              )
            : 'Failure occurred before business mutation; no compensation required.',
          errorOrBlocker: errorText
        });

        await this.audit.raiseSyncException({
          idempotencyKey: exceptionKey,
          entityType: plan.event_type,
          recordId: plan.source_event_id,
          destinationSystem: 'MAGOS authoritative stores',
          exceptionType: error.code || 'TRANSACTION_WRITE_FAILURE',
          severity: compensationFailed ? 'CRITICAL' : 'HIGH',
          sourceValue: plan.idempotency_key,
          destinationValue: errorText,
          actionRequired:
            'Correct the recorded control failure and replay the same idempotency key. Do not create a second business record.',
          evidence: plan.evidence_link || ''
        });
      } catch (auditError) {
        return {
          transaction_id: transactionId,
          state: 'FAILED',
          duplicate: false,
          error: errorText,
          audit_error: auditError.message,
          compensation
        };
      }

      return {
        transaction_id: transactionId,
        state,
        duplicate: false,
        error: errorText,
        compensation
      };
    }
  }
}

module.exports = {
  TransactionWriter,
  WriterControlError,
  DEFAULT_IDS,
  STORE_NAMES,
  sameValue
};
