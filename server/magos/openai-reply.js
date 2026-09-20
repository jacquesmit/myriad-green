require('dotenv').config();

const MAX_REPLY_CHARS = 1800;

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(name + ' is required.');
  return value;
}

function responseText(payload) {
  if (payload && typeof payload.output_text === 'string') return payload.output_text.trim();
  for (const item of (payload && payload.output) || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string' && content.text.trim()) return content.text.trim();
    }
  }
  return '';
}

function mustReviewGeneratedReply(text) {
  const value = String(text || '');
  const blocked = [
    /\bMAGOS\b/i,
    /\bCRM\b/i,
    /\bclassification\b/i,
    /\binternal\s+(status|summary|workflow)\b/i,
    /\bR\s?\d[\d\s,.]*/i,
    /\b(rand|ZAR)\s?\d/i,
    /\b(payment\s+(has\s+)?(cleared|received|confirmed))\b/i,
    /\b(booking|appointment)\s+(is\s+)?(confirmed|booked)\b/i,
    /\bwe\s+guarantee\b/i,
  ];
  return blocked.some((pattern) => pattern.test(value));
}

async function generateBusinessReply({ message, threadContext, classification }) {
  const apiKey = required('OPENAI_API_KEY');
  const model = String(process.env.OPENAI_MODEL || 'gpt-5.6-luna').trim();

  const instructions = [
    'You write customer-facing email replies for Myriad Green, a Gauteng service business.',
    'Reply naturally and concisely in the language used by the customer when clear; otherwise use English.',
    'For irrigation repairs, installations, backup water, drains, leaks and related enquiries, move the customer toward the minimum information required for the next action.',
    'Ask for suburb early when it is missing. Ask at most 1 to 3 questions in one reply.',
    'Do not expose internal workflow, MAGOS, CRM, classifications, confidence, policies or hidden notes.',
    'Do not invent prices, supplier availability, payment status, booking confirmation, scope, guarantees or site facts.',
    'Unknown is not yes. If important information is missing, ask for it rather than assuming.',
    'Do not give exact pricing unless the incoming thread itself already contains an approved customer-facing price.',
    'Do not claim a booking is confirmed unless the incoming thread explicitly proves it.',
    'Do not discuss or acknowledge blocked/explicit/spam classifications.',
    'Output only the email body. No subject line, no markdown, no commentary.',
  ].join('\n');

  const input = JSON.stringify({
    sender: message.from,
    subject: message.subject,
    incoming_message: message.text.slice(0, 8000),
    service_category: classification.serviceCategory || 'TO_CONFIRM',
    urgency: classification.urgency || 'NORMAL',
    recent_thread_context: threadContext,
  });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      max_output_tokens: 450,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('OpenAI reply generation failed with status ' + response.status + '.');

  const text = responseText(payload).slice(0, MAX_REPLY_CHARS).trim();
  if (!text) throw new Error('OpenAI returned an empty Gmail reply.');

  return { text, requiresReview: mustReviewGeneratedReply(text), model };
}

module.exports = { generateBusinessReply, mustReviewGeneratedReply };
