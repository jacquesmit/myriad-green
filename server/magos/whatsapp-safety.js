const BUSINESS_PATTERNS = [
  /\birrigation\b/i,
  /\bbesproeiing\b/i,
  /\bsprinkler(s)?\b/i,
  /\bsproeier(s)?\b/i,
  /\bsolenoid(s)?\b/i,
  /\bvalve(s)?\b/i,
  /\bklep(pe)?\b/i,
  /\bcontroller\b/i,
  /\brain\s?bird\b/i,
  /\bhunter\b/i,
  /\bk[-\s]?rain\b/i,
  /\brainpoint\b/i,
  /\bdrain(s|age)?\b/i,
  /\bdrein(e)?\b/i,
  /\bblocked\b/i,
  /\bjet(ting|ter)?\b/i,
  /\bleak(s|ing)?\b/i,
  /\blek\b/i,
  /\btank(s)?\b/i,
  /\btenk(e)?\b/i,
  /\bjojo\b/i,
  /\bpump(s)?\b/i,
  /\bpomp(e)?\b/i,
  /\bbackup\s+water\b/i,
  /\bwater\s+backup\b/i,
  /\bwater\s+pressure\b/i,
  /\bwaterdruk\b/i,
  /\bfiltration\b/i,
  /\bfilter(s)?\b/i,
  /\bborehole\b/i,
  /\bquote\b/i,
  /\bquotation\b/i,
  /\bkwotasie\b/i,
  /\bestimate\b/i,
  /\bbooking\b/i,
  /\bbespreking\b/i,
  /\bsite\s+visit\b/i,
  /\bappointment\b/i,
  /\baddress\b/i,
  /\badres\b/i,
  /\bsuburb\b/i,
  /\bstraat\b/i,
  /\bprice\b/i,
  /\bcost\b/i,
  /\binvoice\b/i,
  /\bpayment\b/i,
  /\bdeposit\b/i,
  /\bdeposito\b/i,
  /\bproof\s+of\s+payment\b/i,
  /\binstallation\b/i,
  /\binstallasie\b/i,
  /\brepair(s)?\b/i,
  /\bherstel\b/i,
  /\bservice\b/i,
  /\bemergency\b/i,
  /\bgarden\b/i,
  /\btuin\b/i,
  /\blawn\b/i,
  /\bgrass\b/i,
  /\bwater\b/i
];

const EXPLICIT_PATTERNS = [
  /\bporn(ography)?\b/i,
  /\bnude(s)?\b/i,
  /\bnaked\b/i,
  /\bsexual(ly)?\b/i,
  /\bsex\b/i,
  /\bexplicit\s+(photo|video|image|content)\b/i,
  /\bsend\s+(me\s+)?nudes\b/i
];

const PHISHING_PATTERNS = [
  /\b(one[-\s]?time\s+pin|otp|password|passcode|pin)\b/i,
  /\bverify\s+(your\s+)?(account|identity|bank|login)\b/i,
  /\bconfirm\s+(your\s+)?(password|pin|otp|login)\b/i,
  /\baccount\s+(suspended|locked|disabled)\b/i,
  /\bupdate\s+(your\s+)?bank(ing)?\s+details\b/i,
  /\bchange\s+(of\s+)?bank(ing)?\s+details\b/i
];

const SCAM_PATTERNS = [
  /\bcrypto(currency)?\b/i,
  /\bbitcoin\b/i,
  /\bforex\s+signal(s)?\b/i,
  /\bguaranteed\s+(return|profit|income)\b/i,
  /\bdouble\s+your\s+money\b/i,
  /\blottery\b/i,
  /\bprize\s+winner\b/i,
  /\bclaim\s+your\s+prize\b/i,
  /\bloan\s+(approved|offer)\b/i,
  /\bget\s+rich\b/i
];

const SPAM_PATTERNS = [
  /\bseo\s+services?\b/i,
  /\bwebsite\s+design\s+services?\b/i,
  /\bsocial\s+media\s+marketing\b/i,
  /\bbulk\s+(sms|whatsapp|marketing)\b/i,
  /\bcasino\b/i,
  /\bbetting\s+tips?\b/i,
  /\bforex\s+signals?\b/i
];

const PERSONAL_PATTERNS = [
  /\bhappy\s+birthday\b/i,
  /\bi\s+miss\s+you\b/i,
  /\bi\s+love\s+you\b/i,
  /\blove\s+you\b/i,
  /\bfamily\s+dinner\b/i,
  /\bsee\s+you\s+tonight\b/i,
  /\bsweetheart\b/i
];

const URL_PATTERN = /https?:\/\/|www\.|\bbit\.ly\b|\btinyurl\.com\b|\bt\.co\b/i;

function extractMessageText(message) {
  if (!message || typeof message !== 'object') return '';
  if (message.text && typeof message.text.body === 'string') return message.text.body.trim();
  if (message.button && typeof message.button.text === 'string') return message.button.text.trim();
  if (message.interactive && message.interactive.button_reply) {
    return String(message.interactive.button_reply.title || '').trim();
  }
  if (message.interactive && message.interactive.list_reply) {
    return String(message.interactive.list_reply.title || '').trim();
  }
  if (message.image && typeof message.image.caption === 'string') return message.image.caption.trim();
  if (message.video && typeof message.video.caption === 'string') return message.video.caption.trim();
  if (message.document && typeof message.document.caption === 'string') return message.document.caption.trim();
  return '';
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function inferServiceCategory(text) {
  const value = String(text || '');
  if (/\b(drain|drainage|drein|blocked|jetting|jetter)\b/i.test(value)) {
    return 'Drain unblocking / drainage';
  }
  if (/\b(leak|leaking|lek)\b/i.test(value)) {
    return 'Leak detection / repair';
  }
  if (/\b(tank|tenk|jojo|backup\s+water|water\s+backup|pump|pomp|water\s+pressure|waterdruk)\b/i.test(value)) {
    return 'Backup water systems';
  }
  if (/\b(filtration|filter)\b/i.test(value)) {
    return 'Water filtration';
  }
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

function classifyWhatsAppMessage(message) {
  const text = extractMessageText(message);

  if (text && matchesAny(text, EXPLICIT_PATTERNS)) {
    return { category: 'EXPLICIT', reason: 'explicit_text_pattern', text };
  }

  if (text && matchesAny(text, PHISHING_PATTERNS)) {
    return { category: 'PHISHING', reason: 'credential_or_account_request', text };
  }

  if (text && URL_PATTERN.test(text) && /\b(login|verify|account|otp|password|pin|bank)\b/i.test(text)) {
    return { category: 'PHISHING', reason: 'suspicious_link_plus_account_request', text };
  }

  if (text && matchesAny(text, SCAM_PATTERNS)) {
    return { category: 'SCAM', reason: 'scam_pattern', text };
  }

  if (text && matchesAny(text, SPAM_PATTERNS)) {
    return { category: 'SPAM_MARKETING', reason: 'unsolicited_marketing_pattern', text };
  }

  if (message && message.referral) {
    return {
      category: 'BUSINESS_SAFE',
      reason: 'click_to_whatsapp_referral',
      text,
      serviceCategory: inferServiceCategory(text),
      urgency: inferUrgency(text),
    };
  }

  if (text && matchesAny(text, BUSINESS_PATTERNS)) {
    return {
      category: 'BUSINESS_SAFE',
      reason: 'business_intent_pattern',
      text,
      serviceCategory: inferServiceCategory(text),
      urgency: inferUrgency(text),
    };
  }

  if (text && matchesAny(text, PERSONAL_PATTERNS)) {
    return { category: 'PERSONAL', reason: 'personal_message_pattern', text };
  }

  const messageType = String((message && message.type) || '').toLowerCase();
  if (['image', 'video', 'audio', 'document', 'sticker'].includes(messageType)) {
    return { category: 'UNKNOWN', reason: 'uninspected_media', text };
  }

  return { category: 'UNKNOWN', reason: 'business_intent_not_proven', text };
}

module.exports = {
  classifyWhatsAppMessage,
  extractMessageText,
  inferServiceCategory,
  inferUrgency,
};
