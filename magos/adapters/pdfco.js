'use strict';

class PdfCoAdapter {
  constructor({
    apiKey = process.env.PDFCO_API_KEY,
    ocrMode = process.env.PDFCO_OCR_MODE || 'Auto',
    fetchImpl = global.fetch
  } = {}) {
    this.apiKey = apiKey;
    this.ocrMode = ocrMode;
    this.fetch = fetchImpl;
    if (!this.fetch) throw new Error('A fetch implementation is required');
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  headers(extra = {}) {
    if (!this.apiKey) throw new Error('PDFCO_API_KEY is not configured');
    return { 'x-api-key': this.apiKey, ...extra };
  }

  async requestJson(url, options = {}) {
    const response = await this.fetch(url, options);
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('PDF.co returned non-JSON response: ' + text.slice(0, 300));
    }
    if (!response.ok || json.error) {
      throw new Error('PDF.co request failed: ' + (json.message || json.status || response.status));
    }
    return json;
  }

  async uploadBuffer({ buffer, fileName, mimeType = 'application/octet-stream' }) {
    const name = encodeURIComponent(fileName || 'document.bin');
    const contentType = encodeURIComponent(mimeType || 'application/octet-stream');
    const presignUrl =
      'https://api.pdf.co/v1/file/upload/get-presigned-url?contenttype=' +
      contentType + '&name=' + name;

    const ticket = await this.requestJson(presignUrl, {
      method: 'GET',
      headers: this.headers()
    });

    const put = await this.fetch(ticket.presignedUrl, {
      method: 'PUT',
      headers: { 'content-type': mimeType || 'application/octet-stream' },
      body: buffer
    });
    if (!put.ok) {
      throw new Error('PDF.co presigned upload failed with HTTP ' + put.status);
    }

    return {
      url: ticket.url,
      credits: ticket.credits,
      remainingCredits: ticket.remainingCredits
    };
  }

  async extractText({ url }) {
    const profiles = JSON.stringify({ OCRMode: this.ocrMode });
    const json = await this.requestJson('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        url,
        inline: true,
        async: false,
        profiles
      })
    });

    const body = json.body ?? json.text ?? json.result ?? '';
    return {
      text: typeof body === 'string' ? body : JSON.stringify(body),
      raw: json,
      credits: json.credits,
      remainingCredits: json.remainingCredits
    };
  }

  async parseWithTemplate({ url, templateId }) {
    if (!templateId) return null;
    return this.requestJson('https://api.pdf.co/v1/pdf/documentparser', {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        url,
        outputFormat: 'JSON',
        templateId: String(templateId),
        inline: true,
        async: false
      })
    });
  }

  async parseInvoiceAi({ url }) {
    return this.requestJson('https://api.pdf.co/v1/ai-invoice-parser', {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ url })
    });
  }
}

module.exports = { PdfCoAdapter };
