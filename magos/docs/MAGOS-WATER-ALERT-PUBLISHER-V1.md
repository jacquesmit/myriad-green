# MAGOS Water Intelligence & Alert Publisher — V1

**Status:** CODED CANDIDATE on `codex/magos-water-alert-publisher-20261124`.  
**Decision date:** 24 November 2026.  
**Owner system:** MAGOS.  
**Scope:** verified Gauteng municipal water notices → dedupe → lifecycle → Myriad Green Journal publication plan → later governed WordPress publisher adapter.

## Purpose

This module turns verified municipal water information into a durable Myriad Green content and lead-generation asset without creating a parallel CMS, CRM, finance store or ungoverned autonomous publisher.

Initial source classes:

- City of Tshwane;
- Johannesburg Water;
- Rand Water;
- later municipalities/providers only after explicit source registration.

Initial alert classes:

- tanker distribution;
- water interruption;
- low-pressure/system pressure;
- water restrictions;
- recovery updates;
- water-quality notices.

The module is designed around the real Journal work already proven manually on Myriad Green: water notices need exact dates, affected areas, source provenance, internal links to relevant area/service/product pages, SEO/AEO/GEO structure and a clear `ACTIVE → RECENT → HISTORICAL` lifecycle.

## Two-lane intelligence model

MAGOS uses two distinct evidence lanes:

1. **Official alert lane — publication-eligible.** Registered City of Tshwane, Johannesburg Water, Rand Water and later approved municipal sources may authorize a Journal create/update only after exact source verification.
2. **News/community discovery lane — verification-only.** Credible local news, community publications, municipal reporting and relevant public social posts may surface an event for investigation, but they **cannot authorize publication**. MAGOS must locate and verify the corresponding official municipal/Rand Water source first. Without official corroboration the finding remains `REVIEW_REQUIRED`.

This protects speed of discovery without allowing a media report, repost or community claim to become a Myriad Green factual alert by itself.

## Architecture

```text
news/community signal -> official-source corroboration gate
                              |
official municipal source ----+
  -> source verification
  -> immutable source_event_id
  -> normalized WaterAlertNotice
  -> exact duplicate/update detection
  -> ACTIVE / RECENT / HISTORICAL
  -> exact published area-page mapping
  -> service/product link policy
  -> SEO/AEO/GEO publication plan
  -> WordPress publisher adapter [PENDING]
  -> read-back of post ID / canonical URL / sitemap presence [PENDING]
  -> MAGOS evidence / run status [PENDING]
```

### Implemented source files

- `magos/content/water-alert-publisher.js`
- `magos/rules/water-alert-publisher.v1.json`
- `magos/tests/water-alert-publisher.test.js`

The planner is deterministic and has **no side effects**. It does not contain WordPress credentials and it cannot publish a post by itself.

## Source verification contract

Automatic publication may only be considered when:

1. provider is in the explicit source registry;
2. immutable `source_event_id` exists;
3. source is an approved official website domain **or** an exact approved official social account;
4. alert type is registered;
5. effective date exists;
6. at least one affected area exists;
7. title exists;
8. the notice is currently `ACTIVE` under V1 lifecycle rules.

Social-platform domain alone is never enough. An X/Facebook repost is not official merely because it repeats a City notice. The exact registered provider account is required.

Unverified, ambiguous or historical material returns `REVIEW_REQUIRED`.

## Dedupe and update semantics

Stable source key:

```text
WATER_ALERT|<PROVIDER>|<SOURCE_EVENT_ID>
```

The normalized notice is separately hashed to produce a content fingerprint.

- same source key + same fingerprint → `DUPLICATE_NO_OP`
- same source key + changed fingerprint → `UPDATE_EXISTING`
- new source key → `CREATE_NEW`
- uncertain source → `REVIEW_REQUIRED`

Never create a second Journal post merely because an official notice was edited. Update the existing post associated with the same immutable source event.

## Lifecycle

V1 states:

- **ACTIVE** — effective today/future or explicitly valid through today;
- **RECENT** — ended/passed within seven days;
- **HISTORICAL** — older than seven days;
- **UNKNOWN** — no valid effective date.

Only ACTIVE notices can be eligible for automatic publication in V1. RECENT and HISTORICAL notices remain useful archive/search evidence but must not be automatically promoted as current.

## Internal-link policy

The planner always provides the strongest relevant owned routes:

Primary:

1. Water backup solutions during outages;
2. Municipal water backup solutions;
3. Backup Water Systems hub.

Secondary:

- water storage during outages;
- JoJo tank backup integration;
- low-water-pressure solutions;
- pumps;
- irrigation;
- emergency water-system support.

Commerce:

- water-storage tank shop;
- pump shop;
- irrigation equipment shop.

### Area pages

Affected suburb/location links are **not hard-coded as guesses**.

The publisher must read the current WordPress site index and include an area page only when:

- the page is actually published;
- its area name exactly matches a normalized affected area.

If the notice mentions Bronkhorstspruit but Myriad Green has no published Bronkhorstspruit page, the alert may mention the place but must not invent a local internal URL.

## SEO / AEO / GEO contract

Every publish plan includes:

- focus keyword;
- bounded search title;
- bounded meta description;
- `BlogPosting` schema requirement;
- visible quick-answer/FAQ content;
- `FAQPage` schema requirement where FAQ answers are present;
- exact affected geographic entities;
- canonical official source URL;
- current/historical lifecycle state.

Source facts must remain source facts. Myriad Green service/product copy must be visibly separate from municipal claims.

## WordPress publishing boundary

**Not yet enabled in this V1 candidate.**

The planner returns:

- `READY_TO_PUBLISH`;
- `UPDATE_EXISTING`;
- `DUPLICATE_NO_OP`;
- or `REVIEW_REQUIRED`.

It also returns `wordpress_adapter_required:true`.

A future publisher adapter must:

1. use a dedicated private credential, distinct from runtime/operator/lead/payment credentials;
2. never accept caller-supplied `verified:true` as authority;
3. search existing posts by canonical source key before writing;
4. create/update only the Local Water Alerts category;
5. write Rank Math metadata/schema through the supported WordPress path;
6. read back post ID, status, canonical URL, source metadata and sitemap inclusion;
7. replay the identical source event and prove no duplicate post is created;
8. preserve rollback/revision evidence;
9. record failure as REVIEW/BLOCKED rather than claiming publication.

WPVibe/manual WordPress work can remain the temporary operator path while the publisher adapter is unvalidated.

## Scheduler / monitor

The intended schedule is a condition watch running several times per day.

Each run:

1. checks official municipal sources **and** secondary news/community sources for material water events since the previous successful run;
2. treats secondary sources as discovery signals only and seeks official corroboration before any publication;
3. normalizes and verifies officially corroborated notices;
4. checks existing Journal source keys;
5. skips duplicates;
6. prepares a publish/update plan;
7. publishes only after the WordPress adapter passes production acceptance;
8. otherwise reports the exact pending plan for operator execution.

Do not create daily filler posts when there is no material verified event.

## Production acceptance gates

| Gate | Requirement | Current |
| --- | --- | --- |
| WAP-01 | deterministic source verification | CODED |
| WAP-02 | source-key dedupe + content fingerprint | CODED |
| WAP-03 | ACTIVE/RECENT/HISTORICAL lifecycle | CODED |
| WAP-04 | exact published area-page mapping | CODED |
| WAP-05 | service/product link policy | CODED |
| WAP-06 | SEO/AEO/GEO plan | CODED |
| WAP-07 | unit + authenticated runtime endpoint tests | PASS on PR #99 GitHub CI |
| WAP-08 | authenticated WordPress publisher adapter | NOT IMPLEMENTED |
| WAP-09 | live create + read-back | NOT VALIDATED |
| WAP-10 | same-key replay / no duplicate | NOT VALIDATED |
| WAP-11 | update-existing live notice | NOT VALIDATED |
| WAP-12 | sitemap/indexability read-back | NOT VALIDATED |
| WAP-13 | rollback/revision acceptance | NOT VALIDATED |

## Truthmode

**IMPLEMENTED:** deterministic planning library, rules registry and unit tests on candidate branch.

**DOCUMENTED:** source policy, lifecycle, internal-link policy, publishing boundary and acceptance gates.

**VALIDATED IN GIT:** PR #99 MAGOS Runtime P2, Document Extract and Evolving Status Gate passed on the reviewed implementation head. This is source/CI validation, not deployment.

**NOT YET IMPLEMENTED:** autonomous WordPress publisher adapter.

**NOT PRODUCTION COMPLETE:** no HOSTAFRICA deployment of this feature, no live runtime endpoint acceptance and no unattended live WordPress write/read-back/replay test have occurred.

## Next implementation

Build the WordPress publisher adapter as a separately authenticated boundary, then execute one controlled City of Tshwane test notice through:

```text
source -> plan -> create/update post -> Rank Math -> public read-back
       -> sitemap read-back -> same-key replay -> no duplicate
```

Only after that gate passes should the recurring automation be allowed to publish without operator intervention.
