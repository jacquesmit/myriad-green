#!/usr/bin/env node
/**
 * retrofit-template-parity-generic.js
 * Ensure pages under a target folder have core sections (non-destructive).
 * Usage: node scripts/retrofit-template-parity-generic.js <relative-or-absolute-target-dir>
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const argDir = process.argv[2] || '';
const TARGET = argDir ? (path.isAbsolute(argDir) ? argDir : path.join(ROOT, argDir)) : ROOT;

const IGNORE_DIRS = new Set(['.history', 'node_modules', '.git', '.vscode', 'service-templet']);

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) acc.push(p);
  }
  return acc;
}

function has(html, re) { return re.test(html); }
function insertAfter(html, re, block) { return html.replace(re, (m) => m + '\n' + block); }

// Minimal generic blocks (neutral copy; classes reused for styling consistency)
const blocks = {
  hero: `\n<section class="hero-irrigation"><div class="hero-grid"><div class="hero-text"><h1 id="page-h1" data-hero-title>Quality Services</h1><p data-hero-intro>Local experts for installation, repairs, and smart automation.</p><button class="btn book-now-button" id="hero-book-service">Get a Quote</button></div></div></section>`,
  iconStrip: `\n<section class="icon-strip-horizontal section"><div class="icon-strip-container"><div class="icon-feature"><i class="fas fa-award"></i><p>Experienced Team</p></div><div class="icon-feature"><i class="fas fa-tint"></i><p>Water‑Wise</p></div><div class="icon-feature"><i class="fas fa-wifi"></i><p>Smart Control</p></div><div class="icon-feature"><i class="fas fa-tools"></i><p>Repairs & Upgrades</p></div></div></section>`,
  overview: `\n<section class="overview section"><div class="container grid-two-columns"><div class="overview-image"><figure><img src="/images/mrg products/Rain-Bird-LN.png" alt="Overview" loading="lazy" /></figure></div><div class="overview-text"><h2>Comprehensive Solutions</h2><ul class="overview-list"><li>Professional design</li><li>Expert installation</li><li>Repairs & upgrades</li><li>Smart automation</li></ul></div></div></section>`,
  about: `\n<section id="about-us" class="about-us-section"><div class="container"><div class="about-hero"><article class="about-content"><header><h2>About Us</h2></header></article><div class="about-visual"><div id="weather-widget" class="weather-widget" data-suburb="" data-country="ZA" data-units="metric"></div></div></div></div></section>`,
  testimonials: `\n<section class="testimonials-section"><div class="container"><h2>What Our Clients Say</h2></div></section>`,
  features: `\n<section class="features section"><div class="container"><h2 class="section-heading">Our Services</h2><div class="grid"><div class="feature-card"><h3>Installations</h3></div><div class="feature-card"><h3>Repairs</h3></div><div class="feature-card"><h3>Smart Control</h3></div><div class="feature-card"><h3>Maintenance</h3></div></div></div></section>`,
  why: `\n<section class="why-choose-us-section"><div class="section-heading"><h2>Why Choose Us</h2></div></section>`,
  how: `\n<section class="how-it-works section"><h2 class="section-heading">How It Works</h2></section>`,
  services: `\n<section class="services-section" id="services"><div class="section-heading"><h2>Complete Services</h2></div></section>`,
  pricing: `\n<section class="pricing section"><div class="container"><h2 class="section-heading">Flexible Packages</h2></div></section>`,
  monthly: `\n<section class="monthly-pricing section alt-bg"><div class="container"><h2 class="section-heading">Monthly Care Plans</h2></div></section>`,
  gallery: `\n<section class="project-gallery-section"><div class="section-heading"><h2>Recent Projects</h2></div></section>`,
  trust: `\n<section class="trust-badges section"><div class="trust-heading"><h2>Why Trust Us</h2></div></section>`,
  design: `\n<section class="design-packages section"><div class="container"><h2 class="section-heading">Design Packages</h2></div></section>`,
  promise: `\n<section class="process-promise section"><div class="container"><h2 class="section-heading">Our Promise</h2></div></section>`,
  map: `\n<section class="map-section section" id="map"><div class="container"><h2 class="section-heading">Service Area</h2></div></section>`,
  localAreas: `\n<section class="local-service-areas section" id="local-areas"><div class="container"><h2 class="section-heading">We Service These Areas</h2><div class="suburb-list-grid"></div></div></section>`,
  products: `\n<section id="featured-products" class="featured-products" aria-labelledby="products-heading"><div class="container"><div class="products-heading-wrap center-align"><h2 id="products-heading">Featured Products</h2></div><div class="product-grid"></div><div style="display:flex;justify-content:center;margin-top:2.5rem;"><button class="cart-view-btn" id="inlineCartBtn">View Cart</button></div></div></section>`,
  faq: `\n<section class="faq-section section" id="faq"><div class="container"><h2>Frequently Asked Questions</h2></div></section>`,
  contact: `\n<section class="contact-form-section"><div class="form-layout modern-form"><div class="form-content"><h2>Contact Us</h2><form id="form-generic" class="contact-form"></form></div></div></section>`,
};

// Detection helpers: accept both generic and irrigation markers to avoid duplicates
const detect = {
  hero: /class=["'][^"']*hero-(?:irrigation|service|hero)[^"']*["']/i,
  iconStrip: /class=["'][^"']*icon-strip-horizontal[^"']*["']/i,
  overview: /class=["'][^"']*overview[^"']*["']/i,
  about: /id=["']about-us["']/i,
  testimonials: /class=["'][^"']*testimonials-section[^"']*["']/i,
  features: /class=["'][^"']*features[^"']*["']/i,
  why: /class=["'][^"']*why-choose-us-section[^"']*["']/i,
  how: /class=["'][^"']*how-it-works[^"']*["']/i,
  services: /(id=["'](?:services|irrigation-services)["'])|class=["'][^"']*(?:services-section|irrigation-services-section)[^"']*["']/i,
  pricing: /class=["'][^"']*pricing[^"']*["']/i,
  monthly: /class=["'][^"']*monthly-pricing[^"']*["']/i,
  gallery: /class=["'][^"']*project-gallery-section[^"']*["']/i,
  trust: /class=["'][^"']*trust-badges[^"']*["']/i,
  design: /class=["'][^"']*design-packages[^"']*["']/i,
  promise: /class=["'][^"']*process-promise[^"']*["']/i,
  map: /id=["']map["']/i,
  localAreas: /id=["']local-areas["']/i,
  products: /id=["'](?:featured-products|featured-irrigation-products)["']/i,
  faq: /id=["']faq["']/i,
  contact: /class=["'][^"']*contact-form-section[^"']*["']/i,
};

function blockRe(key) {
  const map = {
    hero: /<section[^>]*class=["'][^"']*hero-(?:irrigation|service|hero)[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    iconStrip: /<section[^>]*class=["'][^"']*icon-strip-horizontal[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    overview: /<section[^>]*class=["'][^"']*overview[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    about: /<section[^>]*id=["']about-us["'][^>]*>[\s\S]*?<\/section>/i,
    testimonials: /<section[^>]*class=["'][^"']*testimonials-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    features: /<section[^>]*class=["'][^"']*features[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    why: /<section[^>]*class=["'][^"']*why-choose-us-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    how: /<section[^>]*class=["'][^"']*how-it-works[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    services: /<section[^>]*(?:id=["'](?:services|irrigation-services)["']|class=["'][^"']*(?:services-section|irrigation-services-section)[^"']*["'])[\s\S]*?<\/section>/i,
    pricing: /<section[^>]*class=["'][^"']*pricing[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    monthly: /<section[^>]*class=["'][^"']*monthly-pricing[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    gallery: /<section[^>]*class=["'][^"']*project-gallery-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    trust: /<section[^>]*class=["'][^"']*trust-badges[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    design: /<section[^>]*class=["'][^"']*design-packages[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    promise: /<section[^>]*class=["'][^"']*process-promise[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    map: /<section[^>]*id=["']map["'][^>]*>[\s\S]*?<\/section>/i,
    localAreas: /<section[^>]*id=["']local-areas["'][^>]*>[\s\S]*?<\/section>/i,
    products: /<section[^>]*id=["'](?:featured-products|featured-irrigation-products)["'][^>]*>[\s\S]*?<\/section>/i,
    faq: /<section[^>]*id=["']faq["'][^>]*>[\s\S]*?<\/section>/i,
    contact: /<section[^>]*class=["'][^"']*contact-form-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
  };
  return map[key];
}

function retrofit(html) {
  let out = html;
  // Insert missing hero after <main>
  if (!detect.hero.test(out)) {
    out = insertAfter(out, /<main[^>]*>/i, blocks.hero);
  }
  const chain = [
    { key: 'iconStrip', after: 'hero', re: detect.iconStrip },
    { key: 'overview', after: 'iconStrip', re: detect.overview },
    { key: 'about', after: 'overview', re: detect.about },
    { key: 'testimonials', after: 'about', re: detect.testimonials },
    { key: 'features', after: 'testimonials', re: detect.features },
    { key: 'why', after: 'features', re: detect.why },
    { key: 'how', after: 'why', re: detect.how },
    { key: 'services', after: 'how', re: detect.services },
    { key: 'pricing', after: 'services', re: detect.pricing },
    { key: 'monthly', after: 'pricing', re: detect.monthly },
    { key: 'gallery', after: 'monthly', re: detect.gallery },
    { key: 'trust', after: 'gallery', re: detect.trust },
    { key: 'design', after: 'trust', re: detect.design },
    { key: 'promise', after: 'design', re: detect.promise },
    { key: 'map', after: 'promise', re: detect.map },
    { key: 'localAreas', after: 'map', re: detect.localAreas },
    { key: 'products', after: 'localAreas', re: detect.products },
    { key: 'faq', after: 'products', re: detect.faq },
    { key: 'contact', after: 'faq', re: detect.contact },
  ];

  function getBlockRe(key) { return blockRe(key); }

  let prevKey = 'hero';
  for (const step of chain) {
    if (!step.re.test(out)) {
      const prevRe = getBlockRe(prevKey);
      if (prevRe && prevRe.test(out)) {
        out = out.replace(prevRe, (m) => m + '\n' + blocks[step.key]);
      } else {
        out = out.replace(/<footer[\s\S]*$/i, blocks[step.key] + '\n$&');
      }
    }
    prevKey = step.key;
  }
  return out;
}

function main() {
  if (!fs.existsSync(TARGET)) {
    console.error('Target folder not found:', TARGET);
    process.exit(1);
  }
  const files = walk(TARGET);
  let changed = 0;
  for (const f of files) {
    let html = fs.readFileSync(f, 'utf8');
    const before = html;
    html = retrofit(html);
    if (html !== before) {
      fs.writeFileSync(f, html, 'utf8');
      console.log('Patched', f);
      changed++;
    }
  }
  console.log(`Done. Patched ${changed} files in ${path.relative(ROOT, TARGET) || '.'}.`);
}

main();
