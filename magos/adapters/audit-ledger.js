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

  async getRows(sheetName, endColumn) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: "'" + sheetName.replace(/'/g, "''") + "'!A:" + endColumn
    });
    return response.data.values || [];
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
    const { headers, map } = await this.getHeaders(sheetName);
    if (map[keyHeader] === undefined) throw new Error('Missing header ' + keyHeader + ' on ' + sheetName);
    const endColumn = columnLetter(headers.length - 1);
    const rows = await this.getRows(sheetName, endColumn);
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[map[keyHeader]] === keyValue);
    if (rowIndex < 1) return false;

    const existing = rows[rowIndex] || [];
    const replacement = headers.map((header, index) =>
      Object.prototype.hasOwnProperty.call(changes, header) ? changes[header] : (existing[index] ?? '')
    );

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: "'" + sheetName.replace(/'/g, "''") + "'!A" + (rowIndex + 1) + ':' + endColumn + (rowIndex + 1),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [replacement] }
    });
    return true;
  }

  async findByKey(sheetName, keyHeader, keyValue) {
    const { headers, map } = await this.getHeaders(sheetName);
    if (map[keyHeader] === undefined) throw new Error('Missing header ' + keyHeader + ' on ' + sheetName);
    const endColumn = columnLetter(headers.length - 1);
    const rows = await this.getRows(sheetName, endColumn);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][map[keyHeader]] === keyValue) {
        const object = {};
        headers.forEach((header, index) => { object[header] = rows[i][index] ?? ''; });
        return { rowNumber: i + 1, object };
      }
    }
    return null;
  }

  async beginRun({ idempotencyKey, inputScope, evidenceLink = '', triggerType = 'DRIVE_INTAKE' }) {
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
      automation_id: process.env.MAGOS_AUTOMATION_ID || 'MAGOS-DOC-EXTRACT-01',
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
