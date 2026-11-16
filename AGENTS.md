# MYRIAD GREEN — MAIN WEBSITE ENGINEERING RULES (2026)

**Repository:** `jacquesmit/myriad-green`  
**Applies to:** The normal Myriad Green service website at `https://myriadgreen.co.za/`, including its WordPress/Rey Child/Elementor frontend, service and location pages, contact and booking journeys, performance, local SEO and conversion components.  
**Audience:** ChatGPT, WPVibe, GitHub/Codex agents and developers.  
**Status:** Mandatory instructions for future site-building work; this document does **not** authorize a live change.  
**Last established:** 2026-11-16.

## 1. Ambition and north star

Build an exceptionally polished, fast, accessible, credible, maintainable and conversion-focused service-business website: aspire to the UX/frontend quality of the world's three best digital experiences without claiming an objectively verified top-three ranking.

The purpose is **qualified local enquiries, trust, bookings and long-term organic assets**, not visual novelty for its own sake. Keep the existing website and its working functionality. Improve and reuse before rebuilding.

## 2. Mandatory technology policy — modern first, historical knowledge always available

**Use the newest suitable, stable web technologies available up to and through 2026** when developing new features:
- **Modern HTML:** the HTML Living Standard, semantic elements, accessible native controls and valid responsive markup.
- **Modern CSS:** up-to-date CSS features supported by target browsers, with progressive enhancement and compatibility fallbacks.
- **Modern JavaScript:** supported ECMAScript, native browser APIs, modules and careful asynchronous/state management.
- **Libraries, frameworks and packages:** evaluate trusted, maintained tools where they materially improve outcomes. Do not add them reflexively; native browser features often outperform extra dependencies.
- **Historical HTML/CSS/JS:** use any proven patterns, techniques, compatibility tricks and insights from earlier generations of web development when they are better suited to an existing WordPress integration, a fallback or a specific browser constraint.

**Never treat “newest” as permission to use an unstable feature without a fallback. Never treat “legacy” as a reason to discard working, tested code.**

### 2.1 Mandatory research, not guessing

If ChatGPT, WPVibe or another agent is unsure how a feature, CSS property, API, WordPress/Elementor hook, library or dependency works, it must **research it on the internet** before prescribing or implementing it **when browsing is available**. Prefer current authoritative documentation:
- [MDN Web Docs](https://developer.mozilla.org/)
- [web.dev / Baseline](https://web.dev/baseline)
- [WHATWG HTML Living Standard](https://html.spec.whatwg.org/)
- [W3C](https://www.w3.org/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Can I Use](https://caniuse.com/)
- [WordPress developer documentation](https://developer.wordpress.org/)
- [Elementor developer documentation](https://developers.elementor.com/)
- Official upstream JavaScript library/framework/package documentation and changelogs
- [Google Search Central](https://developers.google.com/search/docs) and [web.dev performance](https://web.dev/learn/performance)

Check the **release/version, browser support, compatibility with the installed WordPress/theme/builder versions, security posture, maintenance status and appropriate fallbacks**. Cite the URLs and research date in engineering notes. Do not invent browser support, measured performance, installed versions or successful tests. If online research is unavailable, record **TO_CONFIRM** and avoid risky deployment.

## 3. Frontend architecture: polished, consistent and reusable

Adopt a shared visual system across service pages while preserving Myriad Green's current identity:
- Full-width, responsive layouts with no unwanted horizontal scroll.
- Embossed white cards, restrained borders/shadows, green service headings and CTAs, blue technical details, orange pricing accents as appropriate.
- Shared design tokens for spacing, typography, color, radii, elevation and interaction states.
- Reusable, documented components for hero sections, service benefits, evidence/testimonials, before/after proof, FAQs, location coverage, quotation prompts and contact actions.
- Optimize for clarity, hierarchy, readability, trust, reduced friction and a premium visual finish.
- User journeys must work from mobile through desktop, including tablet and narrow landscape screens.
- No unnecessary visual redesign or switching of the live theme merely to adopt a new technique.
- Do not allow Elementor section CSS or global selectors to break unrelated pages.

**Avoid fragile `100vw` plus negative-margin layout hacks**, giant unscoped CSS overrides, repeated `!important`, duplicated styling engines and interactions that work only on hover.

## 4. Modern HTML requirements

- Use semantic landmarks: `header`, `nav`, `main`, `section`, `article`, `aside`, `footer` when appropriate.
- Use real `a` links for navigation, real `button` elements for actions and correctly labelled forms with useful `autocomplete` and validation.
- Maintain proper heading hierarchy and meaningful accessible names, links, alt text, language and focus handling.
- Use native `details`/`summary` for accessible FAQ disclosure where suitable and `dialog` only with correct focus behavior.
- Use `picture`, `srcset`, `sizes`, image dimensions and modern formats when warranted by verified browser support.
- Add only validated, accurate structured data; never fabricate reviews, credentials, availability, price, service areas or rankings.
- Don't assume visually correct HTML is semantically or keyboard-accessible.

## 5. Modern CSS requirements

Evaluate appropriate stable techniques, including:
- CSS Grid, Flexbox and subgrid where supported.
- Container queries, responsive `clamp()` typography, aspect ratios, logical properties, custom properties, cascade layers and native CSS nesting.
- `:focus-visible`, `:is()`, `:where()`, `:has()` and `@supports` with tested fallbacks.
- Modern viewport sizing, system typography, intrinsic sizing, sensible line lengths and image fit.
- Modern color facilities such as OKLCH or `color-mix()` only when consistent with brand/accessibility and supported by target browsers.
- Carefully chosen modern enhancement candidates such as `@scope`, anchor positioning, View Transitions and scroll-driven animations **only after compatibility verification and accessible fallbacks**.
- Respect `prefers-reduced-motion`, adequate contrast, visible keyboard focus and sensible touch targets.
- Retain older CSS media queries and well-tested techniques when useful for backward compatibility.

Motion must support comprehension, not compete with enquiries or make the site slower.

## 6. JavaScript, libraries and APIs

- Prefer small, modern ES modules, native DOM APIs, event delegation, `fetch`, `async/await`, promises, `AbortController`, observers and carefully bounded state.
- **JavaScript libraries** provide reusable functionality; **frameworks** structure apps; **packages** are versioned dependencies; **bundlers/build tools** compile/optimize assets; **browser APIs** are built into browsers; **WordPress plugins** extend WP. Pick the correct abstraction for the job.
- Evaluate a maintained library only if its accessibility, performance, security, support, license and maintenance justify its payload. Examples may include a small tested carousel/lightbox, animation utility or interactive-form library; **no automatic framework mandate**.
- Prefer WordPress dependency-aware enqueue mechanisms, version pinning, tested upgrades and component-level loading to duplicate CDN scripts or several competing front-end frameworks.
- Integrate with existing Elementor/Rey/WordPress behavior rather than fighting it; existing jQuery or historical DOM patterns may remain where needed.
- Avoid duplicate event listeners, DOM mutation races, unsafe HTML injection, `eval`, hardcoded credentials, excessive third-party scripts and client-side trust in prices or private data.
- Make interactive elements useful without JavaScript wherever practical; progressively enhance, do not obstruct.

## 7. WordPress / Elementor governance

Existing site stack (read-only inspection on 2026-11-16): WordPress, **Rey Child**, Elementor, Amelia, Fluent Forms, LiteSpeed Cache, Rank Math and other installed plugins. Installed versions and specific capability/compatibility must be checked live before any proposed change.

1. Identify which page/template/plugin actually owns the component before editing it.
2. Read the current Elementor data, custom CSS/JS, theme CSS and relevant code; use the supported builder-specific save path.
3. Reuse existing, working elements; avoid rebuilding them in separate widgets or conflicting plugin layers.
4. Back up the actual source and document rollback before any authorized write.
5. Use version-controlled reusable assets and document where WordPress database/Elementor settings are not captured by Git.
6. Do not assume publishing Git code deploys WordPress changes.
7. **Never change the live website without explicit task authorization.** This file is documentation only.

Keep the normal website code separate from `jacquesmit/myriad-green-ecommerce` and the MAGOS runtime; document approved integration interfaces.

## 8. Conversion architecture and content

Myriad Green's normal site serves irrigation, backup-water systems, drains and leak-detection customers across Gauteng. **Keep WhatsApp as primary contact action, phone second and the authorized booking/form journey third**, unless the owner changes this strategy.

- Service offer, service area, urgency and next action should be immediately obvious.
- Support mobile click-to-chat and click-to-call; link/track source and page context without exposing internal supplier details.
- Keep **emergency paid-upfront** and **quote-first** service paths appropriately distinct; do not invent booking, payment or appointment confirmations.
- Use legitimate job proof, locally relevant content, accurate service descriptions, transparent policies and trustworthy review presentation.
- Build reusable, differentiated location/service pages; avoid doorway/thin duplicated content and unsupported superlatives.
- Maintain functional booking/WhatsApp/form handoffs and attribution without adding unnecessary fields or unsupported claims.
- Customer-facing copy must be clear, useful and natural—not technical notes, placeholders or internal prompts.

## 9. SEO, accessibility, performance and security gates

- Technical SEO: canonical URLs, indexation, mobile usability, descriptive metadata, proper heading structure, internal linking, structured data and accurate service-area targeting. A Lighthouse SEO 100 does **not** prove ranking or complete SEO.
- Accessibility: **aim for WCAG 2.2 AA**, keyboard paths, headings, form labels, focus management, target sizes, color contrast and reduced motion; test real interaction, not only automated scores.
- Performance: measure Core Web Vitals using field data where available; target **LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1** at the 75th percentile. Lab scores are diagnostic and vary across runs.
- Optimize critical rendering, fonts, images, CSS/JS loading, caching and third-party scripts, preserving functional behavior. Avoid replacing dozens of kilobytes with megabytes of dependencies.
- Security: HTTPS and no mixed content, safe dependencies, WordPress escaping/sanitization, least privilege, spam protection and no secrets in source control.

### Baseline: 2026-11-16 read-only mobile Lighthouse audit (homepage)

**Observed lab results:** Performance **55/100**, Accessibility **91/100**, Best Practices **73/100**, Lighthouse SEO **100/100**. LCP **9.3s**, FCP **8.2s**, CLS **0.012**, TBT **30ms**. Approximate audit opportunities: **2,218 KiB unused JS**, **381 KiB unused CSS**, **4,047 KiB total transferred**. The audit reported **54 insecure requests**, console errors, missing source maps and accessibility issues including contrast, unnamed links, missing main landmark and label/name mismatch. **These are audit findings, not confirmed root causes or proof that changes were made.** No sufficient CrUX field data was available in that audit.

**Priority:** (1) Investigate/resolve reported insecure requests and console errors safely; (2) profile and trim unused JS/CSS and above-the-fold loading; (3) correct accessibility issues; (4) verify user journeys and repeat comparable mobile tests. Do not assume any score increase before a measured retest.

## 10. Testing, release and evidence discipline

For every requested build:
1. **INSPECT** current live UX, DOM/source, owning templates, dependencies, analytics and prior Git history.
2. **DEFINE** scope, expected customer outcome, risks and non-negotiable existing behavior.
3. **RESEARCH** unfamiliar HTML/CSS/JS, browser support, WordPress hooks and modern alternatives.
4. **DESIGN** the smallest coherent improvement using reusable components.
5. **VERSION** changes in the right repo, preserve a known-good WordPress/Elementor rollback and keep secrets/private client data out of Git.
6. **TEST** responsive layouts, actual browser interaction, keyboard, accessibility, SEO metadata, WhatsApp/phone/forms/Amelia, image continuity, speed and no console errors.
7. **REVIEW & AUTHORIZE** before modifying production.
8. **DEPLOY** only on explicit approval; do not infer authorization from a discussion or an audit.
9. **VERIFY** the live result and compare to baseline; record URL, date, Git SHA, Elementor IDs, test outputs, exceptions and rollback.
10. **REPORT** separate `IMPLEMENTED`, `DOCUMENTED`, `DEPLOYED`, `VALIDATED`, `PENDING`, `UNKNOWN`, `TO_CONFIRM`, `BLOCKED`. Use `PASS`/`PARTIAL`/`FAIL` only where evidence warrants them.

Do not mark a page done because a draft or code snippet exists. Do not conceal regressions or call an untested feature production-ready.

## 11. Highest-leverage build principle

Optimize the **existing highest-traffic and highest-intent service journeys first**, then package the validated visual/technical patterns into reusable components for future pages. Prefer durable assets—service-page systems, review/job proof, attribution, clean internal links, contact flows, source-controlled components and SOPs—to recurring cosmetic rework.

## 12. Scope guardrail for this document

The owner requested **only this GitHub Markdown rule**. Creating or updating this document must **not** alter WordPress, Elementor, CSS/JS/HTML in production, plugins, themes, settings, prices, content, forms, automations or deployments. Other changes require a separate authorized task.
