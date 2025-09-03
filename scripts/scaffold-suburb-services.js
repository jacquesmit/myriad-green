#!/usr/bin/env node
/**
 * Generate service-specific pages for each suburb under an area.
 * Usage (PowerShell):
 *   node scripts/scaffold-suburb-services.js --area Pretoria [--domain https://www.myriadgreen.co.za]
 */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const [k, v] = t.includes('=') ? t.slice(2).split('=') : [t.slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true];
    args[k] = v;
  }
  return args;
}

function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function titleCase(input) {
  return String(input)
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(s => s[0].toUpperCase() + s.slice(1))
    .join(' ');
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function buildPage({ area, suburb, domain, type }) {
  const areaTitle = titleCase(area);
  const suburbTitle = titleCase(suburb);
  const baseUrl = `${domain}/irrigation/${slugify(area)}/${slugify(suburb)}`;
  const pages = {
    'sprinkler-repair': {
      title: `Sprinkler Repair ${suburbTitle} ${areaTitle} | Fix Leaks, Nozzles, Valves`,
      desc: `Fast sprinkler repair in ${suburbTitle}, ${areaTitle}: leaking pipes, broken heads, clogged nozzles, faulty valves, controller issues. Book a local irrigation technician.`,
      h1: `Sprinkler Repair in ${suburbTitle}, ${areaTitle}`,
      cta: 'Book a Repair',
      path: 'sprinkler-repair.html',
      body: `
    <section class="features section">
      <div class="container">
        <h2 class="section-heading">Common Issues We Fix</h2>
        <div class="grid">
          <div class="feature-card"><i class="fas fa-tint"></i><h3>Leaks & Bursts</h3><p>Repair lateral/mainline leaks and broken fittings.</p></div>
          <div class="feature-card"><i class="fas fa-spray-can"></i><h3>Heads & Nozzles</h3><p>Replace clogged, broken, or misaligned heads.</p></div>
          <div class="feature-card"><i class="fas fa-project-diagram"></i><h3>Valves & Wiring</h3><p>Fix stuck valves, solenoids, and shorts.</p></div>
          <div class="feature-card"><i class="fas fa-microchip"></i><h3>Controllers</h3><p>Troubleshoot timers, Wi‑Fi, and schedules.</p></div>
        </div>
      </div>
    </section>

    <section class="faq-section section"><div class="container"><h2 class="section-heading">Repair FAQ</h2><div class="faq-item"><button class="faq-question"><span>How soon can you come out?</span><i class="faq-toggle-icon fas fa-plus"></i></button><div class="faq-answer"><p>In most cases, within 24–48 hours in ${suburbTitle}.</p></div></div><div class="faq-item"><button class="faq-question"><span>Do you stock parts?</span><i class="faq-toggle-icon fas fa-plus"></i></button><div class="faq-answer"><p>Yes, we carry common heads, valves, and fittings.</p></div></div></div></section>

    <section class="contact-form-section"><div class="form-layout modern-form"><div class="form-image"><img src="/images/work/Irrigation Repairs.png" alt="Sprinkler Repair ${suburbTitle}"></div><div class="form-content"><h2>Book a Repair – ${suburbTitle}</h2><p>Describe the problem and we’ll schedule a technician.</p><form class="contact-form" method="POST" action="https://formspree.io/f/xdkgbjre" novalidate><div class="form-group"><input type="text" name="name" placeholder=" " required><label>Full Name</label></div><div class="form-group"><input type="email" name="email" placeholder=" " required><label>Email Address</label></div><div class="form-group"><input type="tel" name="phone" placeholder=" " required><label>Phone Number</label></div><div class="form-group"><input type="text" name="address" placeholder=" " required><label>Address</label></div><div class="form-group"><textarea name="message" placeholder=" " rows="4" required></textarea><label>Issue details</label></div><input type="hidden" name="page-source" value="Sprinkler Repair – ${suburbTitle}, ${areaTitle}"><button type="submit" class="cta-btn">Request Repair</button></form></div></div></section>
      `
    },
    'irrigation-installation': {
      title: `Irrigation Installation ${suburbTitle} ${areaTitle} | Smart Systems & Design`,
      desc: `Professional irrigation installation in ${suburbTitle}, ${areaTitle}. Smart Wi‑Fi controllers, drip & spray zones, filtration, and pressure control. Free consultation.`,
      h1: `Irrigation Installation – ${suburbTitle}`,
      cta: 'Get a Quote',
      path: 'irrigation-installation.html',
      body: `
    <section class="features section"><div class="container"><h2 class="section-heading">What’s Included</h2><div class="grid"><div class="feature-card"><i class="fas fa-drafting-compass"></i><h3>Site Assessment</h3><p>Pressure, flow, and zone planning.</p></div><div class="feature-card"><i class="fas fa-ruler-combined"></i><h3>Custom Design</h3><p>Tailored to beds, lawns, and planters.</p></div><div class="feature-card"><i class="fas fa-water"></i><h3>Filtration & PRV</h3><p>Protect components and ensure even flow.</p></div><div class="feature-card"><i class="fas fa-wifi"></i><h3>Smart Controller</h3><p>App scheduling and weather syncing.</p></div></div></div></section>
    <section class="faq-section section"><div class="container"><h2 class="section-heading">Installation FAQ</h2><div class="faq-item"><button class="faq-question"><span>How long does it take?</span><i class="faq-toggle-icon fas fa-plus"></i></button><div class="faq-answer"><p>Most homes: 1–2 days. Larger systems: 2–3 days.</p></div></div><div class="faq-item"><button class="faq-question"><span>What brands do you use?</span><i class="faq-toggle-icon fas fa-plus"></i></button><div class="faq-answer"><p>Rain Bird, Hunter, Irritrol, Orbit, and Netafim.</p></div></div></div></section>
    <section class="contact-form-section"><div class="form-layout modern-form"><div class="form-image"><img src="/images/work/Irrigation Repairs.png" alt="Irrigation Installation ${suburbTitle}"></div><div class="form-content"><h2>Book an Installation – ${suburbTitle}</h2><p>Tell us about your garden and goals.</p><form class="contact-form" method="POST" action="https://formspree.io/f/xdkgbjre" novalidate><div class="form-group"><input type="text" name="name" placeholder=" " required><label>Full Name</label></div><div class="form-group"><input type="email" name="email" placeholder=" " required><label>Email Address</label></div><div class="form-group"><input type="tel" name="phone" placeholder=" " required><label>Phone Number</label></div><div class="form-group"><input type="text" name="address" placeholder=" " required><label>Address</label></div><div class="form-group"><textarea name="message" placeholder=" " rows="4" required></textarea><label>Your garden details</label></div><input type="hidden" name="page-source" value="Irrigation Installation – ${suburbTitle}, ${areaTitle}"><button type="submit" class="cta-btn">Request Quote</button></form></div></div></section>
      `
    },
    'irrigation-maintenance': {
      title: `Irrigation Maintenance ${suburbTitle} ${areaTitle} | Monthly Care Plans`,
      desc: `Irrigation maintenance in ${suburbTitle}, ${areaTitle}. Monthly care plans with seasonal tuning, leak checks, nozzle cleaning, and priority support.`,
      h1: `Irrigation Maintenance – ${suburbTitle}`,
      cta: 'Start a Plan',
      path: 'irrigation-maintenance.html',
      body: `
    <section class="monthly-pricing section alt-bg"><div class="container"><h2 class="section-heading">Monthly Care Plans</h2><div class="pricing-cards"><div class="pricing-card"><h3 class="plan-title">Care Basic</h3><p class="plan-price">R350 <span>/ month</span></p><ul class="plan-features"><li>Monthly check</li><li>Nozzle cleaning</li><li>Minor repairs</li><li>Priority support</li></ul><button class="btn book-now-button">Start Basic</button></div><div class="pricing-card highlighted"><h3 class="plan-title">Care Plus</h3><p class="plan-price">R750 <span>/ month</span></p><ul class="plan-features"><li>Includes Basic</li><li>Seasonal tuning</li><li>Smart reprogramming</li><li>Leak inspection</li></ul><button class="btn book-now-button">Start Plus</button></div><div class="pricing-card"><h3 class="plan-title">Care Pro</h3><p class="plan-price">R1,250 <span>/ month</span></p><ul class="plan-features"><li>All Plus features</li><li>Emergency callouts</li><li>Component cover</li><li>Usage reports</li></ul><button class="btn book-now-button">Start Pro</button></div></div></div></section>
    <section class="faq-section section"><div class="container"><h2 class="section-heading">Maintenance FAQ</h2><div class="faq-item"><button class="faq-question"><span>Can I cancel anytime?</span><i class="faq-toggle-icon fas fa-plus"></i></button><div class="faq-answer"><p>Yes, monthly plans are flexible.</p></div></div><div class="faq-item"><button class="faq-question"><span>Do you service estates?</span><i class="faq-toggle-icon fas fa-plus"></i></button><div class="faq-answer"><p>Yes, complexes and estates included.</p></div></div></div></section>
    <section class="contact-form-section"><div class="form-layout modern-form"><div class="form-image"><img src="/images/work/Irrigation Repairs.png" alt="Irrigation Maintenance ${suburbTitle}"></div><div class="form-content"><h2>Start Maintenance – ${suburbTitle}</h2><p>Tell us your system type and preferred schedule.</p><form class="contact-form" method="POST" action="https://formspree.io/f/xdkgbjre" novalidate><div class="form-group"><input type="text" name="name" placeholder=" " required><label>Full Name</label></div><div class="form-group"><input type="email" name="email" placeholder=" " required><label>Email Address</label></div><div class="form-group"><input type="tel" name="phone" placeholder=" " required><label>Phone Number</label></div><div class="form-group"><input type="text" name="address" placeholder=" " required><label>Address</label></div><div class="form-group"><textarea name="message" placeholder=" " rows="4" required></textarea><label>System details</label></div><input type="hidden" name="page-source" value="Irrigation Maintenance – ${suburbTitle}, ${areaTitle}"><button type="submit" class="cta-btn">Start Plan</button></form></div></div></section>
      `
    },
    'irrigation-products': {
      title: `Irrigation Products ${suburbTitle} ${areaTitle} | Sprinklers, Controllers, Valves`,
      desc: `Buy irrigation products in ${suburbTitle}, ${areaTitle}. Rain Bird sprinklers, smart controllers, valves, and pipes. Add to cart and checkout online.`,
      h1: `Irrigation Products – ${suburbTitle}`,
      cta: 'View Cart',
      path: 'irrigation-products.html',
      body: `
  <section id="featured-irrigation-products" class="featured-products section" data-product-count="${getHubProductCount()}"><div class="container"><div class="products-heading-wrap center-align"><h2>Products for ${suburbTitle}</h2></div><div class="product-grid">
      <article class="product-card"><img src="/images/mrg products/removed back ground/5004_rainbird_sprinkler.png" alt="Rain Bird 5004 Sprinkler"><h3>Rain Bird 5004 Sprinkler</h3><p class="price">R280.00</p><p class="description" style="display:none;">Professional pop‑up sprinkler.</p><button class="add-to-cart-btn" data-id="101" data-name="Rain Bird 5004 Sprinkler" data-price="280">Add to Cart</button></article>
      <article class="product-card"><img src="/images/mrg products/removed back ground/Tm2_Rain_Bird_Wi-fi_Controller-removebg-preview.png" alt="Rain Bird TM2 Controller"><h3>Rain Bird TM2 Controller (6 station)</h3><p class="price">R2,999.00</p><p class="description" style="display:none;">Smart controller with app control.</p><button class="add-to-cart-btn" data-id="102" data-name="Rain Bird TM2 Controller (6 station)" data-price="2999">Add to Cart</button></article>
      <article class="product-card"><img src="/images/mrg products/removed back ground/rainbird_valve.png" alt="Rain Bird Irrigation Valve"><h3>Rain Bird Irrigation Valve</h3><p class="price">R290.00</p><p class="description" style="display:none;">24V irrigation valve.</p><button class="add-to-cart-btn" data-id="103" data-name="Rain Bird Irrigation Valve" data-price="290">Add to Cart</button></article>
      <article class="product-card"><img src="/images/mrg products/removed back ground/ldp_25mm_pipe.png" alt="100m LDP 25mm Irrigation Pipe"><h3>100m LDP 25mm Irrigation Pipe</h3><p class="price">R380.00</p><p class="description" style="display:none;">LDP pipe roll.</p><button class="add-to-cart-btn" data-id="104" data-name="100m LDP 25mm Irrigation Pipe" data-price="380">Add to Cart</button></article>
  </div><div style="display:flex;justify-content:center;margin-top:2.5rem;"><button class="cart-view-btn" id="inlineCartBtn">View Cart</button></div></div></section>
      `
    }
  };

  const cfg = pages[type];
  const canonical = `${baseUrl}/${cfg.path}`;
  const head = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cfg.title}</title>
  <meta name="description" content="${cfg.desc}">
  <link rel="canonical" href="${canonical}" />
  <meta name="keywords" content="Irrigation ${suburbTitle} ${areaTitle}, ${cfg.h1}, ${suburbTitle} ${areaTitle} irrigation">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <link rel="stylesheet" href="/css/reset.css" />
  <link rel="stylesheet" href="/css/theme.css" />
  <link rel="stylesheet" href="/css/utilities.css" />
  <link rel="stylesheet" href="/css/main.css" />
  <link rel="stylesheet" href="/css/servicesection.css" />
  <link rel="stylesheet" href="/css/booking-modal.css" />
  <link rel="stylesheet" href="/css/services/irrigation-sections.css" />
  <link rel="stylesheet" href="/css/faq-section.css" />
  <link rel="stylesheet" href="/css/components/buttons/book-now-button.css" />
  <link rel="stylesheet" href="/css/components/buttons/floating-contact-bar.css" />
  <link rel="stylesheet" href="/css/floating-bar-reopen-btn.css" />
  <link rel="stylesheet" href="/css/main-navigation.css" />
  <link rel="stylesheet" href="/css/mobile-nav.css" />
  <link rel="stylesheet" href="/css/footer.css" />
  <link rel="stylesheet" href="/css/navbar.css" />
  <link rel="stylesheet" href="/css/theme-toggle.css" />
  <link rel="stylesheet" href="/css/components/buttons/social-bar.css" />
  <link rel="stylesheet" href="/css/contact-us-form.css">
  <link rel="stylesheet" href="/css/layout.css" />
  <link rel="stylesheet" href="/css/cart-modal.css" />
  <link rel="stylesheet" href="/css/checkout.css" />
  <link rel="stylesheet" href="/css/shop-section.css" />
</head>
<body>
  <div id="site-social-bar"></div>
  <div id="site-nav"></div>
  <main>
  <section class="hero-irrigation"><div class="hero-grid"><div class="hero-text"><h1 id="page-h1" data-page-key="${slugify(area)}-${slugify(suburb)}-${type}" data-city="${areaTitle}" data-suburb="${suburbTitle}" data-hero-title>${cfg.h1}</h1><p data-hero-intro>${cfg.desc}</p><button class="btn book-now-button" id="hero-book-service">${cfg.cta}</button></div></div></section>
`;
  const tail = `
    <section class="section" style="padding-top:0.5rem">
      <div class="container"><p><a href="/irrigation/${slugify(area)}/${slugify(suburb)}/">← Back to ${suburbTitle} hub</a></p></div>
    </section>
    <button class="scroll-to-top" aria-label="Scroll to top"><i class="fas fa-arrow-up"></i></button>
    <button id="openCartBtn" class="floating-cart-btn" aria-label="View cart"><i class="fas fa-shopping-cart"></i><span class="cart-badge" id="cartCount">0</span></button>
    <div id="cartModal" class="cart-modal hidden"><div class="cart-modal-content"><button id="closeCartBtn" class="close-btn" aria-label="Close cart">&times;</button><h2>Your Cart</h2><ul id="cartItemsList" class="cart-items-list"></ul><p class="total">Total: R<span id="cartTotal">0.00</span></p><div class="checkout-actions"></div></div></div>
  </main>
  <footer id="site-footer" aria-label="Site footer"></footer>
  <div id="booking-modal-container"></div>
  <script src="/js/booking-modal-loader.js" defer></script>
  <script src="/js/cart-modal.js" defer></script>
  <script src="/js/checkout.js" defer></script>
  <script src="/js/site-init.js" defer></script>
  <script src="/js/h1-injector.js" defer></script>
  <script src="/js/weather-signal.js" defer></script>
  <script src="/js/related-products.js" defer></script>
</body>
</html>`;
  return head + cfg.body + tail;
}

function main() {
  const args = parseArgs(process.argv);
  const areaArg = args.area || args.a;
  if (!areaArg) {
    console.error('Error: --area is required');
    process.exit(1);
  }
  const ROOT = process.cwd();
  const areaDir = path.join(ROOT, 'irrigation', slugify(areaArg));
  const domain = args.domain || 'https://www.myriadgreen.co.za';
  if (!fs.existsSync(areaDir)) {
    console.error(`Area directory not found: ${areaDir}`);
    process.exit(1);
  }
  const entries = fs.readdirSync(areaDir, { withFileTypes: true });
  const suburbDirs = entries.filter(d => d.isDirectory());
  let created = 0;
  for (const d of suburbDirs) {
    const suburb = titleCase(d.name.replace(/-/g, ' '));
    const suburbPath = path.join(areaDir, d.name);
    for (const type of ['sprinkler-repair', 'irrigation-installation', 'irrigation-maintenance', 'irrigation-products']) {
      const filePath = path.join(suburbPath, `${type}.html`);
      const ok = writeIfMissing(filePath, buildPage({ area: areaArg, suburb, domain, type }));
      if (ok) {
        console.log('Created', filePath);
        created++;
      }
    }
  }
  console.log(`Done. Created ${created} files under ${areaDir}.`);
}

main();

function getHubProductCount() {
  try {
    const ROOT = process.cwd();
    const hubPath = path.join(ROOT, 'irrigation', 'index.html');
    if (!fs.existsSync(hubPath)) return 4;
    const html = fs.readFileSync(hubPath, 'utf8');
    const sectionMatch = html.match(/<section[^>]*id=["']featured-irrigation-products["'][^>]*>[\s\S]*?<\/section>/i);
    if (!sectionMatch) return 4;
    const grid = sectionMatch[0].match(/<div[^>]*class=["'][^"']*product-grid[^"']*["'][^>]*>[\s\S]*?<\/div>/i);
    if (!grid) return 4;
    const count = (grid[0].match(/<article\s+class=["']product-card["']/gi) || []).length;
    return count || 4;
  } catch { return 4; }
}
