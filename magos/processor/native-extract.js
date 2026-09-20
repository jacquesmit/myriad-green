'use strict';

function quality(text) {
  const value = String(text || '').trim();
  const minChars = Number(process.env.MAGOS_NATIVE_MIN_CHARS || 80);
  const minRatio = Number(process.env.MAGOS_NATIVE_MIN_ALNUM_RATIO || 0.25);
  if (!value) return { usable: false, chars: 0, alnumRatio: 0 };

  const alnum = (value.match(/[A-Za-z0-9]/g) || []).length;
  const ratio = value.length ? alnum / value.length : 0;
  return {
    usable: value.length >= minChars && ratio >= minRatio,
    chars: value.length,
    alnumRatio: Number(ratio.toFixed(3))
  };
}

async function extractNative({ buffer, mimeType, nativeText }) {
  if (nativeText != null) {
    const text = String(nativeText);
    return { method: 'PROVIDED_NATIVE_TEXT', text, quality: quality(text) };
  }

  const type = String(mimeType || '').toLowerCase();
  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/xml' ||
    type === 'application/csv'
  ) {
    const text = Buffer.from(buffer || []).toString('utf8');
    return { method: 'TEXT_BUFFER', text, quality: quality(text) };
  }

  if (type === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(Buffer.from(buffer || []));
      const text = result.text || '';
      return {
        method: 'PDF_PARSE',
        text,
        pages: result.numpages || null,
        quality: quality(text)
      };
    } catch (error) {
      return {
        method: 'PDF_PARSE_FAILED',
        text: '',
        quality: quality(''),
        error: error.message
      };
    }
  }

  return {
    method: 'UNSUPPORTED_NATIVE_TYPE',
    text: '',
    quality: quality('')
  };
}

module.exports = { extractNative, quality };
