'use strict';

const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function documentIdempotencyKey({ driveFileId, contentHash, schemaVersion = 'v1' }) {
  if (!contentHash) throw new Error('contentHash is required');
  const source = driveFileId || 'no-drive-id';
  return 'doc-extract:' + schemaVersion + ':' + source + ':' + contentHash;
}

module.exports = { sha256, documentIdempotencyKey };
