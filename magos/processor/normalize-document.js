'use strict';

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

function parseMoney(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9,.-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(',', '.')
    : cleaned.replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function objectsToMap(objects) {
  const out = {};
  for (const item of Array.isArray(objects) ? objects : []) {
    if (!item || !item.name) continue;
    out[String(item.name)] = item.value ?? null;
  }
  return out;
}

function normalizeDocument({ text = '', classification, structured = null } = {}) {
  const clean = String(text || '').replace(/\r/g, '');
  const structuredMap = structured && Array.isArray(structured.objects)
    ? objectsToMap(structured.objects)
    : (structured || {});

  const documentNumber =
    structuredMap.invoiceNumber ||
    structuredMap.quoteNumber ||
    structuredMap.documentNumber ||
    firstMatch(clean, [
      /(?:invoice|quote|quotation|order|po)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9._\/-]+)/i,
      /\b(?:QTE|QU|INV|IN|PO)[-\s]?([A-Z0-9._\/-]{3,})\b/i
    ]);

  const totalRaw =
    structuredMap.total ||
    structuredMap.totalAmount ||
    firstMatch(clean, [
      /^(?:grand\s+total|amount\s+due|total)\s*[:\-]?\s*(?:ZAR|R)?\s*([0-9][0-9 ,.]*)/im
    ]);

  const vatRaw =
    structuredMap.vat ||
    structuredMap.tax ||
    firstMatch(clean, [
      /(?:vat|tax)\s*(?:15%|@\s*15%)?\s*[:\-]?\s*(?:ZAR|R)?\s*([0-9][0-9 ,.]*)/i
    ]);

  const subtotalRaw =
    structuredMap.subtotal ||
    firstMatch(clean, [
      /subtotal\s*[:\-]?\s*(?:ZAR|R)?\s*([0-9][0-9 ,.]*)/i
    ]);

  const date =
    structuredMap.invoiceDate ||
    structuredMap.date ||
    firstMatch(clean, [
      /(?:invoice\s+date|quote\s+date|date)\s*[:\-]?\s*([0-3]?\d[\/\-.][01]?\d[\/\-.](?:20)?\d{2,4})/i,
      /(?:invoice\s+date|quote\s+date|date)\s*[:\-]?\s*(\d{4}[\/\-.][01]\d[\/\-.][0-3]\d)/i
    ]);

  const currency = /\bZAR\b|\bR\s?\d/.test(clean) ? 'ZAR' : (structuredMap.currency || null);

  return {
    document_type: classification?.type || 'OTHER',
    document_number: documentNumber,
    document_date: date,
    currency,
    subtotal: parseMoney(subtotalRaw),
    vat: parseMoney(vatRaw),
    total: parseMoney(totalRaw),
    line_items: Array.isArray(structuredMap.lineItems) ? structuredMap.lineItems : [],
    structured_fields: structuredMap
  };
}

module.exports = { normalizeDocument, parseMoney };
