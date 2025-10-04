# Dark mode: Trends widget still shows white background

Date: 2025-10-05
Branch: feature-incomplete-section

Summary:
The Trends widget on service pages and the index still renders a white/bright block in dark theme in some cases. This appears to be caused by provider-rendered content (often an iframe or embedded SVG/canvas) that does not respect the host page's dark theme. Current local mitigations (theme-scoped CSS, overlay pseudo-element, and a same-origin injector) are in place but do not fully resolve cross-origin iframe cases.

Reproduction steps:
1. Start the dev server: `npm run dev` (server prints `http://localhost:3000`).
2. Open a service page that includes the trends widget or open `index.html`.
3. Set the site theme to dark (site toggle or run in console):
   `document.documentElement.setAttribute('data-theme','dark')`
4. Inspect the trends container (`#trends-widget` or `.trends-widget-container`).
5. If an `iframe` is present, note its `src` origin. If cross-origin, host-side injection cannot modify its internal styling.
6. Request `/api/trends?theme=dark` and inspect the response payload.

Current status:
- Same-origin injected content: injector + CSS should work and has been implemented.
- Cross-origin iframe content: overlay masks are in place but do not change internal content. Provider dark-mode parameter or server-side proxy would be required for a full fix.

Next steps:
- Create a `dev/trends-debug.html` page and a same-origin mock provider to test injectors reliably.
- If provider supports a `theme` param, pass it through to produce dark content; otherwise, consider a dev-only proxy route (needs review) or reimplementing the widget on our side.

Notes:
- This file records the current issue and repro guidance for team members.
