# MAGOS P5N — Lead Intake V1

## Status

Code/control implementation only. Legacy MGOS Intake & Sync Watch remains active. Production P5N execution remains OFF until P4 hosted-runtime validation and source-specific parity acceptance.

## Purpose

Convert a trusted lead submission into governed MAGOS records without treating a person's name, an address, or an unverified service guess as canonical identity.

The lead path preserves the existing MGOS model:

    Source event -> Intake_Queue
    Contact/Client -> CRM_Master
    Opportunity -> Jobs_Opportunities
    Property -> Client_Sites only through the separate property authority

P5N deliberately does not create Client_Sites from free-text address/suburb supplied on a lead.

## Exact identity rule

Existing CRM identity may resolve only from:

1. explicit crm_id,
2. explicit contact_id,
3. exact normalized phone evidence,
4. exact email evidence.

Name-only matching is prohibited.

If exact phone/email evidence points to more than one CRM client, the lead routes to review.

If supplied crm_id/contact_id/opportunity_id lineage conflicts, the lead routes to review.

## Source-event identity

The provider source_event_id remains immutable source authority.

P5N uses deterministic source-derived internal IDs so concurrent/retried automated intake does not require a race-prone next-sequence allocator.

Legacy IDs remain valid.

Automated IDs may use:

- CRM-YYYY-A<source hash>
- CON-YYYY-A<source hash>
- OPP-YYYYMMDD-A<source hash>

The same source system + source_event_id always derives the same IDs.

## New lead behavior

A brand-new lead with exact contact identity (phone or email) and a service category may create:

1. one Intake_Queue source-event record,
2. one CRM_Master client/contact row,
3. one first Jobs_Opportunities opportunity.

It does not create a job, quote, invoice, payment, booking, or property record.

Commercial/operational defaults remain conservative:

- NO_QUOTE
- NO_JOB
- payment NOT_APPLICABLE
- review/post NOT_READY
- property_id blank until separate property resolution
- media consent NOT_RECORDED unless explicit evidence says otherwise.

## Existing client behavior

Existing client + explicit exact opportunity_id:

- capture/link the Intake_Queue event,
- do not rewrite CRM_Master,
- do not rewrite Jobs_Opportunities.

Existing client without an exact opportunity_id:

- capture Intake_Queue only,
- create a separate post-commit follow-up review,
- do not guess whether the message is a new commercial need or activity on an existing opportunity.

## Incomplete new lead behavior

Identity missing:

- preserve Intake_Queue source evidence,
- do not create client/contact or opportunity,
- open follow-up review.

Identity present but service category missing:

- preserve Intake_Queue,
- create deterministic client/contact,
- do not create opportunity,
- open follow-up review.

This follows the MGOS rule that unknown is not yes.

## Contact controls

P5N never converts missing do-not-contact information into a false negative.

- explicit do_not_contact=true -> YES
- unknown/absent -> blank
- opt-out reason is retained only with explicit opt-out evidence.

## Runtime registration

LEAD_SUBMITTED must remain absent from the strict GovernedProcessorRegistry until this processor passes its test suite.

After code acceptance, the registry may add LEAD_SUBMITTED as an explicit fifth governed type.

That code registration still does not activate live source adapters.

## Production acceptance

After P4, use controlled non-client fixtures or explicitly approved test events to prove:

1. new identified lead creates exactly Intake + CRM + Opportunity,
2. source replay no-ops,
3. name-only lead never creates CRM identity,
4. existing CRM + exact opportunity links only,
5. existing CRM without opportunity opens review,
6. conflicting identity/opportunity lineage routes to review,
7. property remains separate,
8. read-back matches the legacy Intake & Sync behavior before any legacy retirement.
