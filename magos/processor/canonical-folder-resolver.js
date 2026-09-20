'use strict';

function parseFolderId(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^[A-Za-z0-9_-]{10,}$/.test(text) && !text.includes('/')) return text;

  const match = text.match(/\/folders\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

class CanonicalFolderResolver {
  constructor({ lookupService } = {}) {
    if (!lookupService) throw new Error('lookupService is required');
    this.lookup = lookupService;
  }

  async resolve(envelope, match = {}) {
    const explicit = envelope?.entity_hints?.canonical_folder_id || '';
    if (explicit) {
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_ID',
        folder_id: explicit,
        source: 'EVENT_HINT'
      };
    }

    const ids = match.canonical_ids || {};
    const candidates = [];

    if (ids.job_id) {
      const row = await this.lookup.findEntityByCanonicalId('Job', ids.job_id);
      candidates.push({
        source: 'JOB',
        canonical_id: ids.job_id,
        folder_id: parseFolderId(row?.job_folder_link || row?.drive_folder_id)
      });
    }

    if (ids.quote_id) {
      const row = await this.lookup.findEntityByCanonicalId('Quote', ids.quote_id);
      candidates.push({
        source: 'QUOTE',
        canonical_id: ids.quote_id,
        folder_id: parseFolderId(row?.drive_folder_id || row?.['Drive Link'])
      });
    }

    if (ids.invoice_id) {
      const row = await this.lookup.findEntityByCanonicalId('Invoice', ids.invoice_id);
      candidates.push({
        source: 'INVOICE',
        canonical_id: ids.invoice_id,
        folder_id: parseFolderId(row?.drive_folder_id || row?.['Drive Link'])
      });
    }

    const valid = candidates.filter(x => x.folder_id);
    const folders = unique(valid.map(x => x.folder_id));

    if (folders.length === 1) {
      return {
        status: 'MATCHED',
        confidence: 1,
        basis: 'EXACT_ID',
        folder_id: folders[0],
        source: valid.map(x => x.source).join('+'),
        candidates: valid
      };
    }

    if (folders.length > 1) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'EXACT_ID',
        reason: 'Canonical IDs resolve to conflicting Drive folders.',
        candidates: valid
      };
    }

    return {
      status: 'UNRESOLVED',
      confidence: 0,
      basis: 'NONE',
      reason:
        'No exact canonical Drive folder resolved from job/quote/invoice identity. ' +
        'Supplier/client name alone is not a filing destination.',
      candidates
    };
  }
}

module.exports = {
  CanonicalFolderResolver,
  parseFolderId
};
