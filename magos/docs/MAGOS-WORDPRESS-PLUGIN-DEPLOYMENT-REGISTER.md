# MAGOS WordPress Plugin Deployment Register

**Status:** authoritative deployment-control register.  
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
| MAGOS Water Alert Publisher | **NOT INSTALLED / NOT ACTIVE** | Expected 0.1.0 · source `magos/wordpress/mgos-water-alert-publisher.php` | SOURCE-CONTROLLED + CI PASS + reproducible ZIP artifact exists | `/mgos/v1/water-alert/status` returns `rest_no_route` | **FAIL deployment** |

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

The source-controlled publisher is merged and CI-tested, but it is not installed on live WordPress. Its REST route is absent.

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

- Custom plugins confirmed live and active: **3**
- Source-controlled reviewed plugins confirmed missing live: **2**
- Live custom plugins with unresolved Git-source reconciliation: **3**
- WordPress plugin deployment layer overall: **PARTIAL**

**Production-complete status:** **NO**.
