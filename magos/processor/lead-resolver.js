'use strict';

function hasIdentity(lead = {}) {
  return Boolean(lead.contact_phone || lead.contact_email);
}

function exactBasis(candidate = {}) {
  const bases = candidate.matched_by || [];
  return bases.some((x) => String(x).startsWith('PHONE:'))
    ? 'EXACT_PHONE'
    : 'EXACT_EMAIL';
}

class LeadResolver {
  constructor({
    findIntakeBySourceEvent = async () => null,
    findCrmCandidatesByIdentity = async () => [],
    findEntityByCanonicalId = async () => null
  } = {}) {
    this.findIntakeBySourceEvent = findIntakeBySourceEvent;
    this.findCrmCandidatesByIdentity = findCrmCandidatesByIdentity;
    this.findEntityByCanonicalId = findEntityByCanonicalId;
  }

  async resolve(envelope) {
    const lead = envelope?.payload?.lead || {};

    const existingIntake = await this.findIntakeBySourceEvent(
      envelope.source,
      envelope.source_event_id
    );
    if (existingIntake?.__source_system_mismatch) {
      return {
        status: 'CONFLICT',
        confidence: 0,
        basis: 'EXACT_REFERENCE',
        reason:
          'source_event_id already exists under a different source_system.',
        candidates: [{
          existing_source_system: existingIntake.source_system,
          source_event_id: envelope.source_event_id
        }]
      };
    }

    const suppliedCrmId =
      lead.crm_id || envelope?.entity_hints?.crm_id || '';
    const suppliedContactId =
      lead.contact_id || envelope?.entity_hints?.contact_id || '';
    const suppliedOpportunityId =
      lead.opportunity_id || envelope?.entity_hints?.opportunity_id || '';

    let client = null;
    let matchBasis = '';
    if (suppliedCrmId) {
      client = await this.findEntityByCanonicalId('Client', suppliedCrmId);
      if (!client) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Supplied crm_id did not resolve.',
          candidates: []
        };
      }
      if (
        suppliedContactId &&
        client.contact_id &&
        String(client.contact_id) !== String(suppliedContactId)
      ) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Supplied contact_id conflicts with the CRM client row.',
          candidates: [{
            crm_id: suppliedCrmId,
            existing_contact_id: client.contact_id,
            supplied_contact_id: suppliedContactId
          }]
        };
      }
      matchBasis = 'EXACT_ID';
    } else if (suppliedContactId) {
      client = await this.findEntityByCanonicalId(
        'Contact',
        suppliedContactId
      );
      if (!client) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Supplied contact_id did not resolve.',
          candidates: []
        };
      }
      if (!client.crm_id) {
        return {
          status: 'CONFLICT',
          confidence: 0,
          basis: 'EXACT_ID',
          reason: 'Contact row has no canonical crm_id.',
          candidates: []
        };
      }
      matchBasis = 'EXACT_ID';
    } else if (hasIdentity(lead)) {
      const candidates = await this.findCrmCandidatesByIdentity({
        phone: lead.contact_phone,
        email: lead.contact_email
      });

      if (candidates.length > 1) {
        return {
          status: 'AMBIGUOUS',
          confidence: 1,
          basis: 'EXACT_REFERENCE',
          reason:
            'Exact phone/email evidence resolves to more than one CRM client.',
          candidates: candidates.map((x) => ({
            crm_id: x.crm_id,
            contact_id: x.contact_id,
            matched_by: x.matched_by
          }))
        };
      }

      if (candidates.length === 1) {
        const candidate = candidates[0];
        if (!candidate.crm_id) {
          return {
            status: 'CONFLICT',
            confidence: 0,
            basis: 'EXACT_REFERENCE',
            reason:
              'Exact contact identity matched a CRM row without canonical crm_id.',
            candidates: [{
              contact_id: candidate.contact_id || '',
              matched_by: candidate.matched_by
            }]
          };
        }
        client = candidate.record;
        matchBasis = exactBasis(candidate);
      }
    }

    if (client) {
      const crmId = client.crm_id;
      const contactId = client.contact_id || suppliedContactId || '';
      let opportunity = null;

      if (suppliedOpportunityId) {
        opportunity = await this.findEntityByCanonicalId(
          'Opportunity',
          suppliedOpportunityId
        );
        if (!opportunity) {
          return {
            status: 'CONFLICT',
            confidence: 0,
            basis: 'EXACT_ID',
            reason: 'Supplied opportunity_id did not resolve.',
            candidates: []
          };
        }
        if (
          opportunity.client_crm_id &&
          String(opportunity.client_crm_id) !== String(crmId)
        ) {
          return {
            status: 'CONFLICT',
            confidence: 0,
            basis: 'EXACT_ID',
            reason: 'Supplied opportunity belongs to a different CRM client.',
            candidates: [{
              supplied_opportunity_id: suppliedOpportunityId,
              opportunity_client_crm_id: opportunity.client_crm_id,
              matched_crm_id: crmId
            }]
          };
        }
      }

      return {
        status: 'MATCHED',
        confidence: 1,
        basis: matchBasis || 'EXACT_ID',
        entity: {
          type: 'Client',
          id: crmId
        },
        canonical_ids: {
          crm_id: crmId,
          contact_id: contactId,
          ...(opportunity
            ? { opportunity_id: opportunity.opportunity_id }
            : {})
        },
        existing_client: client,
        existing_opportunity: opportunity,
        create_client_allowed: false,
        create_opportunity_allowed: false,
        review_required_after_capture: !opportunity,
        review_reason: opportunity
          ? ''
          : 'Existing CRM identity resolved, but no exact opportunity_id was supplied. Determine whether this is a new commercial need or activity on an existing opportunity.',
        review_reason_code: opportunity
          ? ''
          : 'EXISTING_CLIENT_OPPORTUNITY_REVIEW_REQUIRED',
        candidates: []
      };
    }

    const identityAvailable = hasIdentity(lead);
    const serviceAvailable = Boolean(lead.service_category);

    return {
      status: 'CREATE_ALLOWED',
      confidence: 1,
      basis: 'CREATE_ALLOWED',
      entity: {
        type: 'Lead source event',
        id: envelope.source_event_id
      },
      canonical_ids: {},
      create_client_allowed: identityAvailable,
      create_opportunity_allowed:
        identityAvailable && serviceAvailable,
      review_required_after_capture:
        !identityAvailable || !serviceAvailable,
      review_reason:
        !identityAvailable
          ? 'No exact phone or email identity is available. Preserve the source event and review before creating CRM identity.'
          : !serviceAvailable
            ? 'Contact identity is available, but service category is missing. Create the client/contact only and review before creating an opportunity.'
            : '',
      review_reason_code:
        !identityAvailable
          ? 'LEAD_IDENTITY_REVIEW_REQUIRED'
          : !serviceAvailable
            ? 'LEAD_SERVICE_REVIEW_REQUIRED'
            : '',
      candidates: []
    };
  }
}

module.exports = {
  LeadResolver,
  hasIdentity,
  exactBasis
};
