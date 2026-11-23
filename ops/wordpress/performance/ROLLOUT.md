# Myriad Green homepage JavaScript reduction — rollout and rollback

Status: STAGED IN GIT ONLY. Not deployed. Do not merge without validating deployment linkage of the active Rey child theme.

## Evidence (23 November 2026)
- Slider Revolution v6.7.34 registers `tp-tools`, `sr7`, `sr7css` and conditional `sr7migration`.
- Homepage WordPress page ID 1486 contains no Slider Revolution references in standard post content or postmeta.
- Rendered homepage shows Slider Revolution page bootstrap but no `<sr7-module>`.
- LiteSpeed's prior hero-image lazy-load exception is already live and must remain unchanged.
- Before patch: mobile Lighthouse performance 55/100; LCP 9.3 s, unused JS estimate 2,235 KiB.
- WPVibe reports child theme source read-only; WPCode is not installed. GitHub repository cannot yet be verified as deployment source for the active theme.

## Preconditions
1. Back up the **live** `rey-child/functions.php` and record file checksum.
2. Validate that no Elementor/global footer or other homepage component uses a Slider Revolution slider.
3. Confirm this repo/branch is mapped to the actual deployed child theme.
4. Review the PHP block in `homepage-slider-asset-guard.php` and append it to child theme only through approved deployment.

## Acceptance checks
- Homepage HTML has no Slider Revolution inline page bootstrap, no `sr7.js` or `tptools.js`, and no `sr7css` stylesheet.
- Other pages retain their original Slider Revolution output.
- Homepage hero visible on mobile and desktop; menu, rail, navigation work.
- WhatsApp target and call target are correct; Fluent Forms can submit a SAFE TEST lead without contacting a real customer.
- Priority booking page renders Amelia and interactive service/date/time steps. Test no-cost sandbox/test booking only; do not create real reservations.
- WooCommerce product discovery and variation selection work; test add-to-cart, populated cart, checkout validation in test mode without charging customers.
- Fresh Lighthouse mobile run; log Performance, LCP, FCP, unused JS, console/network requests and best-practices. No claim of improvement unless measured.
- Check exact requested URL list for HTTPS mixed-content failures; do not mass-rewrite URLs based only on summary count.

## Rollback
1. Remove only the added asset-guard block from live `rey-child/functions.php` or restore the backed-up file.
2. Purge homepage LiteSpeed cache.
3. Recheck homepage and booking/cart/checkout.
4. Revert PR/commit if it was incorporated into deployed source.

## Gates
- Implemented in Git: YES
- Deployment to WordPress: NO
- Production validation: NO
- Amelia transaction acceptance: NO
- WooCommerce transaction acceptance: NO
