'use strict';

const RULES = [
  {
    type: 'BANK_STATEMENT',
    terms: [
      ['bank statement', 5], ['statement period', 3], ['opening balance', 2],
      ['closing balance', 2], ['transaction date', 1], ['debit', 1], ['credit', 1]
    ]
  },
  {
    type: 'PAYMENT_PROOF',
    terms: [
      ['proof of payment', 6], ['payment notification', 5], ['beneficiary', 2],
      ['payment reference', 2], ['amount paid', 2]
    ]
  },
  {
    type: 'SUPPLIER_INVOICE',
    terms: [
      ['tax invoice', 6], ['invoice no', 4], ['invoice number', 4],
      ['vat number', 2], ['subtotal', 1], ['vat', 1], ['total', 1]
    ]
  },
  {
    type: 'SUPPLIER_QUOTE',
    terms: [
      ['quotation', 5], ['quote no', 4], ['quote number', 4], ['validity', 1],
      ['subtotal', 1], ['vat', 1], ['total', 1]
    ]
  },
  {
    type: 'PURCHASE_ORDER',
    terms: [
      ['purchase order', 6], ['po number', 4], ['order number', 2],
      ['supplier', 1], ['delivery', 1]
    ]
  },
  {
    type: 'JOB_REPORT',
    terms: [
      ['job report', 6], ['site report', 5], ['work completed', 3],
      ['technician', 2], ['site address', 1], ['findings', 1]
    ]
  },
  {
    type: 'ORDER',
    terms: [
      ['sales order', 5], ['order confirmation', 4], ['order no', 3],
      ['quantity', 1], ['unit price', 1]
    ]
  },
  {
    type: 'REPORT',
    terms: [
      ['report', 2], ['executive summary', 2], ['findings', 1], ['recommendations', 1]
    ]
  }
];

function scoreRule(text, rule) {
  let score = 0;
  const hits = [];
  for (const [term, weight] of rule.terms) {
    if (text.includes(term)) {
      score += weight;
      hits.push(term);
    }
  }
  return { type: rule.type, score, hits };
}

function classifyDocument({ text = '', fileName = '', hints = {} } = {}) {
  const haystack = (fileName + '\n' + text).toLowerCase();
  const ranked = RULES.map((rule) => scoreRule(haystack, rule))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] || { type: 'OTHER', score: 0, hits: [] };
  const second = ranked[1] || { score: 0 };

  let type = best.score >= 3 ? best.type : 'OTHER';
  let confidence = best.score === 0 ? 0.2 : Math.min(0.98, 0.52 + best.score * 0.055);
  const margin = best.score - second.score;
  if (margin <= 1 && best.score < 7) confidence = Math.min(confidence, 0.72);

  if (hints.documentType) {
    type = hints.documentType;
    confidence = Math.max(confidence, 0.9);
  }

  return {
    type,
    confidence: Number(confidence.toFixed(3)),
    evidence: best.hits,
    ranked: ranked.slice(0, 3)
  };
}

module.exports = { classifyDocument };
