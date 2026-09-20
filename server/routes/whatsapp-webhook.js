require('dotenv').config();

const crypto = require('crypto');
const express = require('express');

const {
  classifyWhatsAppMessage,
} = require('../magos/whatsapp-safety');
const {
  appendDiagnostic,
  appendIntakeRow,
  hasIntakeSourceEvent,
} = require('../magos/google-sheets');
const {
  acquireMessageClaim,
  markMessageClaimCompleted,
  markMessageClaimFailed,
} = require('../magos/idempotency');

const router = express.Router();

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyMetaSignature(rawBody, signature) {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '');
  if (!appSecret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = 'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return constantTimeEqual(expected, signature);
}

function formatSast(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return parts.year + '-' + parts.month + '-' + parts.day + ' ' +
    parts.hour + ':' + parts.minute + ':' + parts.second + ' SAST';
}

function providerTimestamp(message) {
  const seconds = Number(message && message.timestamp);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000);
  return new Date();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? '+' + digits : 'NOT_CAPTURED';
}

function messageFingerprint(messageId) {
  return sha256('MGOS-WA|' + String(messageId || '')).slice(0, 16).toUpperCase();
}

function safeProfileName(value) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120) || 'NOT_CAPTURED';
}

function intakeId(messageId, receivedAt) {
  const ymd = formatSast(receivedAt).slice(0, 10).replace(/-/g, '');
  return 'INT-' + ymd + '-WHATSAPP-' + messageFingerprint(messageId).slice(0, 12);
}

function buildIntakeValues({ message, contact, classification, phoneNumberId }) {
  const receivedAt = providerTimestamp(message);
  const receivedAtText = formatSast(receivedAt);
  const messageType = String(message.type || 'unknown').toUpperCase();
  const senderName = safeProfileName(contact && contact.profile && contact.profile.name);
  const contactPhone = normalizePhone(message.from);
  const serviceCategory = classification.serviceCategory || 'TO_CONFIRM';
  const urgency = classification.urgency || 'NORMAL';
  const mediaType = ['image', 'video', 'audio', 'document', 'sticker'].includes(
    String(message.type || '').toLowerCase()
  );

  const notes = [
    'WhatsApp Business Cloud inbound event.',
    'Safety gate=BUSINESS_SAFE (' + classification.reason + ').',
    'Provider phone_number_id fingerprint=' + messageFingerprint(phoneNumberId) + '.',
    'Raw message body is not stored by ingress.',
    mediaType ? 'Media content was not fetched; safe-media inspection remains gated.' : 'No media fetched.',
  ].join(' ');

  return [
    intakeId(message.id, receivedAt),
    receivedAtText,
    'WHATSAPP',
    'CUSTOMER_MESSAGE',
    String(message.id),
    'WA-' + String(message.from || ''),
    senderName,
    'NOT_CAPTURED',
    'Myriad Green WhatsApp Business',
    'WhatsApp Business Cloud inbound ' + messageType,
    senderName,
    'NOT_CAPTURED',
    contactPhone,
    'TO_CONFIRM',
    'TO_CONFIRM',
    serviceCategory,
    urgency,
    '',
    'NO_MATCH',
    '',
    '',
    '',
    'NEW',
    '',
    formatSast(new Date()),
    notes,
    'NOT_APPLICABLE',
    'CUSTOMER_MESSAGE',
    '',
    '',
    mediaType ? 'NOT_FETCHED_SAFETY_GATE' : 'NO_ATTACHMENT',
  ];
}

async function logDisposition({
  messageId,
  messageType,
  category,
  reason,
  bodyLength,
  result,
}) {
  const fingerprint = messageFingerprint(messageId);
  await appendDiagnostic({
    tokenPresent: true,
    eventParameter: 'messages',
    bodyLength,
    authorised: true,
    result,
    note: 'fp=' + fingerprint +
      ';type=' + String(messageType || 'unknown') +
      ';classification=' + String(category || '') +
      ';reason=' + String(reason || '') +
      ';content_retained=NO;media_fetched=NO',
  });
}

router.get('/', async (req, res) => {
  const mode = String(req.query['hub.mode'] || '');
  const suppliedToken = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  const expectedToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '');
  const authorised = Boolean(
    expectedToken &&
    mode === 'subscribe' &&
    constantTimeEqual(suppliedToken, expectedToken)
  );

  try {
    await appendDiagnostic({
      tokenPresent: Boolean(suppliedToken),
      eventParameter: 'WEBHOOK_VERIFICATION',
      bodyLength: 0,
      authorised,
      result: authorised ? 'VERIFIED' : 'REJECTED',
      note: 'WhatsApp Cloud webhook verification handshake; token and challenge are never logged.',
    });
  } catch (error) {
    console.error('WhatsApp webhook verification diagnostic failed:', error.message);
  }

  if (!authorised) return res.status(403).send('Forbidden');
  return res.status(200).type('text/plain').send(challenge);
});

router.post('/', async (req, res) => {
  const signature = String(req.get('x-hub-signature-256') || '');
  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body || {}), 'utf8');
  const bodyLength = rawBody.length;

  if (!verifyMetaSignature(rawBody, signature)) {
    try {
      await appendDiagnostic({
        tokenPresent: Boolean(signature),
        eventParameter: 'messages',
        bodyLength,
        authorised: false,
        result: 'SIGNATURE_REJECTED',
        note: 'WhatsApp Cloud POST rejected before payload processing; content not retained.',
      });
    } catch (error) {
      console.error('WhatsApp signature rejection diagnostic failed:', error.message);
    }
    return res.status(401).send('Invalid signature');
  }

  const expectedPhoneNumberId = String(process.env.WHATSAPP_ALLOWED_PHONE_NUMBER_ID || '').trim();
  if (!expectedPhoneNumberId) {
    try {
      await appendDiagnostic({
        tokenPresent: true,
        eventParameter: 'messages',
        bodyLength,
        authorised: true,
        result: 'CONFIG_BLOCK',
        note: 'WHATSAPP_ALLOWED_PHONE_NUMBER_ID is required before production ingestion.',
      });
    } catch (error) {
      console.error('WhatsApp config diagnostic failed:', error.message);
    }
    return res.status(503).send('WhatsApp ingress is not configured');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    return res.status(400).send('Invalid JSON');
  }

  if (!payload || payload.object !== 'whatsapp_business_account') {
    return res.status(400).send('Unsupported webhook object');
  }

  const outcomes = [];
  let retryRequired = false;

  try {
    for (const entry of payload.entry || []) {
      const expectedWabaId = String(process.env.WHATSAPP_ALLOWED_WABA_ID || '').trim();
      if (expectedWabaId && String(entry.id || '') !== expectedWabaId) {
        outcomes.push({ result: 'WABA_REJECTED' });
        continue;
      }

      for (const change of entry.changes || []) {
        if (!change || change.field !== 'messages') continue;
        const value = change.value || {};
        const phoneNumberId = String(
          value.metadata && value.metadata.phone_number_id || ''
        );

        if (phoneNumberId !== expectedPhoneNumberId) {
          outcomes.push({ result: 'PHONE_NUMBER_REJECTED' });
          continue;
        }

        const contactsByWaId = new Map(
          (value.contacts || []).map((contact) => [String(contact.wa_id || ''), contact])
        );

        for (const message of value.messages || []) {
          const messageId = String(message.id || '').trim();
          if (!messageId) {
            await appendDiagnostic({
              tokenPresent: true,
              eventParameter: 'messages',
              bodyLength,
              authorised: true,
              result: 'MALFORMED_MESSAGE',
              note: 'Authenticated WhatsApp message lacked immutable message ID; content not retained.',
            });
            outcomes.push({ result: 'MALFORMED_MESSAGE' });
            continue;
          }

          const classification = classifyWhatsAppMessage(message);

          if (classification.category !== 'BUSINESS_SAFE') {
            const result = classification.category === 'UNKNOWN'
              ? 'HOLD_UNKNOWN'
              : 'BLOCK_' + classification.category;
            await logDisposition({
              messageId,
              messageType: message.type,
              category: classification.category,
              reason: classification.reason,
              bodyLength,
              result,
            });
            outcomes.push({ id: messageFingerprint(messageId), result });
            continue;
          }

          if (await hasIntakeSourceEvent(messageId)) {
            await logDisposition({
              messageId,
              messageType: message.type,
              category: classification.category,
              reason: 'duplicate_source_event',
              bodyLength,
              result: 'DUPLICATE_NO_OP',
            });
            outcomes.push({ id: messageFingerprint(messageId), result: 'DUPLICATE_NO_OP' });
            continue;
          }

          const claim = await acquireMessageClaim(messageId);
          if (claim.state === 'COMPLETED') {
            await logDisposition({
              messageId,
              messageType: message.type,
              category: classification.category,
              reason: 'completed_idempotency_claim',
              bodyLength,
              result: 'DUPLICATE_NO_OP',
            });
            outcomes.push({ id: messageFingerprint(messageId), result: 'DUPLICATE_NO_OP' });
            continue;
          }
          if (claim.state === 'BUSY') {
            retryRequired = true;
            outcomes.push({ id: messageFingerprint(messageId), result: 'RETRY_IN_PROGRESS' });
            continue;
          }

          try {
            // Re-check the canonical sheet after acquiring the atomic claim. This
            // recovers safely if a prior process appended the row and crashed before
            // marking the claim COMPLETED.
            if (await hasIntakeSourceEvent(messageId)) {
              await markMessageClaimCompleted(messageId, 0);
              outcomes.push({ id: messageFingerprint(messageId), result: 'DUPLICATE_NO_OP' });
              continue;
            }

            const contact = contactsByWaId.get(String(message.from || '')) || null;
            const values = buildIntakeValues({
              message,
              contact,
              classification,
              phoneNumberId,
            });
            const writeResult = await appendIntakeRow(values, messageId);
            await markMessageClaimCompleted(messageId, writeResult.rowNumber);

            await appendDiagnostic({
              tokenPresent: true,
              eventParameter: 'messages',
              bodyLength,
              authorised: true,
              result: 'BUSINESS_SAFE_INGESTED',
              note: 'fp=' + messageFingerprint(messageId) +
                ';row=' + writeResult.rowNumber +
                ';content_retained=BUSINESS_METADATA_ONLY;media_fetched=NO',
            });

            outcomes.push({
              id: messageFingerprint(messageId),
              result: 'BUSINESS_SAFE_INGESTED',
              row: writeResult.rowNumber,
            });
          } catch (writeError) {
            await markMessageClaimFailed(messageId, 'SHEETS_OR_READBACK_FAILED');
            throw writeError;
          }
        }
      }
    }

    if (retryRequired) {
      return res.status(503).json({ received: false, retry: true, outcomes });
    }
    return res.status(200).json({ received: true, outcomes });
  } catch (error) {
    console.error('WhatsApp Cloud ingress failed:', error);
    try {
      await appendDiagnostic({
        tokenPresent: true,
        eventParameter: 'messages',
        bodyLength,
        authorised: true,
        result: 'INGRESS_ERROR',
        note: 'Authenticated event failed during MAGOS processing; no raw content retained. error=' +
          String(error.message || error).slice(0, 240),
      });
    } catch (diagnosticError) {
      console.error('WhatsApp ingress failure diagnostic failed:', diagnosticError.message);
    }
    return res.status(500).json({ error: 'WhatsApp ingress processing failed' });
  }
});

module.exports = router;
