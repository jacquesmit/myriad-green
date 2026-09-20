'use strict';

const { createEventEnvelope } = require('./event-envelope');

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(name + ' is required');
  }
  return value;
}

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeLead(input = {}) {
  return {
    contact_name: str(input.contact_name),
    contact_phone: str(input.contact_phone),
    contact_email: str(input.contact_email).toLowerCase(),
    company: str(input.company),
    lead_type: str(input.lead_type),
    priority: str(input.priority).toUpperCase(),
    property_or_suburb: str(input.property_or_suburb),
    suburb_area: str(input.suburb_area),
    municipality: str(input.municipality),
    province: str(input.province),
    service_region: str(input.service_region),
    service_category: str(input.service_category),
    service_detail: str(input.service_detail),
    issue_summary: str(input.issue_summary),
    urgency: str(input.urgency).toUpperCase() || 'UNKNOWN',
    source_type: str(input.source_type) || 'LEAD_SUBMISSION',
    source_thread_id: str(input.source_thread_id),
    sender_email: str(input.sender_email).toLowerCase(),
    recipient_email: str(input.recipient_email).toLowerCase(),
    subject: str(input.subject),
    next_action: str(input.next_action),
    next_follow_up_date: str(input.next_follow_up_date),
    notes: str(input.notes),
    message_summary: str(input.message_summary),
    preferred_contact_method: str(input.preferred_contact_method).toUpperCase(),
    do_not_contact:
      input.do_not_contact === true
        ? true
        : input.do_not_contact === false
          ? false
          : null,
    opt_out_reason: str(input.opt_out_reason),
    lead_direction: str(input.lead_direction).toUpperCase() || 'INBOUND',
    record_origin: str(input.record_origin),
    acquisition_source: str(input.acquisition_source),
    first_contact_channel: str(input.first_contact_channel),
    source_detail: str(input.source_detail),
    landing_page_or_campaign: str(input.landing_page_or_campaign),
    media_consent_status: str(input.media_consent_status) || 'NOT_RECORDED',
    owner: str(input.owner) || 'Jacques',
    crm_id: str(input.crm_id),
    contact_id: str(input.contact_id),
    opportunity_id: str(input.opportunity_id)
  };
}

function createLeadSubmittedEvent(input = {}, {
  receivedAt = new Date()
} = {}) {
  const source = required(input.source, 'source');
  const sourceEventId = required(input.source_event_id, 'source_event_id');
  const lead = normalizeLead(input.lead || input);

  return createEventEnvelope({
    source,
    source_event_id: sourceEventId,
    event_type: 'LEAD_SUBMITTED',
    occurred_at: input.occurred_at || receivedAt,
    received_at: input.received_at || receivedAt,
    ...(input.correlation_id
      ? { correlation_id: String(input.correlation_id) }
      : {}),
    entity_hints: {
      ...(lead.crm_id ? { crm_id: lead.crm_id } : {}),
      ...(lead.contact_id ? { contact_id: lead.contact_id } : {}),
      ...(lead.opportunity_id ? { opportunity_id: lead.opportunity_id } : {})
    },
    guards: {
      spam: 'CLEAR',
      phishing: 'CLEAR',
      explicit_content: 'CLEAR',
      malware: 'CLEAR',
      irrelevant: 'CLEAR',
      ...(input.guards || {})
    },
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    payload: { lead },
    metadata: {
      lead_observation_version: 'MAGOS-LEAD-OBSERVATION/V1'
    }
  });
}

module.exports = {
  createLeadSubmittedEvent,
  normalizeLead
};
