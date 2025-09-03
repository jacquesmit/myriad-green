#!/usr/bin/env node
/**
 * retrofit-template-parity.js
 * Ensure irrigation pages have core sections from the template.
 * - Non-destructive: if a section exists (by id/class marker), leave it.
 * - If missing, inject a minimal scaffold version of that section in the right place.
 * Targets (ordered):
 *  hero(.hero-irrigation), icon strip(.icon-strip-horizontal), overview(.overview), about(#about-us + #weather-widget), testimonials(.testimonials-section), features(.features), why-choose-us(.why-choose-us-section), how-it-works(.how-it-works), irrigation-services(#irrigation-services), pricing(.pricing), monthly-pricing(.monthly-pricing), project-gallery(.project-gallery-section), trust-badges(.trust-badges), design-packages(.design-packages), process-promise(.process-promise), map(#map), local areas(#local-areas), featured products(#featured-irrigation-products), faq(#faq), contact form(.contact-form-section)
 */
const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.isFile() && e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function has(html, re) { return re.test(html); }
function insertAfter(html, re, block) { return html.replace(re, (m) => m + '\n' + block); }

// Minimal blocks (token-light) to avoid overwriting copy; these mirror the template structure
const blocks = {
  hero: `\n<section class="hero-irrigation"><div class="hero-grid"><div class="hero-text"><h1 id="page-h1" data-hero-title>Smart Irrigation Services</h1><p data-hero-intro>Local irrigation experts: installation, repairs, and smart automation.</p><button class="btn book-now-button" id="hero-book-service">Get a Quote</button></div></div></section>` ,
  iconStrip: `\n<section class="icon-strip-horizontal section"><div class="icon-strip-container"><div class="icon-feature"><i class="fas fa-award"></i><p>Experienced Team</p></div><div class="icon-feature"><i class="fas fa-tint"></i><p>Water‑Wise</p></div><div class="icon-feature"><i class="fas fa-wifi"></i><p>Smart Control</p></div><div class="icon-feature"><i class="fas fa-tools"></i><p>Repairs & Upgrades</p></div></div></section>` ,
  overview: `\n<section class="overview section"><div class="container grid-two-columns"><div class="overview-image"><figure><img src="/images/mrg products/Rain-Bird-LN.png" alt="Irrigation overview" loading="lazy" /></figure></div><div class="overview-text"><h2>Complete Irrigation Solutions</h2><ul class="overview-list"><li>Smart controllers</li><li>Drip & spray</li><li>Leak fixes</li><li>Water savings</li></ul></div></div></section>` ,
  about: `\n<section id="about-us" class="about-us-section"><div class="container"><div class="about-hero"><article class="about-content"><header><h2>About Myriad Green</h2></header></article><div class="about-visual"><div id="weather-widget" class="weather-widget" data-suburb="" data-country="ZA" data-units="metric"></div></div></div></div></section>` ,
  testimonials: `\n<section class="testimonials-section"><div class="container"><h2>What Our Clients Say</h2></div></section>` ,
  features: `\n<section class="features section"><div class="container"><h2 class="section-heading">Irrigation Services</h2><div class="grid"><div class="feature-card"><h3>Smart Controllers</h3></div><div class="feature-card"><h3>Drip Systems</h3></div><div class="feature-card"><h3>Zoning</h3></div><div class="feature-card"><h3>Repairs</h3></div></div></div></section>` ,
  why: `\n<section class="why-choose-us-section"><div class="section-heading"><h2>Why Choose Us</h2></div></section>` ,
  how: `\n<section class="how-it-works section"><h2 class="section-heading">How It Works</h2></section>` ,
  services: `\n<section class="irrigation-services-section" id="irrigation-services"><div class="section-heading"><h2>Complete Irrigation Services</h2></div></section>` ,
  pricing: `\n<section class="pricing section"><div class="container"><h2 class="section-heading">Flexible Packages</h2></div></section>` ,
  monthly: `\n<section class="monthly-pricing section alt-bg"><div class="container"><h2 class="section-heading">Monthly Care Plans</h2></div></section>` ,
  gallery: `\n<section class="project-gallery-section"><div class="section-heading"><h2>Recent Projects</h2></div></section>` ,
  trust: `\n<section class="trust-badges section"><div class="trust-heading"><h2>Why Trust Us</h2></div></section>` ,
  design: `\n<section class="design-packages section"><div class="container"><h2 class="section-heading">Irrigation Design Packages</h2></div></section>` ,
  promise: `\n<section class="process-promise section"><div class="container"><h2 class="section-heading">Our Promise</h2></div></section>` ,
  map: `\n<section class="map-section section" id="map"><div class="container"><h2 class="section-heading">Service Area</h2></div></section>` ,
  localAreas: `\n<section class="local-service-areas section" id="local-areas"><div class="container"><h2 class="section-heading">We Service These Areas</h2><div class="suburb-list-grid"></div></div></section>` ,
  products: `\n<section id="featured-irrigation-products" class="featured-products" aria-labelledby="irrigation-products-heading"><div class="container"><div class="products-heading-wrap center-align"><h2 id="irrigation-products-heading">Featured Irrigation Products</h2></div><div class="product-grid"></div><div style="display:flex;justify-content:center;margin-top:2.5rem;"><button class="cart-view-btn" id="inlineCartBtn">View Cart</button></div></div></section>` ,
  faq: `\n<section class="faq-section section" id="faq"><div class="container"><h2>Frequently Asked Questions</h2></div></section>` ,
  contact: `\n<section class="contact-form-section"><div class="form-layout modern-form"><div class="form-content"><h2>Irrigation Services</h2><form id="form-irrigation" class="contact-form"></form></div></div></section>` ,
};

function retrofit(html) {
  let out = html;
  // Insert missing hero after <main>
  if (!/class=["'][^"']*hero-irrigation[^"']*["']/i.test(out)) {
    out = insertAfter(out, /<main[^>]*>/i, blocks.hero);
  }
  // Ordered inserts after known blocks
  const chain = [
    { key: 'iconStrip', after: 'hero', re: /class=["'][^"']*icon-strip-horizontal[^"']*["']/i },
    { key: 'overview', after: 'iconStrip', re: /class=["'][^"']*overview[^"']*["']/i },
    { key: 'about', after: 'overview', re: /id=["']about-us["']/i },
    { key: 'testimonials', after: 'about', re: /class=["'][^"']*testimonials-section[^"']*["']/i },
    { key: 'features', after: 'testimonials', re: /class=["'][^"']*features[^"']*["']/i },
    { key: 'why', after: 'features', re: /class=["'][^"']*why-choose-us-section[^"']*["']/i },
    { key: 'how', after: 'why', re: /class=["'][^"']*how-it-works[^"']*["']/i },
    { key: 'services', after: 'how', re: /id=["']irrigation-services["']/i },
    { key: 'pricing', after: 'services', re: /class=["'][^"']*pricing[^"']*["']/i },
    { key: 'monthly', after: 'pricing', re: /class=["'][^"']*monthly-pricing[^"']*["']/i },
    { key: 'gallery', after: 'monthly', re: /class=["'][^"']*project-gallery-section[^"']*["']/i },
    { key: 'trust', after: 'gallery', re: /class=["'][^"']*trust-badges[^"']*["']/i },
    { key: 'design', after: 'trust', re: /class=["'][^"']*design-packages[^"']*["']/i },
    { key: 'promise', after: 'design', re: /class=["'][^"']*process-promise[^"']*["']/i },
    { key: 'map', after: 'promise', re: /id=["']map["']/i },
    { key: 'localAreas', after: 'map', re: /id=["']local-areas["']/i },
    { key: 'products', after: 'localAreas', re: /id=["']featured-irrigation-products["']/i },
    { key: 'faq', after: 'products', re: /id=["']faq["']/i },
    { key: 'contact', after: 'faq', re: /class=["'][^"']*contact-form-section[^"']*["']/i },
  ];

  function blockRe(key) {
    const map = {
      hero: /<section[^>]*class=["'][^"']*hero-irrigation[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      iconStrip: /<section[^>]*class=["'][^"']*icon-strip-horizontal[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      overview: /<section[^>]*class=["'][^"']*overview[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      about: /<section[^>]*id=["']about-us["'][^>]*>[\s\S]*?<\/section>/i,
      testimonials: /<section[^>]*class=["'][^"']*testimonials-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      features: /<section[^>]*class=["'][^"']*features[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      why: /<section[^>]*class=["'][^"']*why-choose-us-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      how: /<section[^>]*class=["'][^"']*how-it-works[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      services: /<section[^>]*id=["']irrigation-services["'][^>]*>[\s\S]*?<\/section>/i,
      pricing: /<section[^>]*class=["'][^"']*pricing[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      monthly: /<section[^>]*class=["'][^"']*monthly-pricing[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      gallery: /<section[^>]*class=["'][^"']*project-gallery-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      trust: /<section[^>]*class=["'][^"']*trust-badges[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      design: /<section[^>]*class=["'][^"']*design-packages[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      promise: /<section[^>]*class=["'][^"']*process-promise[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      map: /<section[^>]*id=["']map["'][^>]*>[\s\S]*?<\/section>/i,
      localAreas: /<section[^>]*id=["']local-areas["'][^>]*>[\s\S]*?<\/section>/i,
      products: /<section[^>]*id=["']featured-irrigation-products["'][^>]*>[\s\S]*?<\/section>/i,
      faq: /<section[^>]*id=["']faq["'][^>]*>[\s\S]*?<\/section>/i,
      contact: /<section[^>]*class=["'][^"']*contact-form-section[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
    };
    return map[key];
  }

  let prevKey = 'hero';
  for (const step of chain) {
    if (!has(out, step.re)) {
      const prevRe = blockRe(prevKey);
      if (prevRe && prevRe.test(out)) {
        out = out.replace(prevRe, (m) => m + '\n' + blocks[step.key]);
      } else {
        // fallback: append before footer
        out = out.replace(/<footer[\s\S]*$/i, blocks[step.key] + '\n$&');
      }
    }
    prevKey = step.key;
  }

  return out;
}

function main() {
  const ROOT = process.cwd();
  const base = path.join(ROOT, 'irrigation');
  if (!fs.existsSync(base)) return;
  const files = walk(base);
  let changed = 0;
  for (const f of files) {
    if (/\.history\//i.test(f)) continue;
    let html = fs.readFileSync(f, 'utf8');
    const before = html;
    html = retrofit(html);
    if (html !== before) {
      fs.writeFileSync(f, html, 'utf8');
      console.log('Patched', f);
      changed++;
    }
  }
  console.log(`Done. Patched ${changed} files.`);
}

main();
