require('dotenv').config();

const crypto = require('crypto');
const admin = require('../firebase');

const db = admin.firestore();
const COLLECTION = 'mgos_whatsapp_message_claims';
const LEASE_MS = 2 * 60 * 1000;

function claimKey(messageId) {
  return crypto.createHash('sha256')
    .update('MGOS-WA-CLAIM|' + String(messageId || ''), 'utf8')
    .digest('hex');
}

async function acquireMessageClaim(messageId) {
  if (!messageId) throw new Error('messageId is required for idempotency claim.');
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

    if (status === 'COMPLETED') {
      return { state: 'COMPLETED', attemptCount: attempts };
    }

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

async function markMessageClaimCompleted(messageId, rowNumber) {
  const ref = db.collection(COLLECTION).doc(claimKey(messageId));
  await ref.set({
    status: 'COMPLETED',
    leaseUntilMs: 0,
    intakeRow: Number(rowNumber || 0) || null,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastErrorCode: admin.firestore.FieldValue.delete(),
  }, { merge: true });
}

async function markMessageClaimFailed(messageId, errorCode) {
  const ref = db.collection(COLLECTION).doc(claimKey(messageId));
  await ref.set({
    status: 'FAILED',
    leaseUntilMs: 0,
    lastErrorCode: String(errorCode || 'INGRESS_WRITE_FAILED').slice(0, 80),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

module.exports = {
  acquireMessageClaim,
  markMessageClaimCompleted,
  markMessageClaimFailed,
};
