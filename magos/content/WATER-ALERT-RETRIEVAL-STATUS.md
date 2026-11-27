# Water alert retrieval repair — 2026-11-27

Implemented on isolated repair branch: bounded direct HTML and two official Tshwane REST routes for numeric query-post identities; per-attempt diagnostics; REST ID, status, type and official link validation. Redirects remain rejected. No semantic approval bypass.

Regression fixtures use IDs 108870 and 108857 but synthetic content, not live municipal evidence. Run `node --test magos/content/water-alert-retrieval.test.js` before merge. Live retrieval, canonical redirects, provider classification, integration, deployment, and publication QA remain pending. The existing verifier intentionally returns review-required even after exact extraction. Do not mark production ready.
