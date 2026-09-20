'use strict';

const { google } = require('googleapis');
const { createGoogleAuth } = require('./google-auth');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

class GoogleDriveAdapter {
  constructor({ auth } = {}) {
    this.auth = auth || createGoogleAuth([DRIVE_SCOPE]);
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async listFilesInFolder(folderId, pageSize = 100) {
    if (!folderId) throw new Error('folderId is required');
    const response = await this.drive.files.list({
      q: "'" + folderId + "' in parents and trashed = false",
      pageSize,
      orderBy: 'modifiedTime asc',
      fields: 'files(id,name,mimeType,md5Checksum,modifiedTime,createdTime,webViewLink,size,parents)'
    });
    return response.data.files || [];
  }

  async getMetadata(fileId) {
    const response = await this.drive.files.get({
      fileId,
      fields: 'id,name,mimeType,md5Checksum,modifiedTime,createdTime,webViewLink,size,parents'
    });
    return response.data;
  }

  async downloadForExtraction(file) {
    const meta = typeof file === 'string' ? await this.getMetadata(file) : file;
    if (!meta || !meta.id) throw new Error('Drive file metadata with id is required');

    const googleDocTypes = {
      'application/vnd.google-apps.document': { mimeType: 'text/plain', nativeText: true },
      'application/vnd.google-apps.spreadsheet': { mimeType: 'text/csv', nativeText: true },
      'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', nativeText: false }
    };

    if (googleDocTypes[meta.mimeType]) {
      const target = googleDocTypes[meta.mimeType];
      const response = await this.drive.files.export(
        { fileId: meta.id, mimeType: target.mimeType },
        { responseType: 'arraybuffer' }
      );
      const buffer = Buffer.from(response.data);
      return {
        metadata: meta,
        buffer,
        mimeType: target.mimeType,
        nativeText: target.nativeText ? buffer.toString('utf8') : null
      };
    }

    const response = await this.drive.files.get(
      { fileId: meta.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    return {
      metadata: meta,
      buffer: Buffer.from(response.data),
      mimeType: meta.mimeType || 'application/octet-stream',
      nativeText: null
    };
  }
}

module.exports = { GoogleDriveAdapter };
