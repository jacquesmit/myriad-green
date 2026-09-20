'use strict';

const { google } = require('googleapis');
const { createGoogleAuth } = require('./google-auth');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

class GoogleDriveMoveAdapter {
  constructor({ auth } = {}) {
    this.auth = auth || createGoogleAuth([DRIVE_SCOPE]);
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async getMetadata(fileId) {
    const response = await this.drive.files.get({
      fileId,
      fields: 'id,name,mimeType,parents,webViewLink,trashed'
    });
    return response.data;
  }

  async moveFile({ fileId, fromFolderId, toFolderId }) {
    if (!fileId) throw new Error('fileId is required');
    if (!fromFolderId) throw new Error('fromFolderId is required');
    if (!toFolderId) throw new Error('toFolderId is required');
    if (fromFolderId === toFolderId) {
      throw new Error('fromFolderId and toFolderId must differ');
    }

    const before = await this.getMetadata(fileId);
    const parents = before.parents || [];

    if (parents.includes(toFolderId) && !parents.includes(fromFolderId)) {
      return {
        noOp: true,
        before,
        after: before
      };
    }

    if (!parents.includes(fromFolderId)) {
      throw new Error(
        'SOURCE_PARENT_MISMATCH file=' + fileId +
        ' expected_parent=' + fromFolderId +
        ' actual_parents=' + parents.join(',')
      );
    }

    await this.drive.files.update({
      fileId,
      addParents: toFolderId,
      removeParents: fromFolderId,
      fields: 'id,name,mimeType,parents,webViewLink,trashed'
    });

    const after = await this.getMetadata(fileId);
    const afterParents = after.parents || [];
    if (!afterParents.includes(toFolderId) || afterParents.includes(fromFolderId)) {
      throw new Error(
        'DRIVE_MOVE_READBACK_FAILED file=' + fileId +
        ' parents=' + afterParents.join(',')
      );
    }

    return {
      noOp: false,
      before,
      after
    };
  }
}

module.exports = {
  GoogleDriveMoveAdapter,
  DRIVE_SCOPE
};
