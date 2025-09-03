#!/usr/bin/env node
/**
 * generate-vertical-ia-from-irrigation.js
 * Mirrors the /irrigation IA (areas/suburbs) for a target vertical by creating
 * area hubs (index + all-locations) and suburb pages with consistent sections and dynamic hooks.
 *
 * Usage: node scripts/generate-vertical-ia-from-irrigation.js <vertical> [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IRRIGATION_DIR = path.join(ROOT, 'irrigation');

const [,, targetVertical, maybeDry] = process.argv;
const DRY_RUN = maybeDry === '--dry-run';

if (!targetVertical) {
  console.error('Usage: node scripts/generate-vertical-ia-from-irrigation.js <vertical> [--dry-run]');
  process.exit(1);
}

function ensureDir(p) { if (DRY_RUN) return; fs.mkdirSync(p, { recursive: true }); }
function writeFileIfMissing(p, content) {
  if (fs.existsSync(p)) return false;
  if (!DRY_RUN) fs.writeFileSync(p, content, 'utf8');
  return true;
}
function toTitleCase(slug) { return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }
function htmlEscape(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function baseHead(title){
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${htmlEscape(title)}</title>\n  <link rel="stylesheet" href="/css/reset.css" />\n  <link rel="stylesheet" href="/css/theme.css" />\n  <link rel="stylesheet" href="/css/utilities.css" />\n  <link rel="stylesheet" href="/css/main.css" />\n  <link rel="stylesheet" href="/css/landinghero.css" />\n  <link rel="stylesheet" href="/css/servicesection.css" />\n  <link rel="stylesheet" href="/css/booking-modal.css" />\n  <link rel="stylesheet" href="/css/faq-section.css" />\n  <link rel="stylesheet" href="/css/testimonials.css" />\n  <link rel="stylesheet" href="/css/about-us-section.css" />\n  <link rel="stylesheet" href="/css/main-navigation.css" />\n  <link rel="stylesheet" href="/css/mobile-nav.css" />\n  <link rel="stylesheet" href="/css/footer.css" />\n  <link rel="stylesheet" href="/css/navbar.css" />\n  <link rel="stylesheet" href="/css/theme-toggle.css" />\n  <link rel="stylesheet" href="/css/components/buttons/book-now-button.css" />\n  <link rel="stylesheet" href="/css/components/buttons/social-bar.css" />\n  <link rel="stylesheet" href="/css/floating-bar-reopen-btn.css" />\n  <link rel="stylesheet" href="/css/contact-us-form.css">\n  <link rel="stylesheet" href="/css/mobile-tweaks.css" />\n  <link rel="stylesheet" href="/css/icon-strip-mobile.css" />\n  <link rel="stylesheet" href="/css/mobile-tap-feedback.css" />\n  <link rel="stylesheet" href="/css/mobile-scroll-icon-animate.css" />\n  <link rel="stylesheet" href="/css/layout.css" />\n  <link rel="stylesheet" href="/css/weather-widget.css">\n  <link rel="stylesheet" href="/css/cart-modal.css" />\n  <link rel="stylesheet" href="/css/checkout.css" />\n  <link rel="stylesheet" href="/css/shop-section.css" />\n</head>`;
}

function sharedBodyTop(){
  return `\n<body>\n  <div id="site-social-bar"></div>\n  <div id="site-nav"></div>\n  <main>`;
}

function sharedBodyBottom(){
  return `\n  </main>\n  <footer id="site-footer" aria-label="Site footer"></footer>\n  <div id="booking-modal-container"></div>\n  <button class="scroll-to-top" aria-label="Scroll to top"><i class="fas fa-arrow-up"></i></button>\n  <button id="openCartBtn" class="floating-cart-btn" aria-label="View cart"><i class="fas fa-shopping-cart"></i><span class="cart-badge" id="cartCount">0</span></button>\n  <div id="cartModal" class="cart-modal hidden"><div class="cart-modal-content"><button id="closeCartBtn" class="close-btn" aria-label="Close cart">&times;</button><h2>Your Cart</h2><ul id="cartItemsList" class="cart-items-list"></ul><p class="total">Total: R<span id="cartTotal">0.00</span></p><div class="checkout-actions"></div></div></div>\n  <script src="/js/booking-modal-loader.js" defer></script>\n  <script src="/js/cart-modal.js" defer></script>\n  <script src="/js/checkout.js" defer></script>\n  <script src="/js/site-init.js" defer></script>\n  <script src="/js/testimonial-carousel-irrigation.js" defer></script>\n  <script src="/js/weather-widget.js" defer></script>\n  <script src="/js/h1-injector.js" defer></script>\n  <script src="/js/weather-signal.js" defer></script>\n  <script src="/js/related-products.js" defer></script>\n</body>\n</html>`;
}

function heroSection(pageKey, city, title, intro){
  return `\n<section class="hero-irrigation">\n  <div class="hero-grid">\n    <div class="hero-text">\n      <h1 id=\"page-h1\" data-page-key=\"${pageKey}\" data-city=\"${htmlEscape(city)}\" data-hero-title>${htmlEscape(title)}</h1>\n      <p data-hero-intro>${htmlEscape(intro)}</p>\n      <button class="btn book-now-button" id="hero-book-service">Get a Quote</button>\n    </div>\n  </div>\n</section>`;
}

function iconStrip(items){
  const icons = items.map(i=>`<div class="icon-feature"><i class="${i.icon}"></i><p>${htmlEscape(i.text)}</p></div>`).join('');
  return `\n<section class="icon-strip-horizontal section"><div class="icon-strip-container">${icons}</div></section>`;
}

function overviewSection(imgAlt, heading, bullets){
  const lis = bullets.map(b=>`<li>${htmlEscape(b)}</li>`).join('');
  return `\n<section class="overview section"><div class="container grid-two-columns"><div class="overview-image"><figure><img src="/images/work/Booster-Pump And tank Installation .jpg" alt="${htmlEscape(imgAlt)}" loading="lazy" /></figure></div><div class="overview-text"><h2>${htmlEscape(heading)}</h2><ul class="overview-list">${lis}</ul></div></div></section>`;
}

function aboutWeather(){
  return `\n<section id="about-us" class="about-us-section"><div class="container"><div class="about-hero"><article class="about-content"><header><h2>About Myriad Green</h2></header></article><div class="about-visual"><div id="weather-widget" class="weather-widget" data-suburb="" data-country="ZA" data-units="metric"></div></div></div></div></section>`;
}

function standardSections(){
  return `\n<section class="testimonials-section"><div class="container"><h2>What Our Clients Say</h2></div></section>\n<section class="features section"><div class="container"><h2 class="section-heading">Complete Services</h2><div class="grid"><div class="feature-card"><h3>Option 1</h3></div><div class="feature-card"><h3>Option 2</h3></div><div class="feature-card"><h3>Option 3</h3></div><div class="feature-card"><h3>Option 4</h3></div></div></div></section>\n<section class="why-choose-us-section"><div class="section-heading"><h2>Why Choose Us</h2></div></section>\n<section class="how-it-works section"><h2 class="section-heading">How It Works</h2></section>\n<section class="services-section" id="services"><div class="section-heading"><h2>Complete Services</h2></div></section>\n<section class="pricing section"><div class="container"><h2 class="section-heading">Flexible Packages</h2></div></section>\n<section class="monthly-pricing section alt-bg"><div class="container"><h2 class="section-heading">Monthly Care Plans</h2></div></section>\n<section class="project-gallery-section"><div class="section-heading"><h2>Recent Projects</h2></div></section>\n<section class="trust-badges section"><div class="trust-heading"><h2>Why Trust Us</h2></div></section>\n<section class="design-packages section"><div class="container"><h2 class="section-heading">Design Packages</h2></div></section>\n<section class="process-promise section"><div class="container"><h2 class="section-heading">Our Promise</h2></div></section>\n<section class="map-section section" id="map"><div class="container"><h2 class="section-heading">Service Area</h2></div></section>`;
}

function productsSection(title){
  return `\n<section id="featured-products" class="featured-products" aria-labelledby="products-heading"><div class="container"><div class="products-heading-wrap center-align"><h2 id="products-heading">${htmlEscape(title)}</h2></div><div class="product-grid"></div><div style="display:flex;justify-content:center;margin-top:2.5rem;"><button class="cart-view-btn" id="inlineCartBtn">View Cart</button></div></div></section>`;
}

function faqContact(verticalTitle){
  return `\n<section class="faq-section section" id="faq"><div class="container"><h2>Frequently Asked Questions</h2></div></section>\n<section class="contact-form-section"><div class="form-layout modern-form"><div class="form-image"><img src="/images/work/Booster-Pump And tank Installation .jpg" alt="${htmlEscape(verticalTitle)} Enquiry"></div><div class="form-content"><h2>${htmlEscape(verticalTitle)}</h2><p>Tell us what you need help with and we’ll get back to you shortly.</p><form class="contact-form" method="POST" action="https://formspree.io/f/xdkgbjre" novalidate><div class="form-group"><input type="text" name="name" placeholder=" " required><label>Full Name</label></div><div class="form-group"><input type="email" name="email" placeholder=" " required><label>Email Address</label></div><div class="form-group"><input type="tel" name="phone" placeholder=" " required><label>Phone Number</label></div><div class="form-group"><input type="text" name="address" placeholder=" " required><label>Address</label></div><div class="form-group"><textarea name="message" placeholder=" " rows="4" required></textarea><label>Project details</label></div><input type="hidden" name="page-source" value="${htmlEscape(verticalTitle)}"><button type="submit" class="cta-btn">Send Message</button></form></div></div></section>`;
}

function localAreasSection(title, links){
  const a = links.map(({href,text})=>`<a href="${href}">${htmlEscape(text)}</a>`).join('\n  ');
  return `\n<section class="local-service-areas section" id="local-areas"><div class="container"><h2 class="section-heading">${htmlEscape(title)}</h2><div class="suburb-list-grid">\n  ${a}\n</div></div></section>`;
}

function makeAreaIndex(vertical, areaSlug, suburbSlugs){
  const areaTitle = toTitleCase(areaSlug);
  const head = baseHead(`${toTitleCase(vertical)} ${areaTitle} | Myriad Green`);
  const hero = heroSection(`${vertical}-${areaSlug}-index`, areaTitle, `${toTitleCase(vertical)} Services in ${areaTitle}`, `Local ${toTitleCase(vertical)} specialists in ${areaTitle}.`);
  const icons = iconStrip([
    {icon:'fas fa-compass', text:'Site Survey'},
    {icon:'fas fa-drill', text:'Installation'},
    {icon:'fas fa-tint', text:'Filtration'},
    {icon:'fas fa-tools', text:'Service'}
  ]);
  const overview = overviewSection(`${toTitleCase(vertical)} overview`, `End-to-End ${toTitleCase(vertical)} Solutions`, ['Assessment','Install & setup','Optimisation','Maintenance']);
  const areaLinks = suburbSlugs.map(s=>({href:`/${vertical}/${areaSlug}/${s}/`, text: toTitleCase(s)}));
  const locals = localAreasSection(`${areaTitle} Suburbs We Service`, areaLinks);
  const products = productsSection(`Featured ${toTitleCase(vertical)} Products`);
  const body = [sharedBodyTop(), hero, icons, overview, aboutWeather(), '\n<section class="testimonials-section"><div class="container"><h2>What Our Clients Say</h2></div></section>', standardSections(), locals, products, faqContact(`${toTitleCase(vertical)} – ${areaTitle}`), sharedBodyBottom()].join('\n');
  return `${head}${body}`;
}

function makeAreaAllLocations(vertical, areaSlug, suburbSlugs){
  const areaTitle = toTitleCase(areaSlug);
  const head = baseHead(`All ${toTitleCase(vertical)} Service Areas in ${areaTitle}`);
  const hero = heroSection(`${vertical}-${areaSlug}-all-locations`, areaTitle, `${toTitleCase(vertical)} in ${areaTitle}`, 'Select your suburb to see local info and book.');
  const links = suburbSlugs.map(s=>`<a href="/${vertical}/${areaSlug}/${s}/">${toTitleCase(s)}</a>`).join('\n          ');
  const body = `${sharedBodyTop()}\n    ${hero}\n    <section class="map-section section">\n      <div class="container">\n        <h2 class="section-heading">${areaTitle} ${toTitleCase(vertical)} Service Areas</h2>\n        <div class="suburb-list-grid">\n          ${links}\n        </div>\n        <p style="margin-top:1rem;"><a href="/${vertical}/${areaSlug}/">Back to ${areaTitle} hub</a></p>\n      </div>\n    </section>\n  ${sharedBodyBottom()}`;
  return `${head}${body}`;
}

function makeSuburbPage(vertical, areaSlug, suburbSlug){
  const areaTitle = toTitleCase(areaSlug);
  const suburbTitle = toTitleCase(suburbSlug);
  const head = baseHead(`${toTitleCase(vertical)} ${suburbTitle} ${areaTitle} | Myriad Green`);
  const hero = heroSection(`${vertical}-${areaSlug}-${suburbSlug}`, `${areaTitle}`, `${toTitleCase(vertical)} in ${suburbTitle}, ${areaTitle}`, `Local ${toTitleCase(vertical)} experts serving ${suburbTitle}.`);
  const icons = iconStrip([
    {icon:'fas fa-award', text:'Experienced'},
    {icon:'fas fa-tachometer-alt', text:'Reliable'},
    {icon:'fas fa-leaf', text:'Eco-Friendly'},
    {icon:'fas fa-tools', text:'Repairs'}
  ]);
  const overview = overviewSection(`${toTitleCase(vertical)} overview`, `Complete ${toTitleCase(vertical)} Solutions for ${suburbTitle}`, ['Assessment','Install & setup','Optimisation','Maintenance']);
  const back = `\n<p style="margin:1rem 0 0.5rem 1rem;"><a href="/${vertical}/${areaSlug}/">\u2190 Back to ${areaTitle} hub</a></p>`;
  // Local services links pointing to keyword pages
  const keywordLinks = [
    { href: `/${vertical}/${areaSlug}/${suburbSlug}/${vertical}-installation/`, text: `${toTitleCase(vertical)} Installation – ${suburbTitle}` },
    { href: `/${vertical}/${areaSlug}/${suburbSlug}/${vertical}-maintenance/`, text: `Maintenance Plans – ${suburbTitle}` },
    { href: `/${vertical}/${areaSlug}/${suburbSlug}/${vertical}-repairs/`, text: `${toTitleCase(vertical)} Repairs – ${suburbTitle}` },
    { href: `/${vertical}/${areaSlug}/${suburbSlug}/${vertical}-products/`, text: `${toTitleCase(vertical)} Products – ${suburbTitle}` },
  ];
  const locals = localAreasSection(`Local ${toTitleCase(vertical)} Services in ${suburbTitle}`, keywordLinks);
  const products = productsSection(`Featured ${toTitleCase(vertical)} Products`);
  const body = [sharedBodyTop(), hero, icons, overview, aboutWeather(), '\n<section class="testimonials-section"><div class="container"><h2>What Our Clients Say</h2></div></section>', standardSections(), locals, products, faqContact(`${toTitleCase(vertical)} – ${suburbTitle}`), back, sharedBodyBottom()].join('\n');
  return `${head}${body}`;
}

// Create keyword pages per suburb (installation, maintenance, repairs, products)
const DEFAULT_KEYWORD_KINDS = [
  { slug: 'installation', title: 'Installation' },
  { slug: 'maintenance', title: 'Maintenance' },
  { slug: 'repairs', title: 'Repairs' },
  { slug: 'products', title: 'Products' },
];

function keywordPage(vertical, areaSlug, suburbSlug, kind){
  const areaTitle = toTitleCase(areaSlug);
  const suburbTitle = toTitleCase(suburbSlug);
  const kindTitle = kind.title;
  const pageKey = `${vertical}-${areaSlug}-${suburbSlug}-${kind.slug}`;
  const head = baseHead(`${toTitleCase(vertical)} ${kindTitle} in ${suburbTitle}, ${areaTitle} | Myriad Green`);
  const hero = heroSection(pageKey, `${areaTitle}`, `${kindTitle} – ${toTitleCase(vertical)} in ${suburbTitle}`, `Local ${toTitleCase(vertical)} ${kindTitle.toLowerCase()} for ${suburbTitle}.`);
  const icons = iconStrip([
    {icon:'fas fa-award', text:'Experienced'},
    {icon:'fas fa-tachometer-alt', text:'Reliable'},
    {icon:'fas fa-leaf', text:'Eco-Friendly'},
    {icon:'fas fa-tools', text: kindTitle }
  ]);
  const overview = overviewSection(`${toTitleCase(vertical)} ${kindTitle}`, `${kindTitle} Services`, ['Assessment','Install & setup','Optimisation','Maintenance']);
  const backLinks = `\n<p style="margin:1rem 0 0.5rem 1rem;">\n  <a href="/${vertical}/${areaSlug}/${suburbSlug}/">← Back to ${suburbTitle}</a> |\n  <a href="/${vertical}/${areaSlug}/">${areaTitle} hub</a>\n</p>`;
  const products = productsSection(`Featured ${toTitleCase(vertical)} Products`);
  const body = [sharedBodyTop(), hero, icons, overview, aboutWeather(), '\n<section class="testimonials-section"><div class="container"><h2>What Our Clients Say</h2></div></section>', standardSections(), products, faqContact(`${toTitleCase(vertical)} – ${kindTitle}`), backLinks, sharedBodyBottom()].join('\n');
  return `${head}${body}`;
}

function isDir(p){ try { return fs.statSync(p).isDirectory(); } catch { return false; } }

function getIrrigationAreas(){
  const exclude = new Set(['products', 'sprinkler-repair', 'drip-irrigation-systems']);
  const entries = fs.readdirSync(IRRIGATION_DIR, { withFileTypes: true });
  return entries.filter(e=>e.isDirectory() && !exclude.has(e.name)).map(e=>e.name);
}

function getSuburbsForArea(area){
  const p = path.join(IRRIGATION_DIR, area);
  const entries = fs.readdirSync(p, { withFileTypes: true });
  return entries.filter(e=>e.isDirectory()).map(e=>e.name);
}

const targetRoot = path.join(ROOT, targetVertical);
ensureDir(targetRoot);

const areas = getIrrigationAreas();
let created = 0;

for (const area of areas){
  const areaDir = path.join(targetRoot, area);
  ensureDir(areaDir);
  // Gather suburb slugs
  const suburbSlugs = getSuburbsForArea(area);

  // Area index
  const areaIndexPath = path.join(areaDir, 'index.html');
  created += writeFileIfMissing(areaIndexPath, makeAreaIndex(targetVertical, area, suburbSlugs)) ? 1 : 0;

  // Area all-locations
  const allLocPath = path.join(areaDir, 'all-locations.html');
  created += writeFileIfMissing(allLocPath, makeAreaAllLocations(targetVertical, area, suburbSlugs)) ? 1 : 0;

  // Suburbs
  for (const suburb of suburbSlugs){
    const suburbDir = path.join(areaDir, suburb);
    ensureDir(suburbDir);
    const suburbIndexPath = path.join(suburbDir, 'index.html');
    created += writeFileIfMissing(suburbIndexPath, makeSuburbPage(targetVertical, area, suburb)) ? 1 : 0;
    // Keyword pages
    for (const kind of DEFAULT_KEYWORD_KINDS){
      const fileSlug = `${targetVertical}-${kind.slug}.html`;
      const filePath = path.join(suburbDir, fileSlug);
      created += writeFileIfMissing(filePath, keywordPage(targetVertical, area, suburb, kind)) ? 1 : 0;
    }
  }
}

console.log(`Done. Created ${created} files for vertical: ${targetVertical}${DRY_RUN ? ' (dry-run)' : ''}.`);
