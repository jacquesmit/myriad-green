# MYRIAD GREEN — DESIGN REFERENCE LIBRARY & PROJECT HANDOVER
Version: 2026-11-24 | Status: evolving reference / implementation guidance
Scope: Myriad Green public website, WooCommerce ecommerce, and MAGOS frontend.
Source: Design upgrade site project conversations visible in the 2026-11-24 handover. This is a thematic handover, not a verbatim export of every chat.

## Intent
Maintain one append-only-in-spirit, version-controlled reference catalogue of design inspiration and reusable patterns. New sources may be added at any time. Research and evaluate sources before adopting; do not reproduce copyrighted site designs or unlicensed assets.

## Sources discussed
| Reference | Intended use | Verification |
| --- | --- | --- |
| Navbar Gallery | Navigation, mega-menus, mobile menus, sticky headers, active states | Exact domain and examples TO_CONFIRM |
| Footer Design | Modern multi-column footers, contact CTAs, service-area links, mobile stacking | Exact domain TO_CONFIRM |
| CTA Gallery | Conversion sections, quote/contact/cart CTAs, visual hierarchy | Exact domain TO_CONFIRM |
| Scrolltide (user corrected 'Scrolltite') | Scroll-based interaction and animation inspiration | Exact URL and features TO_CONFIRM |
| Refero (user said 'REFERO STYLES' after 'Revelo') | Contemporary UI patterns, page sections, visual styling | Exact URL TO_CONFIRM |
| 3D icon resources | Product/service iconography, depth and lighting consistency | Specific libraries and licenses TO_CONFIRM |
| Superhero | Bold, high-impact visual direction; use selectively without hurting clarity | Specific reference and interpretation TO_CONFIRM |

Do not guess website domains. Record verified URLs, screenshots, source pages, attribution/licensing, and usage notes when reviewed.

## Handover: project decisions
- This project is a research and design-pattern source, not authorization to replace the current site theme or rewrite the entire UI.
- Visual standard: professional, modern, high-quality, responsive; avoid generic dull template appearance.
- Maintain Myriad Green identity: green action/brand cues, blue technical cues, orange pricing cues, restrained embossed white cards and subtle borders.
- Responsive full-width layouts across widescreen, desktop, tablet and phone; avoid 100vw/negative-margin hacks.
- Navigation: brands lead to dedicated brand collections; departments lead to category collections across brands; product pages own variation, quantity, price, cart and checkout.
- Distinguish manufacturer/brand from supplier; do not expose supplier pricing or internal sourcing to shoppers.
- Keep real selling prices for approved saleable products; never fabricate stock, prices, specifications or operational readiness.
- Improve conversion via WhatsApp, phone, booking and ecommerce purchase flows according to page intent.
- Design must support SEO, accessibility, performance, semantic markup and keyboard/touch interactions.
- Preserve existing working UX, CSS, JavaScript, Elementor templates, WooCommerce data and MAGOS integration; inspect before changing.
- For ecommerce, preserve product-specific imagery, transparent backgrounds where appropriate, variation accuracy, native category/brand filters, add-to-cart and checkout.
- No unrequested live deployment, cache purge, or shop-data mutation is authorized by this document.

## Adoption process
1. ADD: record source title, verified URL, date, screenshot/example and category.
2. ANALYZE: extract pattern, interaction behaviour, mobile adaptation, accessibility and implementation complexity.
3. MAP: identify exact Myriad Green page/section/component and conversion purpose.
4. BUILD: implement using existing architecture and modern CSS/JS/HTML, using third-party libraries only where justified.
5. TEST: desktop/tablet/mobile, keyboard/touch, performance, product data and conversion flows.
6. RECORD: evidence, commit, affected pages, rollback and status: DISCUSSED / DOCUMENTED / IMPLEMENTED / VALIDATED / PRODUCTION.
Only mark VALIDATED after tests; only mark PRODUCTION after deployment checks.

## Priority application areas
1. Main shop hero-to-department spacing and visual coherence.
2. Brand and department navigation with accurate destinations.
3. Tank/product variation galleries, capacity and colour accuracy.
4. Product cards, CTAs, mobile spacing, pricing and checkout clarity.
5. Website header/navbar, footer, service-page CTAs and internal navigation.
6. MAGOS dashboard usability, hierarchy, responsive task/exception views.

## Future entries
Use this template:
### [Source name] — [date added]
- URL: TO_CONFIRM
- Category:
- Example/visual:
- Pattern to reuse:
- Myriad Green target:
- Implementation notes:
- License/attribution:
- Status: DOCUMENTED
- Validation evidence:
- Related commit/PR:

## Governance
This library is advisory, not proof of implementation. Existing verified requirements and production behaviour take precedence. Maintain change history in Git. MAGOS should reference the canonical file via repository link or synchronized documentation; do not claim a MAGOS runtime import without verification.

## Verified design sources — 2026-11-24
- **Navbar Gallery** — https://www.navbar.gallery/ — curated navigation gallery; inspect mega menus, dropdowns, search, mobile, and category navigation. Candidate: shop department and manufacturer navigation. Source checked 2026-11-24.
- **Footer Design** — https://www.footer.design/ — curated footer gallery with grid, cards, typographic and animated examples. Candidate: service/contact footer. Source checked 2026-11-24.
- **Scrolltide** — https://www.scrolltide.co/ — scroll-driven templates, components, sections and tutorials. Candidate: isolated, lightweight hero/section interactions; avoid copying Next.js/React/GSAP dependencies directly into Elementor without compatibility and performance assessment. Source checked 2026-11-24.
- **Refero** — https://refero.design/ — real product pages, catalogue pages, filters, shopping flows and dashboards. Candidate: ecommerce product browsing and MAGOS dashboard information hierarchy. Source checked 2026-11-24.
- **CTA Gallery** — exact intended website still TO_CONFIRM; do not invent URL.
- **3D icons** — specific website(s) still TO_CONFIRM; license and performance checks mandatory.
- **Superhero** — intended website/reference still TO_CONFIRM.

### Safe adoption gate (mandatory)
1. Identify existing WordPress/Elementor template, WooCommerce hooks, CSS/JS and MAGOS dependencies; capture baseline screenshots and functional tests.
2. Select a specific pattern from a verified reference, record its URL and intended improvement. Treat it as inspiration, not a copy/paste mandate.
3. Prototype in isolated scoped CSS/JS or staging/feature branch; avoid global selectors and framework conflicts. Respect reduced motion, keyboard accessibility and mobile performance.
4. Test navigation, product variation images and pricing, cart, checkout, forms, WhatsApp, SEO metadata, responsive breakpoints and loading behaviour as applicable.
5. Deploy only with approval and rollback. Record commit, screenshots, test results and production evidence. Do not mark COMPLETE without verification.
6. Never install a new animation framework or rewrite a functioning section solely to imitate a reference.

### Source-of-truth rule
Main website repo is the proposed canonical library; ecommerce may mirror it, with a dated sync note. MAGOS integration remains PENDING until its documentation store/repository is located and verified. Future sources must include URL, pattern, compatibility, license, target component and adoption status.
