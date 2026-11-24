# MAGOS — Design Reference Integration
Date: 2026-11-24
Status: DOCUMENTED; runtime adoption NOT IMPLEMENTED

## Canonical reference
[Myriad Green Design Reference Library](../../docs/design/DESIGN_REFERENCE_LIBRARY.md) is the canonical, evolving design-resource library within this repository. Read it before MAGOS operator-dashboard frontend changes. The ecommerce repository contains a synchronized copy at docs/design/DESIGN_REFERENCE_LIBRARY.md; check revision drift before reuse.

## Application to MAGOS
- Refero (https://refero.design/): dashboard information hierarchy, filters, tables, state clarity.
- Navbar Gallery (https://www.navbar.gallery/): navigation patterns only if appropriate for operator workflows.
- Footer Design (https://www.footer.design/): generally low priority for authenticated dashboard.
- Scrolltide (https://www.scrolltide.co/): avoid gratuitous motion; only accessible, low-cost micro-interactions.
- Other reference names in canonical file remain TO_CONFIRM; do not invent URLs.

## Mandatory safe change gate
Inspect current MAGOS operator implementation and dependencies before design changes. Preserve authentication, read-only boundaries, state semantics, exception visibility, task queue and business lifecycle gates. Scope CSS and JS; test mobile/tablet/desktop, accessibility, keyboard controls, performance and existing workflows. Prototype on branch/staging; document rollback. No deployment is authorized by this document.

## Truth status
- DOCUMENTED: canonical link and MAGOS usage instructions in Git.
- NOT IMPLEMENTED: runtime consumption, automated synchronization, or frontend modifications.
- NOT VALIDATED: production behavior.
