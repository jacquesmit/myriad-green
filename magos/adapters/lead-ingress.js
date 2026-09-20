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

function normalizeIngressGuards(input = {}) {
  const out = {};
  for (const key of REQUIRED_GUARDS) {
    const raw = str(input[key]).toUpperCase() || 'UNKNOWN';
    if (!GUARD_VALUES.has(raw)) {
      const error = new Error('Invalid guard value for ' + key);
      error.code = 'INVALID_GUARD_VALUE';
      error.guard = key;
      throw error;
    }
    out[key] = raw;
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

  return createLeadSubmittedEvent({
    source,
    source_event_id: sourceEventId,
    ...(input.occurred_at ? { occurred_at: input.occurred_at } : {}),
    ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
    guards: normalizeIngressGuards(input.guards || {}),
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
}

module.exports = {
  GUARD_VALUES,
  REQUIRED_GUARDS,
  parseAllowedLeadSources,
  normalizeIngressGuards,
  createLeadEventFromIngress
};
