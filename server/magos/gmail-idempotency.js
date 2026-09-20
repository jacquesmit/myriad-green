require('dotenv').config();

const crypto = require('crypto');
const admin = require('../firebase');

const db = admin.firestore();
const COLLECTION = 'mgos_gmail_message_claims';
const LEASE_MS = 2 * 60 * 1000;

function claimKey(messageId) {
  return crypto.createHash('sha256')
    .update('MAGOS-GMAIL-CLAIM|' + String(messageId || ''), 'utf8')
    .digest('hex');
}

async function acquireGmailClaim(messageId) {
  if (!messageId) throw new Error('messageId is required for Gmail idempotency claim.');
  const ref = db.collection(COLLECTION).doc(claimKey(messageId));
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.create(ref, {
        status: 'PROCESSING',
        attemptCount: 1,
        leaseUntilMs: now + LEASE_MS,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { state: 'ACQUIRED', attemptCount: 1 };
    }

    const data = snap.data() || {};
    const status = String(data.status || '');
    const attempts = Number(data.attemptCount || 0);

    if (status === 'COMPLETED') return { state: 'COMPLETED', attemptCount: attempts };
    if (status === 'PROCESSING' && Number(data.leaseUntilMs || 0) > now) {
      return { state: 'BUSY', attemptCount: attempts };
    }

    tx.set(ref, {
      status: 'PROCESSING',
      attemptCount: attempts + 1,
      leaseUntilMs: now + LEASE_MS,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastErrorCode: admin.firestore.FieldValue.delete(),
    }, { merge: true });

    return { state: 'ACQUIRED', attemptCount: attempts + 1 };
  });
}

async function markGmailClaimCompleted(messageId, result) {
  const ref = db.collection(COLLECTION).doc(claimKey(messageId));
  await ref.set({
    status: 'COMPLETED',
    leaseUntilMs: 0,
    terminalResult: String(result && result.terminalResult || 'COMPLETED'),
    gmailReplyId: result && result.gmailReplyId || null,
    gmailDraftId: result && result.gmailDraftId || null,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markGmailClaimFailed(messageId, errorCode) {
  const ref = db.collection(COLLECTION).doc(claimKey(messageId));
  await ref.set({
    status: 'FAILED_RETRYABLE',
    leaseUntilMs: 0,
    lastErrorCode: String(errorCode || 'UNKNOWN_ERROR').slice(0, 120),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

module.exports = {
  acquireGmailClaim,
  markGmailClaimCompleted,
  markGmailClaimFailed,
};
