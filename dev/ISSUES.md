# Dark Mode Issues — Audit & Quick Wins

This file captures the occurrences of literal white backgrounds and recommended quick wins to improve dark-mode compatibility for service pages.

Summary
-------
We searched the codebase for `background: white`, `background: #fff/#ffffff`, and `rgba(255,255,255,...)` usages that cause bright panels in `[data-theme="dark"]`.

High-impact files (quick wins)
- `css/service-main-page.css` — multiple `background: white` and `rgba(255,255,255,...)` entries used for cards, overlays, and section mounts. Replace with tokenized values or add dark overrides.
- `css/service-areas-section.css` — cards, badges, and map containers have literal white backgrounds; add `--card-background` fallback and `[data-theme="dark"]` overrides where missing.
- `css/weather-section-redesign.css` — `weather-card`, `weather-stats-bar`, and CTA buttons use `background: white`; dark overrides were added but tokenizing the base makes it safer.
- `css/service-faq-v2.css` — several `background: white !important;` entries.
- Misc: `css/booking-modal.css`, `css/checkout.css`, `css/cart-modal.css`, `css/footer.css`, and other small files.

Quick Wins Applied
------------------
- Replace literal `background: white` with `background: var(--card-background, white)` in low-risk places so dark mode can override the CSS variable. This keeps the light theme identical while making dark overrides straightforward.

Recommended Next Steps
----------------------
1. Review `dev/ISSUES.md` and accept the tokenization quick fixes.
2. For high-traffic pages (service main, areas, weather), run a smoke test in both themes and capture before/after screenshots.
3. For third-party widgets (trends): run the same-origin debug harness and decide between overlay, injector, or server proxy. Document decision in this file.
4. Replace remaining `rgba(255,255,255,alpha)` usages with theme-aware variables if they produce noticeable brightness in dark mode.

How to reproduce
----------------
- Start dev server: `npm run dev`
- Visit the pages and toggle theme (site uses `[data-theme]` on documentElement)
- Inspect elements with bright backgrounds using DevTools

Notes
-----
This is a living document; I'll update it with precise file:line matches and screenshots as we progress.

---
Created: 2025-10-05
Branch: feature-incomplete-section
