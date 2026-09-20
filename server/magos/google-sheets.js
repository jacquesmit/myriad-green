require('dotenv').config();

const path = require('path');
const { google } = require('googleapis');

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
let cachedSheetsClient = null;
let cachedSheetIds = null;

function crmSpreadsheetId() {
  const id = String(process.env.MGOS_CRM_SPREADSHEET_ID || '').trim();
  if (!id) {
    throw new Error('MGOS_CRM_SPREADSHEET_ID is required.');
  }
  return id;
}

function googleAuthOptions() {
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    let credentials;
    try {
      credentials = JSON.parse(rawJson);
    } catch (error) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    return { credentials, scopes: [SHEETS_SCOPE] };
  }

  return {
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE ||
      path.join(__dirname, '../../google-credentials.json'),
    scopes: [SHEETS_SCOPE],
  };
}

async function sheetsClient() {
  if (cachedSheetsClient) return cachedSheetsClient;
  const auth = new google.auth.GoogleAuth(googleAuthOptions());
  cachedSheetsClient = google.sheets({ version: 'v4', auth });
  return cachedSheetsClient;
}

async function sheetIds() {
  if (cachedSheetIds) return cachedSheetIds;
  const sheets = await sheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: crmSpreadsheetId(),
    fields: 'sheets(properties(sheetId,title))',
  });
  cachedSheetIds = {};
  (response.data.sheets || []).forEach((sheet) => {
    if (sheet.properties && sheet.properties.title) {
      cachedSheetIds[sheet.properties.title] = sheet.properties.sheetId;
    }
  });
  return cachedSheetIds;
}

async function appendDiagnostic({
  tokenPresent,
  eventParameter,
  bodyLength,
  authorised,
  result,
  note,
}) {
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: crmSpreadsheetId(),
    range: 'Webhook_Diagnostics!A:G',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        new Date().toISOString(),
        tokenPresent ? 'YES' : 'NO',
        String(eventParameter || ''),
        Number(bodyLength || 0),
        authorised ? 'YES' : 'NO',
        String(result || ''),
        String(note || '').slice(0, 500),
      ]],
    },
  });
}

async function hasIntakeSourceEvent(sourceEventId) {
  if (!sourceEventId) return false;
  const sheets = await sheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: crmSpreadsheetId(),
    range: 'Intake_Queue!E2:E',
    majorDimension: 'COLUMNS',
  });
  const values = (response.data.values && response.data.values[0]) || [];
  return values.some((value) => String(value || '').trim() === String(sourceEventId).trim());
}

function parseUpdatedRow(updatedRange) {
  const match = String(updatedRange || '').match(/!A(\d+):AE(\d+)$/i);
  if (!match || match[1] !== match[2]) return null;
  return Number(match[1]);
}

async function copyIntakeRowControls(rowNumber) {
  if (!rowNumber || rowNumber <= 2) return;
  const ids = await sheetIds();
  const sheetId = ids.Intake_Queue;
  if (sheetId === undefined) throw new Error('Intake_Queue sheet ID was not found.');

  const sheets = await sheetsClient();
  const sourceStart = rowNumber - 2;
  const destinationStart = rowNumber - 1;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: crmSpreadsheetId(),
    requestBody: {
      requests: [
        {
          copyPaste: {
            source: {
              sheetId,
              startRowIndex: sourceStart,
              endRowIndex: sourceStart + 1,
              startColumnIndex: 0,
              endColumnIndex: 31,
            },
            destination: {
              sheetId,
              startRowIndex: destinationStart,
              endRowIndex: destinationStart + 1,
              startColumnIndex: 0,
              endColumnIndex: 31,
            },
            pasteType: 'PASTE_FORMAT',
            pasteOrientation: 'NORMAL',
          },
        },
        {
          copyPaste: {
            source: {
              sheetId,
              startRowIndex: sourceStart,
              endRowIndex: sourceStart + 1,
              startColumnIndex: 0,
              endColumnIndex: 31,
            },
            destination: {
              sheetId,
              startRowIndex: destinationStart,
              endRowIndex: destinationStart + 1,
              startColumnIndex: 0,
              endColumnIndex: 31,
            },
            pasteType: 'PASTE_DATA_VALIDATION',
            pasteOrientation: 'NORMAL',
          },
        },
      ],
    },
  });
}

async function appendIntakeRow(values, expectedSourceEventId) {
  if (!Array.isArray(values) || values.length !== 31) {
    throw new Error('Intake_Queue row must contain exactly 31 columns (A:AE).');
  }

  const sheets = await sheetsClient();
  const appendResponse = await sheets.spreadsheets.values.append({
    spreadsheetId: crmSpreadsheetId(),
    range: 'Intake_Queue!A:AE',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });

  const updatedRange = appendResponse.data.updates && appendResponse.data.updates.updatedRange;
  const rowNumber = parseUpdatedRow(updatedRange);
  if (!rowNumber) {
    throw new Error('Could not resolve appended Intake_Queue row for read-back.');
  }

  await copyIntakeRowControls(rowNumber);

  const readback = await sheets.spreadsheets.values.get({
    spreadsheetId: crmSpreadsheetId(),
    range: 'Intake_Queue!A' + rowNumber + ':AE' + rowNumber,
  });
  const row = (readback.data.values && readback.data.values[0]) || [];
  if (String(row[4] || '') !== String(expectedSourceEventId || '')) {
    throw new Error('Intake_Queue read-back failed: source_event_id mismatch.');
  }
  if (String(row[2] || '') !== 'WHATSAPP' || String(row[3] || '') !== 'CUSTOMER_MESSAGE') {
    throw new Error('Intake_Queue read-back failed: source schema mismatch.');
  }

  return { rowNumber, updatedRange };
}

module.exports = {
  appendDiagnostic,
  appendIntakeRow,
  hasIntakeSourceEvent,
};
