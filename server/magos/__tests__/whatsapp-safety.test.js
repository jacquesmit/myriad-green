const {
  classifyWhatsAppMessage,
} = require('../whatsapp-safety');

describe('MAGOS WhatsApp safety gate', () => {
  test('passes a clear irrigation enquiry', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'Hi, I need a quote to repair my irrigation controller in Pretoria.' },
    });
    expect(result.category).toBe('BUSINESS_SAFE');
    expect(result.serviceCategory).toBe('Irrigation systems');
  });

  test('passes a click-to-WhatsApp referral without forcing raw text storage', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'Hi' },
      referral: { source_type: 'ad' },
    });
    expect(result.category).toBe('BUSINESS_SAFE');
    expect(result.reason).toBe('click_to_whatsapp_referral');
  });

  test('blocks obvious personal content', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'Happy birthday, see you tonight.' },
    });
    expect(result.category).toBe('PERSONAL');
  });

  test('blocks explicit text', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'Send me nudes.' },
    });
    expect(result.category).toBe('EXPLICIT');
  });

  test('blocks credential phishing', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'Verify your account and send your OTP at https://example.invalid.' },
    });
    expect(result.category).toBe('PHISHING');
  });

  test('blocks common investment scam language', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'Crypto investment with guaranteed profit. Double your money.' },
    });
    expect(result.category).toBe('SCAM');
  });

  test('blocks unrelated bulk marketing', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'We sell SEO services and bulk WhatsApp marketing.' },
    });
    expect(result.category).toBe('SPAM_MARKETING');
  });

  test('holds a generic greeting instead of guessing business intent', () => {
    const result = classifyWhatsAppMessage({
      type: 'text',
      text: { body: 'Hi' },
    });
    expect(result.category).toBe('UNKNOWN');
  });

  test('holds uninspected media and does not assume it is safe', () => {
    const result = classifyWhatsAppMessage({
      type: 'image',
      image: { id: 'media-id' },
    });
    expect(result.category).toBe('UNKNOWN');
    expect(result.reason).toBe('uninspected_media');
  });
});
