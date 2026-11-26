# MAGOS Operations Command Centre

> **25 November 2026 live status:** deployed release `b5e73575e092ef6abf39842e3ffb9ff44a45084e`, 647/647 host regression tests and 13/13 read-only production preflight checks PASS. Operator shell/assets, deployment identity, auth isolation, canonical coverage and 129 core records verified. Existing operator page is not an undeployed candidate. Detailed record-by-record UX and business workflow acceptance remain separate. See [MAGOS-CURRENT.md](MAGOS-CURRENT.md).

The existing production page is https://runtime.myriadgreen.co.za/operator.
It uses the same cPanel Node.js application and does not maintain another data store.

| View | Existing authority |
| --- | --- |
| Lead intake and clients | CRM Intake_Queue and CRM_Master |
| Quotes and acceptance review | Commercial Quotes and existing job-activation inspection |
| Jobs, dispatch and work proof | CRM Jobs_Opportunities and Bookings, plus Commercial Job Execution |
| Finance | Commercial Payment Control and Payment_Allocations |
| Procurement and suppliers | Commercial Procurement and Supplier Master Suppliers |
| Exceptions | Global Audit Sync_Exceptions |
| Other registers | Supplier pricing, SEO, publishing and governance open in their existing workbooks |

Payment proof is shown separately from cleared allocation evidence. An ambiguous
canonical ID requires review and is excluded from trusted counts. A failed
source read appears as unavailable. Every successful read shows its check time.

## Deployment and acceptance

Use the [cPanel deployment runbook](CPANEL-PASSENGER-DEPLOY.md) and keep the
existing application root and startup file. Add a new, independent
`MAGOS_OPERATOR_READ_TOKEN` to the existing application's private settings.
Use it at /operator. Keep the general runtime token on the runtime.

1. Deploy the tested dashboard commit and restart the existing app.
2. Open /operator and confirm that the page and its same-origin CSS/JS load.
   Verify the dashboard API denies an unauthenticated read.
3. Load operations with the dedicated credential. Reconcile one live record
   each from leads, quotes, jobs, bookings, finance, procurement, suppliers,
   work proof and exceptions. Record the exact IDs and source links in the
   existing Audit_Tests register. If a source is partial, record the blocker.
4. Check a finance record with both proof and an allocation. Verify the cleared
   amount against the canonical allocation. Confirm Lock removes the loaded
   data and Refresh updates the read time.
5. Record the dashboard read gate separately from business workflow acceptance.
   Quote release, bookings, bank clearance, job creation, procurement and
   publishing still require their existing governed workflows and live read-back.

The snapshot API and existing governed writer interfaces retain their own
authentication and release evidence. The dashboard itself is read-only.


## Owner direction — dashboard integration and whole-business execution, 25 November 2026
The dashboard is the existing business command centre over the Node.js runtime, not a duplicate execution engine or authority store. Preserve its read-only operator authentication; any future approve/execute action must use separately authorized governed routes and explicit evidence. Reconcile existing UI/source contracts before changes. Show deployed SHA, last verified release and freshness, actual workflow outcomes, source/record links, approvals, failures, exceptions and next actions; distinguish historical receipts from live health. Present runtime acceptance separately from business capability acceptance (22 assessed: 0 PASS, 18 PARTIAL, 4 FAIL at last snapshot; not a completion percentage). Do not hardcode old counts as live.

### Content & Growth module requirements — proposed, NOT implemented
Expose existing Water Alert Publisher run evidence: official source identity/date, verification basis and independent factual check, lifecycle, post ID/URL, create/update/duplicate/no-op result, public/schema/sitemap verification, exceptions and retry status, next scheduled run when known, last successful run and pending review. Derive from existing verified receipts/workflow sources; inspect persistent run evidence before choosing storage, no parallel ledger. Pilot post 10622 and exact replay PASS; unattended schedule, factual source check, targeted sitemap invalidation and legitimate revision acceptance pending. Separate public journal reader-facing copy and UX/UI enhancements from internal dashboard work.

### Reusable execution pattern and rollout
Detect → verify → decide → execute → read back → record → deduplicate; each integration uses canonical ownership, stable event identity, safe failure reporting and explicit authority. Reuse across CRM intake and follow-up, quotes/versioned signature, cleared bank evidence, job readiness/scheduling, procurement/supplier costs/stock, field closeout/job margins, invoices/reconciliation, reviews/warranty/maintenance, approved job evidence case studies, SEO/GBP publishing, ecommerce order/fulfilment. These are opportunities or existing partial capabilities, not validated production claims. Priorities: finish unattended publisher, reconcile dashboard evidence, complete reviewed quote acceptance and independent financial clearance, then governed procurement and full business golden path; modern dashboard UX follows accurate data contracts. No new agent proliferation, no duplicated system, no invented completion percentage. On each change update CURRENT, STATUS, affected register and Control Hub evidence.


## P0 owner-approved dashboard human authentication — 25 November 2026
**Status: DOCUMENTED / APPROVED FOR IMPLEMENTATION; not implemented or deployed.** Owner confirmed that daily dashboard use must not require cPanel, JSON files, or manually copying operator access tokens. Implement a conventional mobile-friendly sign-in with secure server-side sessions, logout, owner access, future employee role-based permissions and MFA. Prefer a maintained identity provider/library over custom password cryptography; assess existing identity/configuration first, and document provider selection and account recovery before deployment. Preserve the existing dedicated operator token as a protected transitional machine/read-only compatibility mechanism, not a browser-visible credential or human password; never embed runtime/publisher credentials in HTML, JS, URLs, logs, or client storage. Protect read endpoints by authenticated owner/session authority, deny by default, preserve existing machine API authentication and separately governed write routes. Use Secure/HttpOnly/SameSite cookies, session rotation/expiry/revocation, CSRF protections for state-changing authentication endpoints, rate limits, no credential logging, and audit successful/failed sign-ins without secrets. No public self-registration; no privilege expansion or employee access before role tests. Acceptance: mobile and desktop login, invalid/expired/revoked session denial, MFA enrollment/recovery, logout and Lock clear loaded data, unauthenticated API denial, existing operator compatibility and runtime/publisher regression tests PASS; deploy via existing tested release process with rollback and verify actual production sign-in. Do not require the owner to rotate existing credentials or repeat prior release checks absent a changed release. Keep Water Alert Publisher outstanding gates independent; no production change made by this documentation update.


## 26 November 2026 — consolidated release candidate
Combined PR #105 (owner OAuth/session controls), #106 (bounded sitemap verification), and #107 (whole-system dashboard inventories) from exact previously tested heads 80ae47f8788cae0a07ccd6e95bca591c7c291339, a624328094afdfa2eafcfb1db90b4d41c2b708fc, b60f1e48c926ae1b076b9bef73dab7eef5eb0911. Non-overlapping code copied only after base blob equality; operator.js combined navigation with authorized() session/token checks. Preserve existing main documentation. Individual CI receipts do not certify integrated release. Pending integrated exact-head CI, deployment, OAuth configuration and authenticated UI readback. Water source factual corroboration remains TO_CONFIRM; no claim of independent corroboration, no unattended publication activation. Targeted cache invalidation and genuine same-source update remain pending. Dashboard reads register labels, not live business acceptance. Existing deployed release unchanged; CORE-003 controlled canonical business write/readback/replay remains next core acceptance. No duplicate scheduler, no new authority or credentials.
