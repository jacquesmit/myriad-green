'use strict';

require('dotenv').config();

const { GoogleDriveAdapter } = require('../adapters/google-drive');
const { AuditLedger } = require('../adapters/audit-ledger');
const { PdfCoAdapter } = require('../adapters/pdfco');
const { processDocument } = require('./document-extract.worker');

async function scan00A({
  folderId = process.env.MAGOS_00A_FOLDER_ID,
  limit = Number(process.env.MAGOS_MAX_FILES_PER_RUN || 25),
  drive = new GoogleDriveAdapter(),
  ledger = new AuditLedger(),
  pdfco = new PdfCoAdapter()
} = {}) {
  if (!folderId) throw new Error('MAGOS_00A_FOLDER_ID is required');

  const files = await drive.listFilesInFolder(folderId, Math.max(limit, 1));
  const selected = files.slice(0, limit);
  const results = [];

  for (const file of selected) {
    try {
      const payload = await drive.downloadForExtraction(file);
      const result = await processDocument({
        driveFileId: file.id,
        fileName: file.name,
        mimeType: payload.mimeType,
        buffer: payload.buffer,
        nativeText: payload.nativeText,
        evidenceLink: file.webViewLink || '',
        sourceContext: { sourceEventId: 'drive:' + file.id },
        triggerType: 'DRIVE_00A'
      }, { ledger, pdfco });

      results.push({
        fileId: file.id,
        fileName: file.name,
        status: result.status,
        documentType: result.envelope?.document_type || null,
        reviewRequired: result.envelope?.review_required ?? null
      });
    } catch (error) {
      results.push({
        fileId: file.id,
        fileName: file.name,
        status: 'FAILED',
        error: error.message
      });
    }
  }

  return results;
}

if (require.main === module) {
  scan00A()
    .then((results) => {
      process.stdout.write(JSON.stringify({ processed: results.length, results }, null, 2) + '\n');
      process.exit(results.some((r) => r.status === 'FAILED') ? 1 : 0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { scan00A };
