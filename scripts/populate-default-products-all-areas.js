#!/usr/bin/env node
/**
 * populate-default-products-all-areas.js
 * Fills missing entries in data/page-products.json and data/related-products.json
 * for ALL verticals/areas/suburbs using vertical-specific default slugs.
 * Also creates minimal shop pages for any new slugs to ensure links resolve.
 * Non-destructive: preserves existing mappings and pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const SHOP_DIR = path.join(ROOT, 'shop');
const COVERAGE = path.join(DATA_DIR, 'content-coverage-report.json');
const PAGE_PRODUCTS = path.join(DATA_DIR, 'page-products.json');
const RELATED_PRODUCTS = path.join(DATA_DIR, 'related-products.json');

function readJson(p){ try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

// Vertical default slugs (baseline catalog)
const DEFAULTS = {
  irrigation: [ 'drip-irrigation-kit', 'smart-controller-x1', 'sprinkler-head-pro', 'hose-timer-basic' ],
  landscaping: [ 'landscape-design-basic', 'lawn-turf-roll', 'garden-lighting-starter', 'drip-irrigation-kit' ],
  // Default to the four capacities; page-type specific selection is handled elsewhere when needed
  'water-storage-tanks': [ 'jojo-tank-5000l', 'jojo-tank-2500l', 'jojo-tank-2000l', 'jojo-tank-1000l-slimline' ],
  'rain-water-harvesting': [ 'rain-harvest-kit', 'gutter-guard', 'first-flush-diverter', 'leaf-catcher' ],
  'water-filtration': [ 'whole-house-filter', 'under-sink-filter', 'uv-sterilizer', 'sediment-filter' ],
  pumps: [ 'pressure-pump-basic', 'submersible-pump', 'booster-pump-kit', 'pump-controller' ],
  'leak-detection': [ 'acoustic-leak-detector', 'smart-water-meter', 'pipe-repair-clamp', 'dye-tablets' ],
  'grey-water-systems': [ 'greywater-diverter', 'laundry-to-landscape', 'pump-station-kit', 'filter-box' ],
  'waste-water-systems': [ 'septic-tank-basic', 'grease-trap', 'soakaway-kit', 'bio-digester' ],
  boreholes: [ 'borehole-drilling-basic', 'borehole-pump-kit', 'borehole-casing-set', 'water-testing-kit' ]
};

function getVerticalFromKey(key){
  // key like "/vertical/.../"
  const m = key.match(/^\/([^\/]+)\//);
  return m ? m[1] : null;
}

function pickForPage(key, slugs){
  // Tailor counts by page type
  if (/(installation\.html)\/$/.test(key)) return slugs.slice(0,2);
  if (/(maintenance\.html)\/$/.test(key)) return slugs.slice(2,4);
  if (/(repairs\.html)\/$/.test(key)) return [ slugs[1], slugs[2] ];
  // products or index pages get full set
  return slugs.slice(0,4);
}

function ensureShopPage(slug){
  if (!fs.existsSync(SHOP_DIR)) fs.mkdirSync(SHOP_DIR, { recursive: true });
  const file = path.join(SHOP_DIR, `${slug}.html`);
  if (fs.existsSync(file)) return false;
  const title = slug.replace(/[-_]/g, ' ');
  const html = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${title} | Myriad Green</title>\n  <link rel="canonical" href="/shop/${slug}" />\n  <link rel="stylesheet" href="/css/reset.css">\n  <link rel="stylesheet" href="/css/layout.css">\n</head>\n<body>\n  <main>\n    <h1>${title}</h1>\n    <figure>\n      <img src="/images/products/${slug}.jpg" alt="${title}" onerror="this.src='/images/products/placeholder.svg'">\n    </figure>\n    <p>Product details coming soon.</p>\n  </main>\n</body>\n</html>\n`;
  fs.writeFileSync(file, html, 'utf8');
  return true;
}

function main(){
  const coverage = readJson(COVERAGE) || { missingProducts: [], missingRelated: [] };
  const pageProducts = readJson(PAGE_PRODUCTS) || {};
  const relatedProducts = readJson(RELATED_PRODUCTS) || {};

  const toFill = new Set([...(coverage.missingProducts||[]), ...(coverage.missingRelated||[])]);
  let filledPP = 0, filledRP = 0, createdShop = 0;

  for (const key of toFill){
    const vertical = getVerticalFromKey(key);
    if (!vertical || !DEFAULTS[vertical]) continue;
    const defaults = DEFAULTS[vertical];
    const chosen = pickForPage(key, defaults);

    if (!(key in pageProducts)) { pageProducts[key] = chosen; filledPP++; }
    if (!(key in relatedProducts)) { relatedProducts[key] = chosen.slice(0, Math.min(2, chosen.length)); filledRP++; }

    // ensure shop pages for chosen slugs
    for (const slug of chosen){ if (ensureShopPage(slug)) createdShop++; }
  }

  writeJson(PAGE_PRODUCTS, pageProducts);
  writeJson(RELATED_PRODUCTS, relatedProducts);
  console.log(`Filled page-products: ${filledPP}, related-products: ${filledRP}, created shop pages: ${createdShop}`);
}

main();
