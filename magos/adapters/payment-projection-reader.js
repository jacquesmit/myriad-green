'use strict';

const { AuditLedger } = require('./audit-ledger');

class PaymentProjectionReader {
  constructor({ ledger } = {}) {
    this.ledger = ledger || new AuditLedger({
      spreadsheetId:
        process.env.MAGOS_COMMERCIAL_SPREADSHEET_ID ||
        '1NJxYXRMS_6HU53wWqgSJh9jhf2jlLRa-Avi0ZfMLoNc'
    });
  }

  async readAll(sheetName) {
    const { headers, endColumn } = await this.ledger.getHeaders(sheetName);
    const response = await this.ledger.sheets.spreadsheets.values.get({
      spreadsheetId: this.ledger.spreadsheetId,
      range: this.ledger.quoteSheetName(sheetName) + '!A2:' + endColumn
    });

    return (response.data.values || []).map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = row[index] ?? '';
      });
      return object;
    });
  }

  async getControl(controlId) {
    const found = await this.ledger.findByKey(
      'Payment Control',
      'Control ID',
      controlId
    );
    return found?.object || null;
  }

  async getAllocationsForControl(controlId) {
    const rows = await this.readAll('Payment_Allocations');
    return rows.filter((row) => String(row.control_id || '') === String(controlId));
  }
}

module.exports = {
  PaymentProjectionReader
};
