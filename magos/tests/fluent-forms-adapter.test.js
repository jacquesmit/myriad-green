'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createFluentLeadIngressPayload,
  stableSourceEventId,
  validateFieldMap
} = require('../adapters/fluent-forms-lead');
const {
  createLeadEventFromIngress
} = require('../adapters/lead-ingress');

function mappedPayload(overrides = {}) {
  return createFluentLeadIngressPayload({
    form_id: '17',
    entry_id: '8841',
    evidence_ref:
      'https://myriadgreen.co.za/wp-admin/admin.php?page=fluent_forms&entry_id=8841',
    form_name: 'Contact Us / Quote Request',
    fields: {
      customer_name: 'Test Client',
      mobile_number: '+27 82 555 0101',
      email_address: 'test.client@example.com',
      suburb_field: 'Pretoria East',
      service_field: 'Irrigation Systems',
      message_field: 'Please quote a new irrigation system.',
      page_url_field: 'https://myriadgreen.co.za/irrigation-installation/',
      utm_campaign_field: 'spring-installations',
      upload_field: [
        'https://myriadgreen.co.za/private-upload/photo-1.jpg'
      ],
      unrelated_field: 'must never be guessed into MAGOS'
    },
    fieldMap: {
      contact_name: 'customer_name',
      contact_phone: 'mobile_number',
      contact_email: 'email_address',
      suburb_area: 'suburb_field',
      property_or_suburb: 'suburb_field',
      service_category: 'service_field',
      issue_summary: 'message_field'
    },
    metadataMap: {
      page_url: 'page_url_field',
      utm_campaign: 'utm_campaign_field',
      upload_refs: 'upload_field'
    },
    ...overrides
  });
}

test('Fluent adapter maps only explicitly configured provider keys', () => {
  const payload = mappedPayload();

  assert.equal(payload.source, 'FLUENT_FORMS');
  assert.equal(
    payload.source_event_id,
    'FLUENT_FORMS|FORM:17|ENTRY:8841'
  );
  assert.equal(payload.lead.contact_name, 'Test Client');
  assert.equal(payload.lead.contact_phone, '+27 82 555 0101');
  assert.equal(payload.lead.contact_email, 'test.client@example.com');
  assert.equal(payload.lead.suburb_area, 'Pretoria East');
  assert.equal(payload.lead.service_category, 'Irrigation Systems');
  assert.equal(
    Object.values(payload.lead).includes('must never be guessed into MAGOS'),
    false
  );
});

test('unmapped provider fields do not become identity or service facts', () => {
  const payload = createFluentLeadIngressPayload({
    form_id: '17',
    entry_id: '8842',
    evidence_ref: 'https://example.invalid/entry/8842',
    fields: {
      obvious_name_label: 'Looks Like A Name',
      obvious_phone_label: '0820000000',
      obvious_service_label: 'Irrigation'
    },
    fieldMap: {}
  });

  assert.equal(payload.lead.contact_name, undefined);
  assert.equal(payload.lead.contact_phone, undefined);
  assert.equal(payload.lead.service_category, undefined);
  assert.equal(payload.lead.source_type, 'WEBSITE_FORM');
});

test('stable Fluent source identity is form plus provider entry ID', () => {
  assert.equal(
    stableSourceEventId('17', '8841'),
    stableSourceEventId('17', '8841')
  );
  assert.notEqual(
    stableSourceEventId('17', '8841'),
    stableSourceEventId('17', '8842')
  );
  assert.notEqual(
    stableSourceEventId('17', '8841'),
    stableSourceEventId('18', '8841')
  );
});

test('missing provider form ID, entry ID or evidence reference fails closed', () => {
  const base = {
    form_id: '17',
    entry_id: '8841',
    evidence_ref: 'https://example.invalid/entry/8841',
    fields: {},
    fieldMap: {}
  };

  assert.throws(
    () => createFluentLeadIngressPayload({
      ...base,
      form_id: ''
    }),
    error => error.code === 'FLUENT_FORM_ID_REQUIRED'
  );
  assert.throws(
    () => createFluentLeadIngressPayload({
      ...base,
      entry_id: ''
    }),
    error => error.code === 'FLUENT_ENTRY_ID_REQUIRED'
  );
  assert.throws(
    () => createFluentLeadIngressPayload({
      ...base,
      evidence_ref: ''
    }),
    error => error.code === 'FLUENT_EVIDENCE_REQUIRED'
  );
});

test('field map rejects unsupported canonical targets instead of silently copying them', () => {
  assert.throws(
    () => validateFieldMap({
      contact_name: 'name',
      payment_status: 'paid'
    }),
    error => error.code === 'FLUENT_FIELD_MAP_UNKNOWN_CANONICAL'
  );
});

test('source page/campaign/upload context is preserved only through explicit metadata mapping', () => {
  const payload = mappedPayload();

  assert.deepEqual(payload.source_metadata, {
    page_url: 'https://myriadgreen.co.za/irrigation-installation/',
    utm_campaign: 'spring-installations',
    upload_refs: [
      'https://myriadgreen.co.za/private-upload/photo-1.jpg'
    ],
    provider: 'FLUENT_FORMS',
    provider_form_id: '17',
    provider_form_name: 'Contact Us / Quote Request',
    provider_entry_id: '8841'
  });
});

test('P5O preserves Fluent provenance while unscanned guards remain UNKNOWN', () => {
  const request = mappedPayload();
  const event = createLeadEventFromIngress(request, {
    receivedAt: new Date('2026-09-20T20:00:00Z')
  });

  assert.equal(event.event_type, 'LEAD_SUBMITTED');
  assert.equal(event.source, 'FLUENT_FORMS');
  assert.deepEqual(event.guards, {
    spam: 'UNKNOWN',
    phishing: 'UNKNOWN',
    explicit_content: 'UNKNOWN',
    malware: 'UNKNOWN',
    irrelevant: 'UNKNOWN'
  });
  assert.deepEqual(event.metadata.source_metadata, request.source_metadata);
  assert.equal(
    event.payload.lead.landing_page_or_campaign,
    ''
  );
});

test('Fluent adapter can carry attested guard results without inventing scanner provenance', () => {
  const request = mappedPayload({
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR'
    },
    safety_attestation: {
      provider: 'APPROVED_SCANNER',
      scan_id: 'SCAN-8841',
      scanned_at: '2026-09-20T20:00:00Z'
    }
  });

  const event = createLeadEventFromIngress(request);
  assert.equal(event.guards.spam, 'CLEAR');
  assert.equal(
    event.metadata.safety_attestation.scan_id,
    'SCAN-8841'
  );
});

test('P5O rejects unsupported arbitrary source metadata', () => {
  const request = mappedPayload();
  request.source_metadata.secret_internal_blob = 'no';

  assert.throws(
    () => createLeadEventFromIngress(request),
    error => error.code === 'LEAD_INGRESS_SOURCE_METADATA_UNSUPPORTED'
  );
});
