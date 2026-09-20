# MAGOS P5G — Safe 00A Filing V1

## Status

Code/control implementation only. Production Drive moves remain OFF until P4 is validated and the service account has explicit access to the 00A intake folder plus approved destination folders.

## Purpose

Move an already matched 00A file into an exact canonical Drive folder and then reconcile Evidence_Index through P3.

This stage does not decide business identity. It consumes the deterministic canonical IDs produced by P5B/P5C.

## Folder resolution

Allowed folder evidence:

1. Explicit canonical_folder_id already supplied by trusted upstream context.
2. Exact job_id resolving to Jobs_Opportunities.job_folder_link.
3. Exact quote_id resolving to Quotes.drive_folder_id.
4. Exact invoice_id resolving to Invoices.drive_folder_id.

If multiple canonical IDs point to different folders, the event routes to review.

Supplier/client names are never used as Drive destinations.

## Move controls

Before moving:

- file must be identified by immutable Drive file ID,
- exact target folder must be resolved,
- current parent must be the configured 00A folder,
- multiple current parents route to review,
- a file already in the exact target is treated as a safe no-op.

After moving:

- Drive metadata is read back,
- target parent must be present,
- 00A parent must be absent.

## Child event

The physical move creates a new internal event:

    DOCUMENT_FILED

Its source identity is:

    drive_file_id | target_folder_id

This produces a distinct idempotency key from the original DOCUMENT_RECEIVED event.

That separation is required because the original event may already have committed the Evidence_Index creation through P3.

## Evidence_Index update

DOCUMENT_FILED resolves the existing evidence row by exact Drive file identity and emits a P3 PATCH_IF_MATCH:

Expected:

    drive_file_id = exact file
    filed_state = MATCHED_PENDING_FILING

Change:

    canonical_folder_id = exact target
    canonical_folder_link = exact target link
    filed_state = FILED
    evidence_link = Drive read-back evidence

If the expected state is stale or conflicting, P3 fails closed.

## Permissions

The move adapter requires Google Drive write scope, but effective authority remains restricted by what the MAGOS service account is explicitly shared onto. Do not broaden Drive sharing merely to make the worker pass.
