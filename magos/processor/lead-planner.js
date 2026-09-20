'use strict';

const crypto = require('crypto');
const {
  createIfAbsent,
  composeTransactionPlan
} = require('../writer/operations');

function safeDate(value, fallback = new Date()) {
  const parsed = new Date(value || '');
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed;
}

function dateOnly(value, fallback = new Date()) {
  return safeDate(value, fallback).toISOString().slice(0, 10);
}

function compactDate(value, fallback = new Date()) {
  return dateOnly(value, fallback).replace(/-/g, '');
}

function sourceHash(envelope) {
  return crypto
    .createHash('sha256')
    .update(
      String(envelope.source) + '|' +
      String(envelope.source_event_id)
    )
    .digest('hex')
    .toUpperCase();
}

function deterministicLeadIds(envelope) {
  const hash = sourceHash(envelope);
  const year = dateOnly(envelope.received_at).slice(0, 4);
  const date = compactDate(envelope.received_at);

  return {
    intake_id: 'INT-P5N-' + hash.slice(0, 16),
    crm_id: 'CRM-' + year + '-A' + hash.slice(0, 12),
    contact_id: 'CON-' + year + '-A' + hash.slice(12, 24),
    opportunity_id: 'OPP-' + date + '-A' + hash.slice(24, 36),
    project_record_id: 'LEAD-' + date + '-A' + hash.slice(36, 48)
  };
}

function evidenceLink(envelope) {
  return envelope.evidence?.[0]?.ref || '';
}

function intakeValues(envelope, match, ids, now) {
  const lead = envelope.payload.lead || {};
  const crmId =
    match.canonical_ids?.crm_id ||
    (match.create_client_allowed ? ids.crm_id : '');
  const opportunityId =
    match.canonical_ids?.opportunity_id ||
    (match.create_opportunity_allowed ? ids.opportunity_id : '');
  const needsReview = Boolean(match.review_required_after_capture);

  return {
    intake_id: ids.intake_id,
    received_at: envelope.received_at,
    source_system: envelope.source,
    source_type: lead.source_type || 'LEAD_SUBMISSION',
    source_event_id: envelope.source_event_id,
    source_thread_id: lead.source_thread_id || '',
    sender_name: lead.contact_name || '',
    sender_email: lead.sender_email || lead.contact_email || '',
    recipient_email: lead.recipient_email || '',
    subject_or_file_name: lead.subject || '',
    contact_name: lead.contact_name || '',
    contact_email: lead.contact_email || '',
    contact_phone: lead.contact_phone || '',
    company: lead.company || '',
    property_or_suburb: lead.property_or_suburb || '',
    service_category: lead.service_category || '',
    urgency: lead.urgency || 'UNKNOWN',
    source_link: evidenceLink(envelope),
    match_status:
      match.status === 'MATCHED'
        ? 'EXACT_MATCH'
        : crmId
          ? 'NEW_RECORD'
          : 'DATA_GAP',
    matched_crm_id: crmId,
    matched_opportunity_id: opportunityId,
    routing_action:
      match.status === 'MATCHED' && opportunityId
        ? 'LINK_EXISTING'
        : match.status === 'MATCHED'
          ? 'REVIEW_OPPORTUNITY'
          : opportunityId
            ? 'CREATE_CRM_OPPORTUNITY'
            : crmId
              ? 'CREATE_CRM_REVIEW_OPPORTUNITY'
              : 'REVIEW_REQUIRED',
    processing_status: needsReview ? 'REVIEW_REQUIRED' : 'LINKED',
    review_reason: match.review_reason || '',
    last_checked_at: now.toISOString(),
    notes: lead.notes || ''
  };
}

function clientValues(envelope, match, ids, now) {
  const lead = envelope.payload.lead || {};
  const date = dateOnly(envelope.received_at, now);
  const opportunityId =
    match.create_opportunity_allowed ? ids.opportunity_id : '';
  const sourceRef = evidenceLink(envelope);

  return {
    date_added: date,
    company: lead.company || lead.contact_name || '',
    lead_type: lead.lead_type || 'TO_CONFIRM',
    priority: lead.priority || '',
    phone: lead.contact_phone || '',
    preferred_call_number:
      lead.preferred_contact_method === 'CALL'
        ? (lead.contact_phone || '')
        : '',
    email: lead.contact_email || '',
    address: lead.property_or_suburb || '',
    recommended_services: lead.service_category || '',
    next_action:
      lead.next_action ||
      (opportunityId
        ? 'Qualify the submitted lead and confirm the next commercial step.'
        : 'Review the submitted lead before creating an opportunity.'),
    crm_status: 'NEW',
    notes: lead.notes || '',
    owner: lead.owner || 'Jacques',
    response_status: 'NEW',
    opportunity_stage: opportunityId ? 'NEW_LEAD' : 'TO_CONFIRM',
    quote_status: 'NO_QUOTE',
    job_status: 'NO_JOB',
    review_status: 'NOT_READY',
    post_status: 'NOT_READY',
    do_not_contact:
      lead.do_not_contact === true ? 'YES' : '',
    opt_out_reason:
      lead.do_not_contact === true
        ? (lead.opt_out_reason || '')
        : '',
    last_action_date: date,
    next_follow_up_date: lead.next_follow_up_date || '',
    conversation_summary: lead.message_summary || '',
    outcome: '',
    preferred_email:
      lead.preferred_contact_method === 'EMAIL'
        ? (lead.contact_email || '')
        : '',
    lead_direction: lead.lead_direction || 'INBOUND',
    record_origin: lead.record_origin || envelope.source,
    acquisition_source: lead.acquisition_source || envelope.source,
    first_contact_channel:
      lead.first_contact_channel || envelope.source,
    source_detail: lead.source_detail || '',
    source_evidence: sourceRef,
    source_confidence: 'CONFIRMED_RECORD',
    first_touch_date: date,
    landing_page_or_campaign: lead.landing_page_or_campaign || '',
    crm_id: ids.crm_id,
    contact_id: ids.contact_id,
    property_id: '',
    opportunity_id: opportunityId,
    source_message_id: envelope.source_event_id
  };
}

function opportunityValues(envelope, ids, now) {
  const lead = envelope.payload.lead || {};
  const date = dateOnly(envelope.received_at, now);
  const sourceRef = evidenceLink(envelope);

  return {
    project_record_id: ids.project_record_id,
    opportunity_id: ids.opportunity_id,
    job_id: '',
    client_crm_id: ids.crm_id,
    contact_id: ids.contact_id,
    property_id: '',
    client_name: lead.contact_name || lead.company || '',
    phone: lead.contact_phone || '',
    site_address: lead.property_or_suburb || '',
    suburb_area: lead.suburb_area || '',
    municipality: lead.municipality || '',
    province: lead.province || '',
    service_region: lead.service_region || '',
    primary_service: lead.service_category,
    service_detail: lead.service_detail || '',
    issue_summary: lead.issue_summary || lead.message_summary || '',
    document_date: date,
    job_status: 'NO_JOB',
    payment_status: 'NOT_APPLICABLE',
    review_status: 'NOT_READY',
    post_status: 'NOT_READY',
    next_action:
      lead.next_action ||
      'Qualify the submitted lead and confirm the next commercial step.',
    next_follow_up_date: lead.next_follow_up_date || '',
    client_input_evidence_link: sourceRef,
    media_consent_status:
      lead.media_consent_status || 'NOT_RECORDED',
    source:
      envelope.source + ' source event ' + envelope.source_event_id,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function planLeadSubmitted(envelope, match, {
  now = () => new Date()
} = {}) {
  const at = now();
  const ids = deterministicLeadIds(envelope);
  const writes = [];

  writes.push(createIfAbsent({
    store: 'crm',
    workbook_role: 'CRM',
    sheet: 'Intake_Queue',
    key: {
      header: 'intake_id',
      value: ids.intake_id
    },
    authority: 'AUTHORITATIVE',
    entity_type: 'Source event',
    intent: 'REGISTER_LEAD_SOURCE_EVENT',
    values: intakeValues(envelope, match, ids, at),
    required_headers: [
      'intake_id',
      'source_system',
      'source_event_id',
      'processing_status'
    ]
  }));

  if (match.create_client_allowed) {
    writes.push(createIfAbsent({
      store: 'crm',
      workbook_role: 'CRM',
      sheet: 'CRM_Master',
      key: {
        header: 'crm_id',
        value: ids.crm_id
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Client',
      intent: 'CREATE_LEAD_CLIENT_CONTACT',
      values: clientValues(envelope, match, ids, at),
      required_headers: [
        'crm_id',
        'contact_id',
        'source_message_id'
      ]
    }));
  }

  if (match.create_opportunity_allowed) {
    writes.push(createIfAbsent({
      store: 'crm',
      workbook_role: 'CRM',
      sheet: 'Jobs_Opportunities',
      key: {
        header: 'opportunity_id',
        value: ids.opportunity_id
      },
      authority: 'AUTHORITATIVE',
      entity_type: 'Opportunity',
      intent: 'CREATE_FIRST_LEAD_OPPORTUNITY',
      values: opportunityValues(envelope, ids, at),
      required_headers: [
        'opportunity_id',
        'client_crm_id',
        'contact_id',
        'primary_service'
      ]
    }));
  }

  return composeTransactionPlan({
    idempotency_key: envelope.idempotency_key,
    event_type: envelope.event_type,
    source_event_id: envelope.source_event_id,
    trigger_type: envelope.source,
    input_scope: 'LEAD_SUBMITTED',
    evidence_link: evidenceLink(envelope),
    preconditions: [],
    writes
  });
}

module.exports = {
  planLeadSubmitted,
  deterministicLeadIds,
  intakeValues,
  clientValues,
  opportunityValues,
  dateOnly,
  sourceHash
};
