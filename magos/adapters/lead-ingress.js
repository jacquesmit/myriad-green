'use strict';

const { createLeadSubmittedEvent } = require('../processor/lead-observation');

const GUARD_VALUES = new Set(['CLEAR', 'BLOCK', 'UNKNOWN']);
const REQUIRED_GUARDS = [
  'spam',
  'phishing',
  'explicit_content',
  'malware',
  'irrelevant'
];

const ALLOWED_SOURCE_METADATA = new Set([
  'provider',
  'provider_form_id',
  'provider_form_name',
  'provider_entry_id',
  'page_url',
  'page_title',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'upload_refs'
]);

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function parseAllowedLeadSources(value) {
  if (Array.isArray(value)) {
    return new Set(value.map(x => str(x).toUpperCase()).filter(Boolean));
  }
  return new Set(
    str(value)
      .split(',')
      .map(x => x.trim().toUpperCase())
      .filter(Boolean)
  );
}

function normalizeSafetyAttestation(input = {}) {
  const provider = str(input.provider);
  const scanId = str(input.scan_id);
  const scannedAt = str(input.scanned_at);

  if (!provider && !scanId && !scannedAt) return null;
  if (!provider || !scanId || !scannedAt) {
    const error = new Error(
      'safety_attestation requires provider, scan_id and scanned_at'
    );
    error.code = 'LEAD_INGRESS_GUARD_ATTESTATION_INVALID';
    throw error;
  }

  const parsed = new Date(scannedAt);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('safety_attestation.scanned_at must be a valid date');
    error.code = 'LEAD_INGRESS_GUARD_ATTESTATION_INVALID';
    throw error;
  }

  return {
    provider,
    scan_id: scanId,
    scanned_at: parsed.toISOString()
  };
}

function normalizeIngressGuards(input = {}, attestation = null) {
  const suppliedKeys = REQUIRED_GUARDS.filter(
    key => str(input[key]) !== ''
  );

  if (!suppliedKeys.length) {
    return Object.fromEntries(
      REQUIRED_GUARDS.map(key => [key, 'UNKNOWN'])
    );
  }

  const out = {};
  let assertsDecision = false;
  for (const key of REQUIRED_GUARDS) {
    const raw = str(input[key]).toUpperCase() || 'UNKNOWN';
    if (!GUARD_VALUES.has(raw)) {
      const error = new Error('Invalid guard value for ' + key);
      error.code = 'INVALID_GUARD_VALUE';
      error.guard = key;
      throw error;
    }
    if (raw !== 'UNKNOWN') assertsDecision = true;
    out[key] = raw;
  }

  if (assertsDecision && !attestation) {
    const error = new Error(
      'Safety guard decisions require safety_attestation provenance'
    );
    error.code = 'LEAD_INGRESS_GUARD_ATTESTATION_REQUIRED';
    throw error;
  }

  return out;
}

function normalizeSourceMetadata(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('source_metadata must be an object');
    error.code = 'LEAD_INGRESS_SOURCE_METADATA_INVALID';
    throw error;
  }

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_SOURCE_METADATA.has(key)) {
      const error = new Error('Unsupported source_metadata field: ' + key);
      error.code = 'LEAD_INGRESS_SOURCE_METADATA_UNSUPPORTED';
      throw error;
    }

    if (key === 'upload_refs') {
      if (value === undefined || value === null || value === '') continue;
      const refs = Array.isArray(value) ? value : [value];
      out.upload_refs = refs.map(ref => str(ref)).filter(Boolean);
      continue;
    }

    const normalized = str(value);
    if (normalized) out[key] = normalized;
  }
  return out;
}

function assertEvidenceRef(value) {
  const ref = str(value);
  if (!ref) {
    const error = new Error('evidence_ref is required');
    error.code = 'LEAD_INGRESS_EVIDENCE_REQUIRED';
    throw error;
  }
  if (ref.length > 2048) {
    const error = new Error('evidence_ref is too long');
    error.code = 'LEAD_INGRESS_EVIDENCE_INVALID';
    throw error;
  }
  return ref;
}

function createLeadEventFromIngress(input = {}, {
  receivedAt = new Date()
} = {}) {
  const source = str(input.source).toUpperCase();
  const sourceEventId = str(input.source_event_id);
  const evidenceRef = assertEvidenceRef(input.evidence_ref);
  const safetyAttestation = normalizeSafetyAttestation(
    input.safety_attestation || {}
  );
  const sourceMetadata = normalizeSourceMetadata(
    input.source_metadata || {}
  );

  if (!source) {
    const error = new Error('source is required');
    error.code = 'LEAD_INGRESS_SOURCE_REQUIRED';
    throw error;
  }
  if (!sourceEventId) {
    const error = new Error('source_event_id is required');
    error.code = 'LEAD_INGRESS_EVENT_ID_REQUIRED';
    throw error;
  }
  if (!input.lead || typeof input.lead !== 'object' || Array.isArray(input.lead)) {
    const error = new Error('lead object is required');
    error.code = 'LEAD_INGRESS_PAYLOAD_REQUIRED';
    throw error;
  }

  const event = createLeadSubmittedEvent({
    source,
    source_event_id: sourceEventId,
    ...(input.occurred_at ? { occurred_at: input.occurred_at } : {}),
    ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
    guards: normalizeIngressGuards(
      input.guards || {},
      safetyAttestation
    ),
    evidence: [{
      type: str(input.evidence_type) || 'LEAD_SUBMISSION',
      ref: evidenceRef,
      ...(input.evidence_hash ? { hash: str(input.evidence_hash) } : {}),
      ...(input.evidence_label ? { label: str(input.evidence_label) } : {})
    }],
    lead: {
      ...input.lead,
      record_origin: str(input.lead.record_origin) || source,
      acquisition_source: str(input.lead.acquisition_source) || source,
      first_contact_channel: str(input.lead.first_contact_channel) || source
    }
  }, { receivedAt });

  if (safetyAttestation || Object.keys(sourceMetadata).length) {
    event.metadata = {
      ...event.metadata,
      ...(safetyAttestation
        ? { safety_attestation: safetyAttestation }
        : {}),
      ...(Object.keys(sourceMetadata).length
        ? { source_metadata: sourceMetadata }
        : {})
    };
  }
  return event;
}

module.exports = {
  GUARD_VALUES,
  REQUIRED_GUARDS,
  ALLOWED_SOURCE_METADATA,
  parseAllowedLeadSources,
  normalizeSafetyAttestation,
  normalizeIngressGuards,
  normalizeSourceMetadata,
  createLeadEventFromIngress
};
