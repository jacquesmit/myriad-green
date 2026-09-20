# MAGOS P5J — Supplier Quote / Source Line / Price Intake V1

## Status

Code/control implementation only. Production supplier mutations remain OFF until P4 hosted-runtime validation and controlled source acceptance.

## Purpose

Capture supplier pricing evidence without allowing loose supplier descriptions to redefine the product master.

The controlled route is:

    supplier source evidence
      -> SUPPLIER_PRICE_OBSERVED
      -> exact supplier/quote/source-line resolution
      -> Supplier_Quotes + Supplier_Source_Lines
      -> exact canonical-part gate
      -> Supplier_Prices only when exact

## Supplier gate

Automated intake requires the exact supplier_id to resolve to:

    supplier_approval_state = APPROVED
    active_status = ACTIVE

Anything else routes to review before supplier pricing state is mutated.

## Quote identity

supplier_quote_number is mandatory.

If that number already exists under another supplier, processing stops as a conflict.

If it already exists under the same supplier, the existing supplier_quote_id is reused.

New quote IDs are deterministic from supplier_id + supplier_quote_number.

## Source-line identity

Each source line uses:

    <source_system>|<source_event_id>|<line_no>

The source line records supplier-provided facts even if product mapping is unresolved.

An existing source_line_id with conflicting immutable supplier facts routes to review.

## Canonical product gate

Supplier_Prices is created only when the product identity is exact.

Allowed automatic part resolution:

1. explicit canonical_part_id that resolves in Master_Parts, or
2. exact supplier_sku matching Master_Parts.supplier_code_primary where preferred_supplier_id is the same supplier.

Not allowed:

- source description similarity,
- model-name inference,
- category similarity,
- price similarity,
- supplier name alone.

If the part is not exact, the source line is retained with:

    processing_status = REVIEW_REQUIRED
    match_status = REVIEW_REQUIRED

and no Supplier_Prices row is created.

## Price promotion

A price may be promoted only when:

- supplier is exact and approved,
- supplier quote identity is exact,
- source line identity is exact,
- canonical part is exact,
- quantity is positive,
- unit_price_ex_vat is present.

VAT-inclusive values are arithmetic derivations from the cited ex-VAT source value and VAT rate.

The worker deliberately does not set quote_eligible or release procurement. Existing Supplier_Price_Audit / TEST-037 remains the downstream commercial eligibility authority.

## Idempotency

Price IDs use the existing SPR date/supplier pattern with a deterministic source-line hash suffix. Historical sequential SPR IDs remain valid.

This is why the Supplier price canonical-ID rule now explicitly allows both historical sequential IDs and deterministic automated source-line suffixes.

## No side effects

P5J does not:

- create Master_Parts from supplier descriptions,
- approve suppliers,
- mark a price quote-eligible,
- select a supplier for a job,
- release procurement,
- mutate client quotes,
- retire existing supplier workflows.

All of those remain separate governed stages.
