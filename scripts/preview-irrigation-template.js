#!/usr/bin/env node
/*
  preview-irrigation-template.js
  - Renders the irrigation-page-template.html with sample token values for a quick preview.
  - Writes to irrigation/_preview/index.html (non-destructive).
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TEMPLATE = path.join(ROOT, 'service-templet', 'irrigation-page-template.html');
const OUT_DIR = path.join(ROOT, 'irrigation', '_preview');
const OUT_FILE = path.join(OUT_DIR, 'index.html');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function renderTemplate(tpl, data) {
  return tpl
    .replace(/\{\{PAGE_TITLE\}\}/g, data.pageTitle)
    .replace(/\{\{META_DESCRIPTION\}\}/g, data.metaDescription)
    .replace(/\{\{CANONICAL_URL\}\}/g, data.canonical)
    .replace(/\{\{META_KEYWORDS\}\}/g, data.keywords)
    .replace(/\{\{PAGE_KEY\}\}/g, data.pageKey)
    .replace(/\{\{CITY_NAME\}\}/g, data.city)
    .replace(/\{\{SUBURB_NAME\}\}/g, data.suburb)
    .replace(/\{\{HERO_TITLE\}\}/g, data.heroTitle)
    .replace(/\{\{HERO_INTRO\}\}/g, data.heroIntro)
    .replace(/\{\{OVERVIEW_IMAGE_URL\}\}/g, data.overviewImageUrl)
    .replace(/\{\{OVERVIEW_IMAGE_ALT\}\}/g, data.overviewImageAlt)
    .replace(/\{\{WEATHER_SUBURB\}\}/g, data.weatherSuburb)
    .replace(/\{\{REGION_NAME\}\}/g, data.region)
    .replace(/\{\{PAGE_SOURCE\}\}/g, data.pageSource)
    .replace(/\{\{LOCAL_SERVICES_LINKS\}\}/g, data.localServicesLinks)
    .replace(/\{\{PRODUCTS_COUNT\}\}/g, String(data.productsCount))
    .replace(/\{\{PRODUCTS_HEADING\}\}/g, data.productsHeading)
    .replace(/\{\{PRODUCT_GRID_ITEMS\}\}/g, data.productGridItems);
}

function buildSampleProducts() {
  const items = [
    { slug: 'rain-bird-5004-sprinkler', name: 'Rain Bird 5004 Sprinkler' },
    { slug: 'smart-controller-x1', name: 'Smart Controller X1' },
    { slug: 'drip-irrigation-kit', name: 'Drip Irrigation Kit' },
    { slug: 'pressure-regulator', name: 'Pressure Regulator' },
  ];
  return items.map(it => `
  <article class="product-card">
    <a href="/shop/${it.slug}">
      <figure><img src="/images/products/placeholder.svg" alt="${it.name}"></figure>
      <h3>${it.name}</h3>
    </a>
    <p class="description" style="display:none;"></p>
    <div class="card-actions">
      <button class="add-to-cart-btn" data-id="${it.slug}" data-name="${it.name}" data-price="0">Add to Cart</button>
      <button class="buy-now-btn" data-id="${it.slug}" data-name="${it.name}" data-price="0">Buy Now</button>
    </div>
  </article>`).join('');
}

(function main() {
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  const data = {
    pageTitle: 'Irrigation Pretoria East | Installations, Repairs, Maintenance',
    metaDescription: 'Smart irrigation in Pretoria East. Installations, repairs, water‑wise upgrades. Local experts in Hatfield, Lynnwood, Faerie Glen and nearby.',
    canonical: 'https://www.myriadgreen.co.za/irrigation/pretoria/_preview/',
    keywords: 'Irrigation Pretoria, Sprinkler Repairs Pretoria, Smart Irrigation Pretoria',
    pageKey: 'pretoria-preview-index',
    city: 'Pretoria',
    suburb: 'Pretoria East',
    heroTitle: 'Irrigation Services in Pretoria East',
    heroIntro: 'Local, water‑wise irrigation installations, sprinkler repairs, and monthly maintenance for homes and estates in Pretoria East.',
    overviewImageUrl: '/images/mrg products/removed back ground/esp-me_3stn-module_wide_00134_1-removebg-preview.png',
    overviewImageAlt: 'Smart Irrigation Controller',
    weatherSuburb: 'Pretoria',
    region: 'Pretoria',
    pageSource: 'Irrigation – Preview',
    localServicesLinks: '<a class="local-link" href="/irrigation/pretoria/hatfield/">Hatfield</a> <a class="local-link" href="/irrigation/pretoria/lynnwood/">Lynnwood</a> <a class="local-link" href="/irrigation/pretoria/faerie-glen/">Faerie Glen</a>',
    productsCount: 4,
    productsHeading: 'Popular Irrigation Products',
    productGridItems: buildSampleProducts(),
  };

  const html = renderTemplate(tpl, data);
  ensureDir(OUT_DIR);
  fs.writeFileSync(OUT_FILE, html, 'utf8');
  console.log(`Preview written: ${path.relative(ROOT, OUT_FILE)}`);
})();
