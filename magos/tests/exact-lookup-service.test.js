'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ExactLookupService } = require('../adapters/exact-lookup-service');

function fakeStore(rows = {}) {
  return {
    async findByKey(sheet, key, value) {
      const row = rows[sheet + '|' + key + '|' + value];
      return row ? { object: row } : null;
    }
  };
}

test('canonical entity lookups use the real authoritative tabs and exact keys', async () => {
  const service = new ExactLookupService({
    stores: {
      crm: fakeStore({
        'Jobs_Opportunities|job_id|JOB-1': { job_id: 'JOB-1' }
      }),
      commercial: fakeStore(),
      supplier: fakeStore()
    }
  });

  const found = await service.findEntityByCanonicalId('Job', 'JOB-1');
  assert.equal(found.job_id, 'JOB-1');
});

test('supplier quote number resolves through Supplier_Quotes exact reference', async () => {
  const service = new ExactLookupService({
    stores: {
      crm: fakeStore(),
      commercial: fakeStore(),
      supplier: fakeStore({
        'Supplier_Quotes|supplier_quote_number|QU187355': {
          supplier_quote_id: 'SQT-1',
          supplier_id: 'SUP-WATERSPOT-CENTURION',
          supplier_quote_number: 'QU187355'
        }
      })
    }
  });

  const found = await service.findByDocumentNumber('SUPPLIER_QUOTE', 'QU187355');
  assert.equal(found.length, 1);
  assert.equal(found[0].canonical_ids.supplier_id, 'SUP-WATERSPOT-CENTURION');
});

test('evidence lookup uses immutable Drive file ID', async () => {
  const service = new ExactLookupService({
    stores: {
      crm: fakeStore({
        'Evidence_Index|drive_file_id|FILE-1': {
          evidence_index_id: 'EVI-DRIVE-FILE-1',
          drive_file_id: 'FILE-1'
        }
      }),
      commercial: fakeStore(),
      supplier: fakeStore()
    }
  });

  const found = await service.findEvidenceByDriveFileId('FILE-1');
  assert.equal(found.evidence_index_id, 'EVI-DRIVE-FILE-1');
});
