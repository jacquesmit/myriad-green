const { classifyGmailMessage } = require('../gmail-safety');

function classify(overrides = {}) {
  return classifyGmailMessage({
    from: 'client@example.com',
    subject: '',
    text: '',
    headers: [],
    attachmentMimeTypes: [],
    ...overrides,
  });
}

describe('MAGOS Gmail safety gate', () => {
  test('passes a clear irrigation enquiry', () => {
    const result = classify({
      subject: 'Irrigation quote',
      text: 'Please quote on an irrigation installation in Centurion.',
    });
    expect(result.category).toBe('BUSINESS_SAFE');
    expect(result.serviceCategory).toBe('Irrigation systems');
  });

  test('blocks explicit content before model use', () => {
    const result = classify({ text: 'Here are explicit nude photos.' });
    expect(result.category).toBe('EXPLICIT');
  });

  test('blocks unsolicited SEO spam', () => {
    const result = classify({ text: 'We offer SEO services and link building for your website.' });
    expect(result.category).toBe('SPAM');
  });

  test('blocks phishing-style credential requests', () => {
    const result = classify({ text: 'Verify your bank account and send your OTP here.' });
    expect(result.category).toBe('PHISHING');
  });

  test('routes profanity to review rather than auto reply', () => {
    const result = classify({
      text: 'Your sprinkler is fucking broken and I need a repair in Pretoria.',
    });
    expect(result.category).toBe('PROFANITY_REVIEW');
  });

  test('routes uninspected visual media to review', () => {
    const result = classify({
      subject: 'Irrigation photos',
      text: 'These are photos of my irrigation repair in Pretoria.',
      attachmentMimeTypes: ['image/jpeg'],
    });
    expect(result.category).toBe('MEDIA_REVIEW');
  });

  test('does not reply to automated/list mail', () => {
    const result = classify({
      from: 'no-reply@example.com',
      subject: 'Notification',
      text: 'Irrigation account notification',
    });
    expect(result.category).toBe('NO_REPLY_AUTOMATED');
  });
});
