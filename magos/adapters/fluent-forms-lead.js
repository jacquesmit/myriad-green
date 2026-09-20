'use strict';

const CANONICAL_LEAD_FIELDS = new Set([
  'contact_name',
  'contact_phone',
  'contact_email',
  'company',
  'lead_type',
  'priority',
  'property_or_suburb',
  'suburb_area',
  'municipality',
  'province',
  'service_region',
  'service_category',
  'service_detail',
  'issue_summary',
  'urgency',
  'source_type',
  'source_thread_id',
  'sender_email',
  'recipient_email',
  'subject',
  'next_action',
  'next_follow_up_date',
  'notes',
  'message_summary',
  'preferred_contact_method',
  'do_not_contact',
  'opt_out_reason',
  'lead_direction',
  'record_origin',
  'acquisition_source',
  'first_contact_channel',
  'source_detail',
  'landing_page_or_campaign',
  'media_consent_status',
  'owner',
  'crm_id',
  'contact_id',
  'opportunity_id'
]);

const SOURCE_METADATA_FIELDS = new Set([
  'page_url',
  'page_title',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'upload_refs'
]);

function required(value, name, code) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(name + ' is required');
    error.code = code;
    throw error;
  }
  return value;
}

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function exactField(fields, providerKey) {
  if (!providerKey) return undefined;
  if (!Object.prototype.hasOwnProperty.call(fields, providerKey)) {
    return undefined;
  }
  return fields[providerKey];
}

function validateFieldMap(fieldMap = {}) {
  if (!fieldMap || typeof fieldMap !== 'object' || Array.isArray(fieldMap)) {
    const error = new Error('fieldMap must be an object');
    error.code = 'FLUENT_FIELD_MAP_INVALID';
    throw error;
  }

  for (const [canonical, providerKey] of Object.entries(fieldMap)) {
    if (!CANONICAL_LEAD_FIELDS.has(canonical)) {
      const error = new Error(
        'Unsupported canonical Fluent lead field: ' + canonical
      );
      error.code = 'FLUENT_FIELD_MAP_UNKNOWN_CANONICAL';
      throw error;
    }
    if (!str(providerKey)) {
      const error = new Error(
        'Provider field key is empty for canonical field ' + canonical
      );
      error.code = 'FLUENT_FIELD_MAP_INVALID';
      throw error;
    }
  }
  return fieldMap;
}

function mapLeadFields(fields, fieldMap) {
  const lead = {};
  for (const [canonical, providerKey] of Object.entries(fieldMap)) {
    const value = exactField(fields, providerKey);
    if (value === undefined || value === null || value === '') continue;

    // Preserve source values. P5O/P5N own normalization and truth decisions.
    lead[canonical] = value;
  }
  return lead;
}

function normalizeUploadRefs(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .map(item => str(item))
      .filter(Boolean);
  }
  return [str(value)].filter(Boolean);
}

function mapSourceMetadata(fields, metadataMap = {}, explicit = {}) {
  if (
    metadataMap &&
    (typeof metadataMap !== 'object' || Array.isArray(metadataMap))
  ) {
    const error = new Error('metadataMap must be an object');
    error.code = 'FLUENT_METADATA_MAP_INVALID';
    throw error;
  }

  const metadata = {};
  for (const [canonical, providerKey] of Object.entries(metadataMap || {})) {
    if (!SOURCE_METADATA_FIELDS.has(canonical)) {
      const error = new Error(
        'Unsupported Fluent source metadata field: ' + canonical
      );
      error.code = 'FLUENT_METADATA_MAP_UNKNOWN_CANONICAL';
      throw error;
    }
    if (!str(providerKey)) {
      const error = new Error(
        'Provider metadata field key is empty for ' + canonical
      );
      error.code = 'FLUENT_METADATA_MAP_INVALID';
      throw error;
    }

    const value = exactField(fields, providerKey);
    if (value === undefined || value === null || value === '') continue;
    metadata[canonical] =
      canonical === 'upload_refs'
        ? normalizeUploadRefs(value)
        : value;
  }

  for (const key of SOURCE_METADATA_FIELDS) {
    const value = explicit?.[key];
    if (value === undefined || value === null || value === '') continue;
    metadata[key] =
      key === 'upload_refs'
        ? normalizeUploadRefs(value)
        : value;
  }

  return metadata;
}

function validateEvidenceRef(value) {
  const ref = str(value);
  let parsed;
  try {
    parsed = new URL(ref);
  } catch {
    const error = new Error('evidence_ref must be an absolute HTTPS URL');
    error.code = 'FLUENT_EVIDENCE_INVALID';
    throw error;
  }
  if (parsed.protocol !== 'https:') {
    const error = new Error('evidence_ref must use HTTPS');
    error.code = 'FLUENT_EVIDENCE_INVALID';
    throw error;
  }
  return ref;
}

function stableSourceEventId(formId, entryId) {
  return [
    'FLUENT_FORMS',
    'FORM:' + encodeURIComponent(String(formId)),
    'ENTRY:' + encodeURIComponent(String(entryId))
  ].join('|');
}

function createFluentLeadIngressPayload({
  form_id,
  entry_id,
  evidence_ref,
  fields,
  fieldMap,
  metadataMap = {},
  sourceMetadata = {},
  form_name = '',
  occurred_at = '',
  correlation_id = '',
  safety_attestation = null,
  guards = null,
  evidence_hash = '',
  evidence_label = ''
} = {}) {
  const formId = required(
    str(form_id),
    'form_id',
    'FLUENT_FORM_ID_REQUIRED'
  );
  const entryId = required(
    str(entry_id),
    'entry_id',
    'FLUENT_ENTRY_ID_REQUIRED'
  );
  required(
    str(evidence_ref),
    'evidence_ref',
    'FLUENT_EVIDENCE_REQUIRED'
  );
  const evidenceRef = validateEvidenceRef(evidence_ref);

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    const error = new Error('fields object is required');
    error.code = 'FLUENT_FIELDS_REQUIRED';
    throw error;
  }

  const checkedMap = validateFieldMap(fieldMap || {});
  const lead = mapLeadFields(fields, checkedMap);
  const sourceMetadataMapped = mapSourceMetadata(
    fields,
    metadataMap,
    sourceMetadata
  );

  sourceMetadataMapped.provider = 'FLUENT_FORMS';
  sourceMetadataMapped.provider_form_id = String(formId);
  if (form_name) sourceMetadataMapped.provider_form_name = String(form_name);
  sourceMetadataMapped.provider_entry_id = String(entryId);

  // Do not infer identity/service values from field labels or descriptions.
  // An empty mapped lead is still a valid source event; P5N will retain/review it.
  return {
    source: 'FLUENT_FORMS',
    source_event_id: stableSourceEventId(formId, entryId),
    ...(occurred_at ? { occurred_at } : {}),
    ...(correlation_id ? { correlation_id } : {}),
    evidence_ref: evidenceRef,
    evidence_type: 'FLUENT_FORM_ENTRY',
    ...(evidence_hash ? { evidence_hash } : {}),
    evidence_label:
      evidence_label ||
      (form_name
        ? 'Fluent Forms ' + form_name + ' entry ' + entryId
        : 'Fluent Forms entry ' + entryId),
    ...(guards ? { guards } : {}),
    ...(safety_attestation ? { safety_attestation } : {}),
    source_metadata: sourceMetadataMapped,
    lead: {
      ...lead,
      source_type: lead.source_type || 'WEBSITE_FORM',
      record_origin: lead.record_origin || 'FLUENT_FORMS',
      acquisition_source: lead.acquisition_source || 'WEBSITE',
      first_contact_channel:
        lead.first_contact_channel || 'WEBSITE_FORM',
      source_detail:
        lead.source_detail ||
        [
          'Fluent Forms form_id=' + formId,
          'entry_id=' + entryId
        ].join(' | ')
    }
  };
}

module.exports = {
  CANONICAL_LEAD_FIELDS,
  SOURCE_METADATA_FIELDS,
  exactField,
  validateFieldMap,
  mapLeadFields,
  mapSourceMetadata,
  normalizeUploadRefs,
  validateEvidenceRef,
  stableSourceEventId,
  createFluentLeadIngressPayload
};
