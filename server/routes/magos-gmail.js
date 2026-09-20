require('dotenv').config();

const crypto = require('crypto');
const express = require('express');

const { classifyGmailMessage } = require('../magos/gmail-safety');
const {
  applyLabels,
  createThreadDraft,
  getMessage,
  getThreadContext,
  listCandidateMessages,
  sendThreadReply,
} = require('../magos/gmail-client');
const { generateBusinessReply } = require('../magos/openai-reply');
const {
  appendDiagnostic,
  appendIntakeRow,
  hasIntakeSourceEvent,
} = require('../magos/google-sheets');
const {
  acquireGmailClaim,
  markGmailClaimCompleted,
  markGmailClaimFailed,
} = require('../magos/gmail-idempotency');

const router = express.Router();

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
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

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function fingerprint(messageId) {
  return sha256('MAGOS-GMAIL|' + String(messageId || '')).slice(0, 16).toUpperCase();
}

function parseMailboxAddress(value) {
  const text = String(value || '').trim();
  const angle = text.match(/<([^>]+)>/);
  return (angle ? angle[1] : text).trim().toLowerCase();
}

function senderDisplayName(value) {
  const text = String(value || '').trim();
  const angle = text.match(/^"?([^"<]+?)"?\s*</);
  return (angle ? angle[1] : parseMailboxAddress(text)).trim().slice(0, 120) || 'NOT_CAPTURED';
}

function intakeId(message) {
  const received = message.internalDate ? new Date(message.internalDate) : new Date();
  const ymd = formatSast(received).slice(0, 10).replace(/-/g, '');
  return 'INT-' + ymd + '-GMAIL-' + fingerprint(message.id).slice(0, 12);
}

function buildIntakeValues(message, classification) {
  const receivedAt = message.internalDate ? new Date(message.internalDate) : new Date();
  const senderEmail = parseMailboxAddress(message.from);
  const senderName = senderDisplayName(message.from);
  const attachmentState = message.attachments.length ? 'PRESENT_NOT_FETCHED' : 'NO_ATTACHMENT';
  const notes = [
    'Gmail inbound event.',
    'Safety gate=' + classification.category + ' (' + classification.reason + ').',
    'Raw body and attachment bytes are not copied into Intake_Queue.',
    'Gmail message/thread IDs remain the immutable source evidence.',
  ].join(' ');

  return [
    intakeId(message),
    formatSast(receivedAt),
    'GMAIL',
    'CUSTOMER_EMAIL',
    message.id,
    message.threadId || '',
    senderName,
    senderEmail || 'NOT_CAPTURED',
    message.to || 'NOT_CAPTURED',
    String(message.subject || '(no subject)').slice(0, 250),
    senderName,
    senderEmail || 'NOT_CAPTURED',
    'NOT_CAPTURED',
    'TO_CONFIRM',
    'TO_CONFIRM',
    classification.serviceCategory || 'TO_CONFIRM',
    classification.urgency || 'NORMAL',
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
    'CUSTOMER_EMAIL',
    '',
    '',
    attachmentState,
  ];
}

function authorised(req) {
  const expected = String(process.env.MAGOS_WORKER_SECRET || '');
  const supplied = String(req.get('x-magos-worker-secret') || '');
  return Boolean(expected && supplied && constantTimeEqual(expected, supplied));
}

async function audit(result, message, classification, note) {
  await appendDiagnostic({
    tokenPresent: true,
    eventParameter: 'GMAIL_WORKER',
    bodyLength: Number(message && message.text && message.text.length || 0),
    authorised: true,
    result,
    note: [
      'fp=' + fingerprint(message && message.id),
      'classification=' + String(classification && classification.category || ''),
      'reason=' + String(classification && classification.reason || ''),
      String(note || ''),
    ].filter(Boolean).join(';').slice(0, 500),
  });
}

async function ensureBusinessIntake(message, classification) {
  if (await hasIntakeSourceEvent(message.id)) return { existing: true };
  const values = buildIntakeValues(message, classification);
  const result = await appendIntakeRow(values, message.id, 'GMAIL', 'CUSTOMER_EMAIL');
  return { existing: false, rowNumber: result.rowNumber };
}

router.get('/health', (req, res) => {
  res.json({
    capability: 'MGOS-GMAIL-AUTO-RESPONDER-001',
    configured: Boolean(
      process.env.MAGOS_WORKER_SECRET &&
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.OPENAI_API_KEY
    ),
    autoSend: String(process.env.MAGOS_GMAIL_AUTO_SEND || '').toLowerCase() === 'true',
  });
});

router.post('/process', async (req, res) => {
  if (!authorised(req)) return res.status(401).json({ error: 'Unauthorized worker invocation.' });

  const maxMessages = Math.min(Math.max(Number(req.body && req.body.maxMessages || 10), 1), 25);
  const autoSend = String(process.env.MAGOS_GMAIL_AUTO_SEND || '').toLowerCase() === 'true';
  const ownMailbox = String(process.env.GMAIL_ACCOUNT_EMAIL || '').trim().toLowerCase();
  const outcomes = [];

  try {
    const candidates = await listCandidateMessages(maxMessages);

    for (const ref of candidates) {
      const message = await getMessage(ref.id);
      const senderEmail = parseMailboxAddress(message.from);

      if (ownMailbox && senderEmail === ownMailbox) {
        await applyLabels(message.id, ['MAGOS/Processed', 'MAGOS/No Reply']);
        outcomes.push({ id: fingerprint(message.id), result: 'OWN_MESSAGE_NO_REPLY' });
        continue;
      }

      const claim = await acquireGmailClaim(message.id);
      if (claim.state === 'COMPLETED') {
        outcomes.push({ id: fingerprint(message.id), result: 'DUPLICATE_NO_OP' });
        continue;
      }
      if (claim.state === 'BUSY') {
        outcomes.push({ id: fingerprint(message.id), result: 'RETRY_IN_PROGRESS' });
        continue;
      }

      const classification = classifyGmailMessage({
        from: message.from,
        subject: message.subject,
        text: message.text,
        headers: message.headers,
        attachmentMimeTypes: message.attachments.map((a) => a.mimeType),
      });

      try {
        const blocked = new Set(['EXPLICIT', 'PHISHING', 'SPAM', 'PERSONAL', 'NO_REPLY_AUTOMATED']);
        const review = new Set([
          'PROFANITY_REVIEW',
          'ATTACHMENT_REVIEW',
          'MEDIA_REVIEW',
          'SENSITIVE_BUSINESS_REVIEW',
          'UNKNOWN',
        ]);

        if (blocked.has(classification.category)) {
          const label = classification.category === 'SPAM'
            ? 'MAGOS/Blocked Spam'
            : classification.category === 'EXPLICIT'
              ? 'MAGOS/Blocked Explicit'
              : classification.category === 'PHISHING'
                ? 'MAGOS/Blocked Phishing'
                : 'MAGOS/No Reply';
          await applyLabels(message.id, ['MAGOS/Processed', label]);
          await audit('BLOCKED_NO_MODEL_CALL', message, classification, 'content_retained=NO');
          await markGmailClaimCompleted(message.id, { terminalResult: 'BLOCKED_NO_REPLY' });
          outcomes.push({ id: fingerprint(message.id), result: 'BLOCKED_NO_REPLY', category: classification.category });
          continue;
        }

        await ensureBusinessIntake(message, classification);

        if (review.has(classification.category)) {
          await applyLabels(message.id, ['MAGOS/Processed', 'MAGOS/Review']);
          await audit('REVIEW_NO_MODEL_CALL', message, classification, 'model_called=NO');
          await markGmailClaimCompleted(message.id, { terminalResult: 'REVIEW_REQUIRED' });
          outcomes.push({ id: fingerprint(message.id), result: 'REVIEW_REQUIRED', category: classification.category });
          continue;
        }

        if (classification.category !== 'BUSINESS_SAFE') {
          throw new Error('Unexpected Gmail classification: ' + classification.category);
        }

        const threadContext = await getThreadContext(message.threadId);
        const generated = await generateBusinessReply({ message, threadContext, classification });

        if (generated.requiresReview || !autoSend) {
          const draft = await createThreadDraft(message, generated.text);
          await applyLabels(message.id, ['MAGOS/Processed', 'MAGOS/Review', 'MAGOS/Drafted']);
          await audit(
            generated.requiresReview ? 'DRAFT_REVIEW_GUARD' : 'DRAFT_AUTO_SEND_DISABLED',
            message,
            classification,
            'model=' + generated.model
          );
          await markGmailClaimCompleted(message.id, {
            terminalResult: 'DRAFTED_FOR_REVIEW',
            gmailDraftId: draft.id || null,
          });
          outcomes.push({ id: fingerprint(message.id), result: 'DRAFTED_FOR_REVIEW' });
          continue;
        }

        const sent = await sendThreadReply(message, generated.text);
        await applyLabels(message.id, ['MAGOS/Processed', 'MAGOS/Auto Replied'], ['UNREAD']);
        await audit('AUTO_REPLIED', message, classification, 'model=' + generated.model);
        await markGmailClaimCompleted(message.id, {
          terminalResult: 'AUTO_REPLIED',
          gmailReplyId: sent.id || null,
        });
        outcomes.push({ id: fingerprint(message.id), result: 'AUTO_REPLIED' });
      } catch (processingError) {
        await markGmailClaimFailed(message.id, 'GMAIL_PROCESSING_FAILED');
        throw processingError;
      }
    }

    return res.json({
      capability: 'MGOS-GMAIL-AUTO-RESPONDER-001',
      autoSend,
      processed: outcomes.length,
      outcomes,
    });
  } catch (error) {
    console.error('MAGOS Gmail worker failed:', error);
    return res.status(500).json({
      error: 'MAGOS Gmail processing failed.',
      detail: String(error.message || error).slice(0, 240),
      outcomes,
    });
  }
});

module.exports = router;
