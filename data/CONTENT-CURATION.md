# Content curation guide

This project uses simple JSON maps to populate per-page content and product data at scale.

- data/page-copy.json
  - defaults.hero.intro: fallback hero intro for all pages
  - overrides: optional page-specific overrides keyed by page key
- data/page-products.json
  - Maps a page-path key to an array of product slugs to render in the Featured Products grid
- data/related-products.json
  - Maps a section path to related product slugs rendered by js/related-products.js

## Keys and where they’re used

- Page key (for page-copy.json overrides):
  - Derived from the file path and the <h1 id="page-h1" data-page-key> attribute if present.
  - If not present, it’s built like: vertical-area-suburb[-keyword.html]
    - Examples:
      - irrigation-pretoria-hatfield
      - irrigation-pretoria-hatfield-irrigation-installation.html

- Page-path key (for page-products.json):
  - Exact format used by the injector: `/${vertical}/${rest-of-path}/`
  - Includes a trailing slash, even when the page is an .html file.
  - Examples:
    - /irrigation/pretoria/hatfield/
    - /irrigation/pretoria/hatfield/irrigation-installation.html/

- Section path (for related-products.json):
  - Taken from the page’s `<section id="related-products" data-section-path="...">` attribute.
  - Example: /irrigation/pretoria/hatfield/

## Minimal examples

- data/page-copy.json
```
{
  "defaults": {
    "hero": {
      "intro": "Trusted local specialists for design, installation and maintenance.",
      "cta": "Get a Quote"
    }
  },
  "overrides": {
    "irrigation-pretoria-hatfield": {
      "heroIntro": "Hatfield’s go-to irrigation team for precise, water-wise systems."
    },
    "irrigation-pretoria-hatfield-irrigation-installation.html": {
      "heroIntro": "Professional irrigation installation in Hatfield, Pretoria."
    }
  }
}
```

- data/page-products.json
```
{
  "/irrigation/pretoria/hatfield/": [
    "smart-controller-x1",
    "drip-kit-basic",
    "sprinkler-head-pro",
    "25mm-ldp-pipe-100m"
  ],
  "/irrigation/pretoria/hatfield/irrigation-installation.html/": [
    "smart-controller-x1",
    "rain-sensor-pro"
  ]
}
```

- data/related-products.json
```
{
  "/irrigation/pretoria/hatfield/": ["smart-controller-x1", "drip-kit-basic", "sprinkler-head-pro"]
}
```

## Workflow

1) Add or update entries in data/page-products.json and data/related-products.json
2) Optionally add page-specific copy in data/page-copy.json > overrides
3) Run the injectors:
   - node scripts/apply-page-copy-and-products.js
   - node scripts/enforce-product-grid-count-generic.js
4) Validate links:
   - node scripts/check-internal-links.js

Tip: use scripts/report-content-coverage.js to find pages missing product or related-product mappings.
