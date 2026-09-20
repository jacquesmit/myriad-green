# MAGOS P5O — Supplier Email Intake V1

## Status

Code/control implementation only. Legacy MGOS Intake & Sync Watch remains active. Gmail provider actions and production P5O execution remain OFF until P4 hosted-runtime validation plus Gmail/source parity acceptance.

## Purpose

Treat a supplier email as an immutable source event and exact supplier relationship, not as pricing truth.

The P5O route is:

    SUPPLIER_EMAIL_RECEIVED
      -> exact supplier resolution
      -> Intake_Queue source-event record
      -> optional post-commit review

Supplier quote/invoice attachments continue through document extraction and P5J after they exist as retained evidence.

P5O does not write Supplier_Quotes or Supplier_Prices.

## Exact supplier identity

Allowed automatic supplier identity:

1. explicit canonical supplier_id that resolves in Suppliers, or
2. exact sender email token listed in the canonical Suppliers.email field.

Suppliers.email may contain multiple semicolon/comma/newline-separated addresses. P5O compares individual normalized address tokens.

Not allowed:

- supplier-name-only matching,
- sender display name,
- domain-only matching,
- subject/text similarity,
- assumed relationship because the email contains a quote.

If one exact email token appears under multiple suppliers, the event routes to review.

If there is no exact supplier identity, the event routes to review before P5O writes Intake_Queue.

## Explicit supplier ID + new representative email

An upstream trusted adapter may supply an exact supplier_id even when a new representative writes from an email address not yet present in Suppliers.

P5O may then retain the email as an Intake source event because supplier identity is exact, but it creates a separate post-commit review:

    SUPPLIER_CONTACT_EMAIL_REVIEW_REQUIRED

P5O does not silently add the new email address to the supplier master.

## Intake write

The only P5O business mutation is CREATE_IF_ABSENT on Intake_Queue.

It records:

- source system/event/thread,
- sender/recipient/subject,
- exact supplier_id,
- business_document_type if explicitly classified,
- attachment names/references/accessibility,
- immutable evidence link,
- routing action and processing state.

If attachment references exist, routing_action is:

    ROUTE_DOCUMENT_EXTRACTION

This is a routing fact only. P5O does not download the attachment, invent a Drive file, or create pricing rows.

## Review

Post-commit review is opened only when explicitly required, including:

- exact supplier_id but unfamiliar sender email,
- upstream requires_review=true.

Unknown supplier identity is pre-write review and produces no P5O Intake mutation.

## Boundaries

P5O does not:

- approve or reject suppliers,
- change supplier contact data,
- infer supplier identity from domain,
- generate a supplier quote,
- extract attachment content,
- create Supplier_Quotes,
- create Supplier_Source_Lines,
- create Supplier_Prices,
- select a supplier for procurement,
- send or reply to email,
- retire the legacy intake watcher.

## Runtime registration

The P5O acceptance suite passed before registration.

SUPPLIER_EMAIL_RECEIVED is now an explicit governed type in GovernedProcessorRegistry.

This code registration still does not connect Gmail, download attachments, send replies, or retire the legacy intake watcher. Production remains blocked by P4 plus source-specific Gmail parity acceptance.
