'use strict';

const crypto = require('crypto');
const { google } = require('googleapis');
const { createGoogleAuth } = require('./google-auth');

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_AUDIT_ID = '1Y4iP2mVCIph8MrIL51mo-KpzgUkZbWW7ZUIlkH8lOTw';

function nowSast() {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(new Date()).replace(',', '');
}

function columnLetter(indexZeroBased) {
  let n = indexZeroBased + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

class AuditLedger {
  constructor({
    spreadsheetId = process.env.MAGOS_AUDIT_SPREADSHEET_ID || DEFAULT_AUDIT_ID,
    auth
  } = {}) {
    this.spreadsheetId = spreadsheetId;
    this.auth = auth || createGoogleAuth([SHEETS_SCOPE]);
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async getHeaders(sheetName) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: "'" + sheetName.replace(/'/g, "''") + "'!1:1"
    });
    const headers = response.data.values?.[0] || [];
    const map = {};
    headers.forEach((header, index) => {
      if (header) map[String(header)] = index;
    });
    return { headers, map };
  }

  quoteSheetName(sheetName) {
    return "'" + sheetName.replace(/'/g, "''") + "'";
  }

  async resolveRowByKey(sheetName, keyHeader, keyValue) {
    const { headers, map } = await this.getHeaders(sheetName);
    const keyIndex = map[keyHeader];
    if (keyIndex === undefined) {
      throw new Error('Missing header ' + keyHeader + ' on ' + sheetName);
    }

    const keyColumn = columnLetter(keyIndex);
    const quoted = this.quoteSheetName(sheetName);
    const keyResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: quoted + '!' + keyColumn + '2:' + keyColumn
    });

    const keyRows = keyResponse.data.values || [];
    const matches = [];
    keyRows.forEach((row, index) => {
      if ((row?.[0] ?? '') === keyValue) matches.push(index + 2);
    });

    if (matches.length > 1) {
      throw new Error(
        'Duplicate key ' + keyHeader + '=' + keyValue +
        ' on ' + sheetName + ' rows ' + matches.join(',')
      );
    }
    if (matches.length === 0) return null;

    const rowNumber = matches[0];
    const endColumn = columnLetter(headers.length - 1);
    const rowResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: quoted + '!A' + rowNumber + ':' + endColumn + rowNumber
    });
    const row = rowResponse.data.values?.[0] || [];
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index] ?? '';
    });

    return { rowNumber, object, headers, endColumn };
  }

  async appendObject(sheetName, object) {
    const { headers } = await this.getHeaders(sheetName);
    const row = headers.map((header) => object[header] ?? '');
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: "'" + sheetName.replace(/'/g, "''") + "'!A1",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    return row;
  }

  async updateObjectByKey(sheetName, keyHeader, keyValue, changes) {
    // Resolve the current key column and exact row immediately before mutation.
    // This avoids cached offsets and wide-sheet scans.
    const resolved = await this.resolveRowByKey(sheetName, keyHeader, keyValue);
    if (!resolved) return false;

    const replacement = resolved.headers.map((header) =>
      Object.prototype.hasOwnProperty.call(changes, header)
        ? changes[header]
        : (resolved.object[header] ?? '')
    );

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range:
        this.quoteSheetName(sheetName) +
        '!A' + resolved.rowNumber + ':' + resolved.endColumn + resolved.rowNumber,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [replacement] }
    });
    return true;
  }

  async readObjects(sheetName, { maxRows = 1000 } = {}) {
    const { headers } = await this.getHeaders(sheetName);
    if (!headers.length) return [];
    const endColumn = columnLetter(headers.length - 1);
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.quoteSheetName(sheetName) + '!A2:' + endColumn + Math.max(2, maxRows + 1)
    });
    return (response.data.values || []).map((row, index) => {
      const object = {};
      headers.forEach((header, column) => {
        object[header] = row[column] ?? '';
      });
      object.__rowNumber = index + 2;
      return object;
    });
  }

  async updateFieldsByKey(sheetName, keyHeader, keyValue, changes) {
    // Resolve live headers and the canonical row immediately before mutation.
    // Only named fields are updated; untouched formulas/validations remain intact.
    const resolved = await this.resolveRowByKey(sheetName, keyHeader, keyValue);
    if (!resolved) return null;

    const headerMap = {};
    resolved.headers.forEach((header, index) => {
      if (header) headerMap[String(header)] = index;
    });

    const data = [];
    const before = {};
    for (const [header, value] of Object.entries(changes || {})) {
      const index = headerMap[header];
      if (index === undefined) {
        throw new Error('Missing header ' + header + ' on ' + sheetName);
      }
      before[header] = resolved.object[header] ?? '';
      data.push({
        range:
          this.quoteSheetName(sheetName) + '!' +
          columnLetter(index) + resolved.rowNumber,
        values: [[value]]
      });
    }

    if (!data.length) {
      return { rowNumber: resolved.rowNumber, before, changed: false };
    }

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data
      }
    });
    return { rowNumber: resolved.rowNumber, before, changed: true };
  }

  async deleteRowByKey(sheetName, keyHeader, keyValue) {
    const resolved = await this.resolveRowByKey(sheetName, keyHeader, keyValue);
    if (!resolved) return false;

    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets(properties(sheetId,title))'
    });
    const sheet = (meta.data.sheets || []).find(
      (item) => item.properties?.title === sheetName
    );
    if (!sheet) throw new Error('Missing sheet ' + sheetName);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: resolved.rowNumber - 1,
              endIndex: resolved.rowNumber
            }
          }
        }]
      }
    });
    return true;
  }

  async findByKey(sheetName, keyHeader, keyValue) {
    const resolved = await this.resolveRowByKey(sheetName, keyHeader, keyValue);
    if (!resolved) return null;
    return { rowNumber: resolved.rowNumber, object: resolved.object };
  }

  async beginRun({ idempotencyKey, inputScope, evidenceLink = '', triggerType = 'DRIVE_INTAKE', automationId = '' }) {
    const existing = await this.findByKey('Automation_Run_Log', 'idempotency_key', idempotencyKey);
    const terminal = new Set(['COMMITTED', 'REVIEW_REQUIRED', 'RUNNING']);
    if (existing && terminal.has(existing.object.run_state)) {
      return { duplicate: true, existing: existing.object };
    }

    if (existing) {
      await this.updateObjectByKey('Automation_Run_Log', 'idempotency_key', idempotencyKey, {
        run_state: 'RUNNING',
        trigger_type: triggerType,
        started_at: nowSast(),
        completed_at: '',
        error_or_blocker: '',
        input_scope: inputScope,
        evidence_link: evidenceLink
      });
      return { duplicate: false, retry: true, runLogId: existing.object.run_log_id };
    }

    const runLogId = 'ARL-' + crypto.randomUUID();
    await this.appendObject('Automation_Run_Log', {
      run_log_id: runLogId,
      automation_id: automationId || process.env.MAGOS_AUTOMATION_ID || 'MAGOS-DOC-EXTRACT-01',
      provider_run_id: '',
      run_state: 'RUNNING',
      trigger_type: triggerType,
      started_at: nowSast(),
      completed_at: '',
      idempotency_key: idempotencyKey,
      input_scope: inputScope,
      affected_record_ids: '',
      writes_summary: '',
      readback_summary: '',
      error_or_blocker: '',
      evidence_link: evidenceLink,
      logged_at: nowSast()
    });
    return { duplicate: false, retry: false, runLogId };
  }

  async completeRun(idempotencyKey, {
    state = 'COMMITTED',
    affectedRecordIds = '',
    writesSummary = '',
    readbackSummary = '',
    errorOrBlocker = ''
  } = {}) {
    const updated = await this.updateObjectByKey('Automation_Run_Log', 'idempotency_key', idempotencyKey, {
      run_state: state,
      completed_at: nowSast(),
      affected_record_ids: affectedRecordIds,
      writes_summary: writesSummary,
      readback_summary: readbackSummary,
      error_or_blocker: errorOrBlocker,
      logged_at: nowSast()
    });
    if (!updated) throw new Error('Automation run row disappeared before completion');
  }

  async recordDocumentState({
    driveFileId,
    familyId,
    documentType,
    effectiveDate,
    evidenceLink,
    notes
  }) {
    const existing = await this.findByKey('Document_State_Register', 'drive_file_id', driveFileId);
    if (existing) return existing.object.document_state_id;

    const id = 'DSR-' + crypto.randomUUID();
    await this.appendObject('Document_State_Register', {
      document_state_id: id,
      drive_file_id: driveFileId,
      document_family_id: familyId,
      document_type: documentType,
      version: 'V1',
      document_state: 'CURRENT',
      effective_date: effectiveDate || new Date().toISOString().slice(0, 10),
      replaced_by_file_id: '',
      owner: 'Jacques',
      evidence_link: evidenceLink || '',
      last_changed_at: nowSast(),
      change_authority: 'MAGOS-DOC-EXTRACT-01',
      notes: notes || ''
    });
    return id;
  }

  async raiseSyncException({
    idempotencyKey,
    entityType = 'TRANSACTION',
    recordId = '',
    sourceSystem = 'MAGOS Transaction Writer',
    destinationSystem = '',
    exceptionType = 'TRANSACTION_WRITE_FAILURE',
    severity = 'HIGH',
    sourceValue = '',
    destinationValue = '',
    actionRequired = '',
    evidence = '',
    ruleId = 'MAGOS-TRANSACTION-WRITER-V1'
  }) {
    const existing = await this.findByKey('Sync_Exceptions', 'idempotency_key', idempotencyKey);
    if (existing && ['OPEN', 'IN_PROGRESS', 'BLOCKED'].includes(existing.object.status)) {
      return existing.object.exception_id;
    }
    if (existing) {
      await this.updateFieldsByKey('Sync_Exceptions', 'idempotency_key', idempotencyKey, {
        detected_at: nowSast(),
        severity,
        entity_type: entityType,
        record_id: recordId,
        source_system: sourceSystem,
        destination_system: destinationSystem,
        exception_type: exceptionType,
        source_value: sourceValue,
        destination_value: destinationValue,
        action_required: actionRequired,
        owner: 'Jacques / MAGOS',
        status: 'OPEN',
        resolved_at: '',
        evidence,
        rule_id: ruleId
      });
      return existing.object.exception_id;
    }

    const id = 'SYNC-EXC-' + crypto.randomUUID();
    await this.appendObject('Sync_Exceptions', {
      exception_id: id,
      detected_at: nowSast(),
      severity,
      entity_type: entityType,
      record_id: recordId,
      source_system: sourceSystem,
      destination_system: destinationSystem,
      exception_type: exceptionType,
      source_value: sourceValue,
      destination_value: destinationValue,
      action_required: actionRequired,
      owner: 'Jacques / MAGOS',
      status: 'OPEN',
      resolved_at: '',
      evidence,
      rule_id: ruleId,
      idempotency_key: idempotencyKey
    });
    return id;
  }

  async resolveSyncException(idempotencyKey, evidence = '') {
    const existing = await this.findByKey('Sync_Exceptions', 'idempotency_key', idempotencyKey);
    if (!existing) return false;
    if (existing.object.status === 'RESOLVED') return true;
    await this.updateFieldsByKey('Sync_Exceptions', 'idempotency_key', idempotencyKey, {
      status: 'RESOLVED',
      resolved_at: nowSast(),
      evidence: evidence || existing.object.evidence || ''
    });
    return true;
  }

  async raiseReviewException({
    driveFileId,
    idempotencyKey,
    evidenceLink,
    sourceValue,
    actionRequired
  }) {
    const reviewKey = 'review:' + idempotencyKey;
    const existing = await this.findByKey('Sync_Exceptions', 'idempotency_key', reviewKey);
    if (existing && ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'BLOCKED', 'REOPENED'].includes(existing.object.status)) {
      return existing.object.exception_id;
    }

    const id = 'SYNC-EXC-' + crypto.randomUUID();
    await this.appendObject('Sync_Exceptions', {
      exception_id: id,
      detected_at: nowSast(),
      severity: 'MEDIUM',
      entity_type: 'DOCUMENT_EXTRACTION',
      record_id: driveFileId,
      source_system: '00A / Drive',
      destination_system: 'MAGOS Processor',
      exception_type: 'DOCUMENT_REVIEW_REQUIRED',
      source_value: sourceValue || '',
      destination_value: '',
      action_required: actionRequired || 'Review document classification or extraction before authoritative writes.',
      owner: 'Jacques',
      status: 'OPEN',
      resolved_at: '',
      evidence: evidenceLink || '',
      rule_id: 'MAGOS-DOC-EXTRACT-01',
      idempotency_key: reviewKey
    });
    return id;
  }
}

module.exports = { AuditLedger, nowSast };
