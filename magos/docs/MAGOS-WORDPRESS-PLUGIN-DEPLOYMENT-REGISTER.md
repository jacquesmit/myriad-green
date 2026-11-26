# MAGOS WordPress Plugin Deployment Register

**Status:** authoritative deployment-control register. Updated 25 November 2026: Water Alert Publisher live creation, readback, sitemap and exact replay PASS; unattended operation PARTIAL. Older missing-route statements are historical.  
**Created:** 24 November 2026.  
**Scope:** custom WordPress plugins built for Myriad Green / MAGOS, whether source-controlled, live-only legacy, packaged, installed or pending deployment.

## Control rule

Every custom plugin must have all of these tracked separately:

1. source location;
2. reviewed/package artifact;
3. live WordPress installation;
4. activation state;
5. live version;
6. expected REST route / shortcode / feature check;
7. private-secret/configuration state where applicable;
8. rollback evidence;
9. source-to-live version match;
10. production acceptance result.

A plugin is **not COMPLETE** merely because source exists in Git or a ZIP artifact was produced.  
A plugin is **not SOURCE-CONTROLLED** merely because it is active on WordPress.

## Live audit — 24 November 2026

Authenticated live WordPress plugin list and REST route checks were performed through WPVibe against `https://myriadgreen.co.za`.

| Plugin | Live state | Live version / file | Git/source state | Feature/route evidence | Deployment status |
| --- | --- | --- | --- | --- | --- |
| MAGOS Systems Calculator | ACTIVE | 3.0.0 · `magos-systems-calculator/magos-systems-calculator.php` | Plugin source file not found in current Git search | Existing MAGOS docs identify it as a standalone shortcode | **PARTIAL** — live, but source-control/package register incomplete |
| Myriad Green Quote Acceptance Bridge | ACTIVE | 0.3.2 · `mgos-quote-acceptance/mgos-quote-acceptance.php` | Live source is referenced in MAGOS docs; canonical plugin source file not found in current Git search | Legacy owner-test bridge is live; reviewed `verify-v2` route is absent | **PARTIAL / LEGACY** |
| Myriad Green — Native Catalog Browser | ACTIVE | 0.1.0 · `mg-native-catalog-browser/mg-native-catalog-browser.php` | Plugin source file not found in current Git search | Live plugin activation confirmed; source-to-live reconciliation pending | **PARTIAL** |
| MAGOS Reviewed Client Signature Receipt | **NOT INSTALLED / NOT ACTIVE** | Expected 0.1.0 · source `magos/wordpress/mgos-reviewed-client-signature.php` | SOURCE-CONTROLLED + reviewed packaging workflow exists | `/mgos/v1/quote-acceptance/verify-v2` returns `rest_no_route` | **FAIL deployment** |
| MAGOS Water Alert Publisher | **ACTIVE** | Expected 0.1.0 · source `magos/wordpress/mgos-water-alert-publisher.php` | SOURCE-CONTROLLED + CI PASS + reproducible ZIP artifact exists | WP status 401 without token; authenticated NOT_FOUND | **PARTIAL — live publish/replay PASS; unattended integration pending** |

## Immediate gaps

### 1. Reviewed Client Signature Receipt

The source-controlled reviewed companion exists but is not present in the live plugin list. The expected `verify-v2` route is also absent.

Do **not** mark customer signing production-ready until:

- reviewed ZIP is installed;
- plugin is active;
- existing legacy bridge compatibility is checked;
- private auth is configured;
- `verify-v2` returns the expected authenticated response;
- controlled positive and negative acceptance tests pass;
- rollback package/evidence is retained.

### 2. Water Alert Publisher

The source-controlled publisher is merged and CI-tested, and is now installed and active on live WordPress. Its REST route, dedicated authentication and live Node runtime publishing route passed. Post 10622 and exact duplicate replay are verified.

Do **not** mark MAGOS water-alert auto-publishing production-complete until:

- reviewed `magos-water-alert-publisher.zip` is installed;
- plugin is active;
- `MAGOS_WATER_ALERT_PUBLISH_TOKEN` is configured privately on WordPress;
- the matching isolated runtime secret is configured on HOSTAFRICA;
- one verified official notice passes create → REST read-back → public HTML/schema → sitemap;
- exact replay produces `DUPLICATE_NO_OP`;
- changed same-source notice produces `UPDATE_EXISTING`;
- rollback evidence is retained.

### 3. Existing live custom plugins missing canonical Git source

The live site currently contains three custom Myriad/MAGOS plugins whose current plugin implementation file was not found in the repository search:

- MAGOS Systems Calculator;
- Myriad Green Quote Acceptance Bridge;
- Myriad Green — Native Catalog Browser.

This is a governance/source-of-truth gap. The live source should be read, reviewed, copied into the correct Git path, versioned, tested and packaged without changing live behaviour. Until reconciled, **live active** and **source-controlled** must remain separate statuses.

## Required standing check

Whenever a new Myriad Green / MAGOS WordPress plugin is created or materially changed:

1. add/update it in this register;
2. verify exact Git source and version;
3. verify CI/package artifact;
4. compare live plugin list;
5. verify active state;
6. test expected REST route, shortcode or feature;
7. confirm required secrets/configuration without exposing credentials;
8. record live acceptance and rollback evidence in `MAGOS-STATUS.md`.

## Current summary

- Custom plugins confirmed live and active: **4**
- Source-controlled reviewed plugins confirmed missing live: **1**
- Live custom plugins with unresolved Git-source reconciliation: **3**
- WordPress plugin deployment layer overall: **PARTIAL**

**Production-complete status:** **NO**.


## Historical — 24 November initial production release blocker (RESOLVED)
HOSTAFRICA ticket #3957866 (22 Nov) confirmed production HEAD `88576e4595186e73259d5e4f32d2940ac8b4a569` on `codex/magos-production-intake-20261107`, clean tracked files, readable origin/main then `780bd0f3e3ce17ba7a0ed9d34e57e8b01c8b8954`, Node 20.20.2 and two MAGOS workers started after HEAD. This is historical evidence, not today's SHA. Tickets #9342462/#3622207 (11–12 Nov) approved the existing path/account-scoped recycle; do not request support again unless controlled local recovery fails. Reuse PR #65's `magos/scripts/hostafrica-release.sh` and existing preflight; do not create a parallel deployment path. Inspect first; reconcile host-only commits before checkout; pin tested main SHA, verify backup and private environment, recycle only scoped workers, verify loaded SHA and capability-specific endpoint, retain rollback receipt. No blind pull/reset or broad process kill. A new secret requires process reload, not a new app. A P5 health response is not release identity.
24 Nov evidence: WPVibe plugin list exit 0, Water Alert Publisher 0.1.0 active; user confirmed configuration saved on both sides and website loads. Browser health P5 OK, readiness ready/auth_configured true; unauthenticated WP status 401; authenticated WP status returned NOT_FOUND for synthetic key (expected, no write). Authenticated empty POST to runtime /v1/content/water-alert/publish returned Cannot POST; expected 400 WATER_ALERT_NOTICE_REQUIRED from merged source. Runtime endpoint FAIL, actual running SHA and runtime token acceptance unverified; likely checkout lag or stale worker, not proven. No test article or server deployment performed. Do not repeat WP installation or credential setup. Next: existing controlled host release and empty POST smoke test, then real official-source acceptance/replay/update. Support escalation only after exact sanitized failure evidence. No credentials in Git or logs.


## 24 November 2026 — live publication evidence and owner editorial feedback
Supersedes the earlier runtime-route blocker above. Runtime release `b5e73575e092ef6abf39842e3ffb9ff44a45084e` deployed; operator-reported 647/647 regression tests and 13/13 live preflight checks passed. Dedicated publish authentication and WordPress authenticated status lookup passed. First controlled official notice publication created post 10622, https://myriadgreen.co.za/journal/tshwane-water-supply-update-24-november-2026/ (source key `WATER_ALERT|CITY_OF_TSHWANE|web:108611`). Canonical and public readback passed; adapter returned `REVIEW_REQUIRED / WP_ALERT_SITEMAP_NOT_CONFIRMED`. Owner visually confirmed the published page.

**Deferred editorial improvement — owner requested, not implemented:** the current article reads too much like an internal notification. Improve the reusable water-alert article template to be client-facing and reader-facing: lead with what happened, affected communities, practical implications, recovery information where officially confirmed, and useful next steps; use natural public-facing language and relevant service links without exposing internal operational terminology or inventing facts. Preserve official-source attribution, dates, factual uncertainty, FAQ/schema, SEO/AEO/GEO and deduplication. Apply to the template for future alerts; review the existing article when editorial work resumes. Do not modify the live article or template now.

**Acceptance remains PARTIAL:** sitemap and exact replay subsequently PASS (see follow-up below); same-source update, targeted sitemap refresh, independent factual verification and scheduled automation integration remain pending. This documentation-only update does not change deployed runtime code or WordPress content.


### Live acceptance follow-up — 24 November 2026
Owner supplied live HTML confirming index/follow, exact canonical, Rank Math BlogPosting and social metadata. Initial post sitemap lookup and query-string cache bypass did not find post 10622. Owner changed Rank Math links per sitemap from 199 to 201 (avoiding previously reported issue at 200), saved and purged LiteSpeed cache. Subsequent read-only lookup returned the exact article URL. Exact payload replay then returned `DUPLICATE_NO_OP`, `verified:true`, same post ID 10622, `public_readback:true`, `sitemap_verified:true`, `faq_schema_verified:true`; fingerprint unchanged. Publication and exact-replay acceptance PASS. Root cause not isolated between Rank Math regeneration and LiteSpeed purge. Automatic targeted sitemap refresh/verification remains pending; avoid global cache purge per post. Same-source update acceptance and secure scheduled automation integration remain pending. Journal frontend/UX/UI and reader-facing article design are separate deferred workstreams. No further manual replay or redeployment required to prove these passed gates. Official source content must be independently checked by the automation; domain validation alone is not factual verification. Overall unattended publishing remains PARTIAL.


## 26 November 2026 — consolidated release candidate
Combined PR #105 (owner OAuth/session controls), #106 (bounded sitemap verification), and #107 (whole-system dashboard inventories) from exact previously tested heads 80ae47f8788cae0a07ccd6e95bca591c7c291339, a624328094afdfa2eafcfb1db90b4d41c2b708fc, b60f1e48c926ae1b076b9bef73dab7eef5eb0911. Non-overlapping code copied only after base blob equality; operator.js combined navigation with authorized() session/token checks. Preserve existing main documentation. Individual CI receipts do not certify integrated release. Pending integrated exact-head CI, deployment, OAuth configuration and authenticated UI readback. Water source factual corroboration remains TO_CONFIRM; no claim of independent corroboration, no unattended publication activation. Targeted cache invalidation and genuine same-source update remain pending. Dashboard reads register labels, not live business acceptance. Existing deployed release unchanged; CORE-003 controlled canonical business write/readback/replay remains next core acceptance. No duplicate scheduler, no new authority or credentials.
