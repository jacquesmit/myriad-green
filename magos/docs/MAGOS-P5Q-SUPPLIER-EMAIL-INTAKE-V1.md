# MAGOS P5Q — Governed Supplier Email Intake V1

## Status

Code/control implementation only. Production supplier-email source execution remains OFF pending P4 and source-specific acceptance.

## Purpose

Register supplier emails as immutable source events without allowing email text or attachments to mutate supplier pricing, procurement, or commercial truth directly.

Route:

    supplier email source
      -> SUPPLIER_EMAIL_RECEIVED
      -> exact supplier identity
      -> Intake_Queue only
      -> review and/or document extraction routing
      -> downstream governed workers

## Supplier identity

Allowed automatic supplier resolution:

1. explicit canonical supplier_id that exists in Suppliers, or
2. exact individual sender-email token in Suppliers.email.

Not allowed:

- supplier domain matching,
- display-name matching,
- company-name similarity,
- subject/body inference,
- attachment filename inference.

If an explicit supplier_id is correct but the sender email is not registered for that supplier, MAGOS may retain the email in Intake_Queue but opens a post-commit supplier-contact review.

If the matched supplier is not both APPROVED and ACTIVE, Intake evidence may still be retained, but downstream handling requires review.

## Safety guards

Supplier-email observations use the same truth principle as P5O lead ingress:

- missing guard results become UNKNOWN,
- asserted CLEAR/BLOCK values require safety scan provenance,
- provenance must include provider, scan_id and scanned_at.

UNKNOWN guards are already governed by P5 event policy and therefore cannot silently auto-write.

## Source identity

The authoritative source identity is:

    source_system + source_event_id

The Intake ID is deterministic:

    INT-SUPMAIL-<source hash>

A replay of the same source event must therefore resolve to the same lineage.

A source_event_id collision under a different source_system fails closed.

## Evidence requirement

A supplier-email EventEnvelope must contain at least one immutable evidence reference. P5Q does not create synthetic Gmail or attachment evidence identifiers.

## Attachments

Attachment filenames are not evidence of retrievability.

Document extraction routing requires:

- at least one actual attachment_ref,
- attachment_accessibility = ACCESSIBLE,
- filename/reference counts must agree when both are supplied.

Otherwise the Intake row is retained as REVIEW_REQUIRED with routing_action = REVIEW_ATTACHMENT_ACCESS.

No attachment is copied, parsed, priced, or filed by P5Q itself.

## Mutations

P5Q may create one Intake_Queue row only.

It does not:

- create or update Suppliers,
- create Supplier_Quotes,
- create Supplier_Source_Lines,
- create Supplier_Prices,
- release Procurement,
- create client quotes,
- send or reply to email,
- move Drive documents.

Those actions remain owned by downstream governed stages.

## Existing schema

P5Q reuses the existing Intake_Queue extension fields:

- supplier_id
- business_document_type
- attachment_filenames
- attachment_refs
- attachment_accessibility

These fields were already registered in Writer_Schema_Registry as WSR-472:476. P5Q updates the control meaning; it does not create a second intake schema.

## Production acceptance after P4

Run controlled cases for:

1. exact approved supplier email + no attachment,
2. exact approved supplier email + accessible attachment ref,
3. filename without attachment ref,
4. inaccessible attachment,
5. explicit supplier_id + unfamiliar sender,
6. excluded/inactive supplier,
7. unknown sender,
8. ambiguous exact sender,
9. duplicate replay,
10. source_event_id collision under another source,
11. unscanned email with UNKNOWN guards,
12. attested CLEAR/BLOCK guard provenance.

Only after those cases pass may a live Gmail/source adapter be connected.
