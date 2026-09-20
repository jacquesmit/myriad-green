require('dotenv').config();

const { google } = require('googleapis');

let cachedGmail = null;
const labelCache = new Map();

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(name + ' is required.');
  return value;
}

function gmailClient() {
  if (cachedGmail) return cachedGmail;

  const oauth2 = new google.auth.OAuth2(
    required('GMAIL_CLIENT_ID'),
    required('GMAIL_CLIENT_SECRET'),
    String(process.env.GMAIL_REDIRECT_URI || '').trim() || undefined
  );
  oauth2.setCredentials({ refresh_token: required('GMAIL_REFRESH_TOKEN') });
  cachedGmail = google.gmail({ version: 'v1', auth: oauth2 });
  return cachedGmail;
}

function decodeBase64Url(value) {
  if (!value) return '';
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectPayload(payload, acc) {
  if (!payload) return;
  const mimeType = String(payload.mimeType || '').toLowerCase();
  const filename = String(payload.filename || '');
  const body = payload.body || {};

  if (body.attachmentId) {
    acc.attachments.push({
      attachmentId: body.attachmentId,
      filename,
      mimeType,
      size: Number(body.size || 0),
    });
  } else if (body.data && mimeType === 'text/plain') {
    acc.plain.push(decodeBase64Url(body.data));
  } else if (body.data && mimeType === 'text/html') {
    acc.html.push(decodeBase64Url(body.data));
  }

  (payload.parts || []).forEach((part) => collectPayload(part, acc));
}

function headerMap(headers) {
  const out = {};
  (headers || []).forEach((h) => {
    const key = String(h && h.name || '').toLowerCase();
    if (key) out[key] = String(h && h.value || '');
  });
  return out;
}

function parseMessage(resource) {
  const payload = resource.payload || {};
  const headers = payload.headers || [];
  const map = headerMap(headers);
  const acc = { plain: [], html: [], attachments: [] };
  collectPayload(payload, acc);

  let text = acc.plain.join('\n').trim();
  if (!text) text = stripHtml(acc.html.join('\n'));
  if (!text) text = String(resource.snippet || '').trim();

  return {
    id: String(resource.id || ''),
    threadId: String(resource.threadId || ''),
    internalDate: Number(resource.internalDate || 0),
    labelIds: resource.labelIds || [],
    headers,
    from: map.from || '',
    to: map.to || '',
    subject: map.subject || '(no subject)',
    messageIdHeader: map['message-id'] || '',
    references: map.references || '',
    inReplyTo: map['in-reply-to'] || '',
    autoSubmitted: map['auto-submitted'] || '',
    text: text.slice(0, 12000),
    attachments: acc.attachments,
  };
}

async function listCandidateMessages(maxResults = 10) {
  const gmail = gmailClient();
  const q = String(
    process.env.MAGOS_GMAIL_QUERY ||
    'in:inbox is:unread newer_than:7d -label:"MAGOS/Processed"'
  );
  const response = await gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults: Math.min(Math.max(Number(maxResults || 10), 1), 50),
    includeSpamTrash: false,
  });
  return response.data.messages || [];
}

async function getMessage(messageId) {
  const gmail = gmailClient();
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return parseMessage(response.data);
}

async function getThreadContext(threadId) {
  const gmail = gmailClient();
  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });
  const messages = (response.data.messages || []).map(parseMessage);
  return messages.slice(-6).map((m) => ({
    from: m.from,
    to: m.to,
    subject: m.subject,
    text: m.text.slice(0, 2500),
  }));
}

async function ensureLabel(name) {
  if (labelCache.has(name)) return labelCache.get(name);
  const gmail = gmailClient();
  const existing = await gmail.users.labels.list({ userId: 'me' });
  const found = (existing.data.labels || []).find((label) => label.name === name);
  if (found && found.id) {
    labelCache.set(name, found.id);
    return found.id;
  }

  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });
  labelCache.set(name, created.data.id);
  return created.data.id;
}

async function applyLabels(messageId, names, removeLabelIds = []) {
  const gmail = gmailClient();
  const addLabelIds = [];
  for (const name of names || []) addLabelIds.push(await ensureLabel(name));
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds, removeLabelIds },
  });
}

function base64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cleanHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function replySubject(subject) {
  const value = cleanHeader(subject || '(no subject)');
  return /^re:/i.test(value) ? value : 'Re: ' + value;
}

function rawReply({ to, subject, body, messageIdHeader, references, fromAddress }) {
  const lines = [];
  if (fromAddress) lines.push('From: ' + cleanHeader(fromAddress));
  lines.push('To: ' + cleanHeader(to));
  lines.push('Subject: ' + replySubject(subject));
  if (messageIdHeader) {
    lines.push('In-Reply-To: ' + cleanHeader(messageIdHeader));
    const refs = [references, messageIdHeader].filter(Boolean).join(' ').trim();
    if (refs) lines.push('References: ' + cleanHeader(refs));
  }
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: 8bit');
  lines.push('');
  lines.push(String(body || '').trim());
  return base64Url(lines.join('\r\n'));
}

async function sendThreadReply(message, body) {
  const gmail = gmailClient();
  const raw = rawReply({
    to: message.from,
    subject: message.subject,
    body,
    messageIdHeader: message.messageIdHeader,
    references: message.references,
    fromAddress: String(process.env.GMAIL_SEND_AS || '').trim(),
  });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: message.threadId || undefined },
  });
  return response.data;
}

async function createThreadDraft(message, body) {
  const gmail = gmailClient();
  const raw = rawReply({
    to: message.from,
    subject: message.subject,
    body,
    messageIdHeader: message.messageIdHeader,
    references: message.references,
    fromAddress: String(process.env.GMAIL_SEND_AS || '').trim(),
  });

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw, threadId: message.threadId || undefined },
    },
  });
  return response.data;
}

module.exports = {
  applyLabels,
  createThreadDraft,
  getMessage,
  getThreadContext,
  listCandidateMessages,
  sendThreadReply,
};
