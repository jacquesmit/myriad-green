const BUSINESS_PATTERNS = [
  /\b(irrigation|sprinkler|sproeier|besproeiing|solenoid|valve|klep|controller|rain\s?bird|hunter|k[-\s]?rain|rainpoint)\b/i,
  /\b(drain|drainage|blocked\s+drain|jetting|jetter|drein)\b/i,
  /\b(leak|leaking|lek|water\s+leak)\b/i,
  /\b(tank|jojo|backup\s+water|water\s+backup|pump|pomp|water\s+pressure|waterdruk)\b/i,
  /\b(filtration|filter)\b/i,
  /\b(quote|quotation|estimate|inspection|assessment|site\s+visit|installation|installasie|repair|herstel|service)\b/i,
  /\b(pretoria|centurion|midrand|sandton|johannesburg|randburg)\b/i,
];

const EXPLICIT_PATTERNS = [
  /\bporn(ography)?\b/i,
  /\bnudes?\b/i,
  /\bnaked\b/i,
  /\bexplicit\s+(photo|video|image|content)\b/i,
  /\bsexual(ly)?\s+explicit\b/i,
  /\bsend\s+(me\s+)?nudes?\b/i,
];

const PHISHING_PATTERNS = [
  /\b(one[-\s]?time\s+pin|otp|password|passcode|security\s+code)\b/i,
  /\bverify\s+(your\s+)?(account|identity|bank|login)\b/i,
  /\bconfirm\s+(your\s+)?(password|pin|otp|login)\b/i,
  /\baccount\s+(suspended|locked|disabled)\b/i,
  /\bupdate\s+(your\s+)?bank(ing)?\s+details\b/i,
  /\bchange\s+(of\s+)?bank(ing)?\s+details\b/i,
  /\bclick\s+(this|the)\s+link\s+to\s+(verify|unlock|restore)\b/i,
];

const SPAM_PATTERNS = [
  /\bseo\s+services?\b/i,
  /\bwebsite\s+design\s+services?\b/i,
  /\bsocial\s+media\s+marketing\b/i,
  /\bbulk\s+(sms|whatsapp|email|marketing)\b/i,
  /\bguest\s+post(ing)?\b/i,
  /\blink\s+building\b/i,
  /\bcasino\b/i,
  /\bbetting\s+tips?\b/i,
  /\bforex\s+signals?\b/i,
  /\bcrypto(currency)?\s+investment\b/i,
];

const PROFANITY_PATTERNS = [
  /\bfuck(?:ing|ed|er|s)?\b/i,
  /\bshit(?:ty)?\b/i,
  /\bbullshit\b/i,
  /\bbitch(?:es)?\b/i,
  /\basshole\b/i,
  /\bpoes\b/i,
  /\bnaaier\b/i,
];

const PERSONAL_PATTERNS = [
  /\bhappy\s+birthday\b/i,
  /\bi\s+miss\s+you\b/i,
  /\bi\s+love\s+you\b/i,
  /\blove\s+you\b/i,
  /\bfamily\s+dinner\b/i,
  /\bsee\s+you\s+tonight\b/i,
  /\bsweetheart\b/i,
];

const SENSITIVE_BUSINESS_PATTERNS = [
  /\b(bank\s+details?|banking\s+details?|account\s+number|beneficiary)\b/i,
  /\b(payment\s+proof|proof\s+of\s+payment|pop\b|paid\b|payment\s+received)\b/i,
  /\b(refund|credit\s+note|chargeback)\b/i,
  /\b(invoice|statement)\b/i,
  /\blegal|attorney|lawyer|summons|demand\b/i,
];

const URL_PATTERN = /https?:\/\/|www\.|\bbit\.ly\b|\btinyurl\.com\b|\bt\.co\b/i;
const EXECUTABLE_MIME_PATTERNS = [
  /application\/x-msdownload/i,
  /application\/x-dosexec/i,
  /application\/x-executable/i,
  /application\/vnd\.microsoft\.portable-executable/i,
  /application\/x-sh/i,
  /application\/x-bat/i,
];

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizeHeaderMap(headers) {
  const out = {};
  (headers || []).forEach((h) => {
    const key = String(h && h.name || '').trim().toLowerCase();
    if (!key) return;
    out[key] = String(h && h.value || '').trim();
  });
  return out;
}

function looksAutomated({ from, headers }) {
  const map = normalizeHeaderMap(headers);
  const sender = String(from || '').toLowerCase();

  if (/\b(no-?reply|do-?not-?reply|mailer-daemon|postmaster)\b/i.test(sender)) return true;
  if (/\bauto-(submitted|generated|replied)\b/i.test(map['auto-submitted'] || '')) return true;
  if (/\b(bulk|list|junk)\b/i.test(map.precedence || '')) return true;
  if (map['list-unsubscribe']) return true;
  if (map['x-auto-response-suppress']) return true;
  return false;
}

function inferServiceCategory(text) {
  const value = String(text || '');
  if (/\b(drain|drainage|drein|blocked|jetting|jetter)\b/i.test(value)) return 'Drain unblocking / drainage';
  if (/\b(leak|leaking|lek)\b/i.test(value)) return 'Leak detection / repair';
  if (/\b(tank|tenk|jojo|backup\s+water|water\s+backup|pump|pomp|water\s+pressure|waterdruk)\b/i.test(value)) {
    return 'Backup water systems';
  }
  if (/\b(filtration|filter)\b/i.test(value)) return 'Water filtration';
  if (/\b(irrigation|besproeiing|sprinkler|sproeier|solenoid|valve|klep|controller|rain\s?bird|hunter|k[-\s]?rain|rainpoint)\b/i.test(value)) {
    return 'Irrigation systems';
  }
  return 'TO_CONFIRM';
}

function inferUrgency(text) {
  const value = String(text || '');
  if (/\b(emergency|burst|flood|flooding)\b/i.test(value)) return 'URGENT';
  if (/\b(urgent|asap|today|no\s+water|blocked\s+drain)\b/i.test(value)) return 'HIGH';
  return 'NORMAL';
}

function classifyGmailMessage({ from, subject, text, headers, attachmentMimeTypes = [] }) {
  const combined = [subject, text].map((v) => String(v || '')).join('\n').trim();
  const mimeTypes = (attachmentMimeTypes || []).map((v) => String(v || '').toLowerCase());

  if (looksAutomated({ from, headers })) return { category: 'NO_REPLY_AUTOMATED', reason: 'automated_or_list_message' };
  if (combined && matchesAny(combined, EXPLICIT_PATTERNS)) return { category: 'EXPLICIT', reason: 'explicit_text_pattern' };
  if (combined && matchesAny(combined, PHISHING_PATTERNS)) return { category: 'PHISHING', reason: 'credential_or_bank_request' };
  if (combined && URL_PATTERN.test(combined) && /\b(login|verify|account|otp|password|pin|bank)\b/i.test(combined)) {
    return { category: 'PHISHING', reason: 'suspicious_link_plus_account_request' };
  }
  if (combined && matchesAny(combined, SPAM_PATTERNS)) return { category: 'SPAM', reason: 'unsolicited_marketing_pattern' };
  if (mimeTypes.some((type) => EXECUTABLE_MIME_PATTERNS.some((pattern) => pattern.test(type)))) {
    return { category: 'ATTACHMENT_REVIEW', reason: 'executable_attachment' };
  }
  if (combined && matchesAny(combined, PROFANITY_PATTERNS)) {
    return { category: 'PROFANITY_REVIEW', reason: 'profanity_detected', serviceCategory: inferServiceCategory(combined), urgency: inferUrgency(combined) };
  }
  if (combined && matchesAny(combined, SENSITIVE_BUSINESS_PATTERNS)) {
    return { category: 'SENSITIVE_BUSINESS_REVIEW', reason: 'financial_or_legal_topic', serviceCategory: inferServiceCategory(combined), urgency: inferUrgency(combined) };
  }
  const hasVisualMedia = mimeTypes.some((type) => type.startsWith('image/') || type.startsWith('video/'));
  if (hasVisualMedia) {
    return { category: 'MEDIA_REVIEW', reason: 'uninspected_visual_media', serviceCategory: inferServiceCategory(combined), urgency: inferUrgency(combined) };
  }
  if (combined && matchesAny(combined, PERSONAL_PATTERNS) && !matchesAny(combined, BUSINESS_PATTERNS)) {
    return { category: 'PERSONAL', reason: 'personal_message_pattern' };
  }
  if (combined && matchesAny(combined, BUSINESS_PATTERNS)) {
    return { category: 'BUSINESS_SAFE', reason: 'business_intent_pattern', serviceCategory: inferServiceCategory(combined), urgency: inferUrgency(combined) };
  }
  return { category: 'UNKNOWN', reason: 'business_intent_not_proven' };
}

module.exports = { classifyGmailMessage, inferServiceCategory, inferUrgency, looksAutomated, normalizeHeaderMap };
