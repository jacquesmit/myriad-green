#!/usr/bin/env node
/**
 * Scaffold a new irrigation page from the template.
 * Usage examples (PowerShell):
 *   npm run scaffold:irrigation -- --area Sandton --suburb Fourways
 *   npm run scaffold:irrigation -- --area Pretoria --suburb "Moreleta Park" --title "Irrigation Moreleta Park | Myriad Green"
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TEMPLATE_PATH = path.resolve(ROOT, 'service-templet', 'irrigation-page-template.html');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');
      if (eqIdx !== -1) {
        const key = token.slice(2, eqIdx);
        const val = token.slice(eqIdx + 1);
        args[key] = val;
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
          args[key] = true;
        } else {
          args[key] = next;
          i++;
        }
      }
    }
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
    .split(/\s|-/)
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function replaceTokens(template, tokens) {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    const re = new RegExp(`{{${k}}}`, 'g');
    out = out.replace(re, v);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const areaArg = args.area || args.a;
  const suburbArg = args.suburb || args.s;

  if (!areaArg) {
    console.error('Error: --area is required');
    process.exit(1);
  }

  const domain = args.domain || 'https://www.myriadgreen.co.za';
  const areaSlug = slugify(areaArg);
  const suburbSlug = suburbArg ? slugify(suburbArg) : '';

  const areaTitle = titleCase(areaArg);
  const suburbTitle = suburbArg ? titleCase(suburbArg) : '';

  // Build path under /irrigation/{area}/[suburb]/index.html
  const baseDir = suburbSlug
    ? path.join(ROOT, 'irrigation', areaSlug, suburbSlug)
    : path.join(ROOT, 'irrigation', areaSlug);

  const urlPath = suburbSlug
    ? `/irrigation/${areaSlug}/${suburbSlug}/`
    : `/irrigation/${areaSlug}/`;

  const pageTitle = args.title || (
    suburbSlug
      ? `Irrigation ${suburbTitle}, ${areaTitle} | Myriad Green`
      : `Irrigation ${areaTitle} | Myriad Green`
  );

  const heroTitle = args.hero || (
    suburbSlug
      ? `Irrigation in ${suburbTitle}, ${areaTitle}`
      : `Irrigation in ${areaTitle}`
  );

  const heroIntro = args.intro || (
    suburbSlug
      ? `Professional irrigation installation, upgrades, and repairs in ${suburbTitle}, ${areaTitle}. Smart, water-wise systems for homes, estates, and businesses.`
      : `Professional irrigation installation, upgrades, and repairs in ${areaTitle}. Smart, water-wise systems for homes, estates, and businesses.`
  );

  const metaDesc = args.desc || (
    suburbSlug
      ? `Expert irrigation services in ${suburbTitle}, ${areaTitle}. Smart irrigation systems, repairs, and water-saving solutions for homes, estates, and businesses.`
      : `Expert irrigation services in ${areaTitle}. Smart irrigation systems, repairs, and water-saving solutions for homes, estates, and businesses.`
  );

  const keywords = args.keywords || (
    suburbSlug
      ? `Irrigation ${suburbTitle}, Irrigation ${areaTitle}, Smart Irrigation, Irrigation Systems, Irrigation Repairs, Water Management ${areaTitle}`
      : `Irrigation ${areaTitle}, Smart Irrigation, Irrigation Systems, Irrigation Repairs, Water Management ${areaTitle}`
  );

  const canonical = args.canonical || `${domain}${urlPath}`;
  const weatherSuburb = args.suburbWeather || (suburbTitle || areaTitle);
  const regionName = args.region || (suburbSlug ? `${suburbTitle} – ${areaTitle}` : areaTitle);
  const pageSource = args.source || (
    suburbSlug ? `Irrigation - ${suburbTitle}, ${areaTitle} Page` : `Irrigation - ${areaTitle} Page`
  );
  const pageKey = args.pageKey || (suburbSlug ? `irrigation-${areaSlug}-${suburbSlug}` : `irrigation-${areaSlug}`);

  // Build local services links when on a suburb page. Provide area-level links otherwise.
  const localLinks = suburbSlug
    ? [
        `<a href="/irrigation/${areaSlug}/${suburbSlug}/sprinkler-repair.html">Sprinkler Repair – ${suburbTitle}</a>`,
        `<a href="/irrigation/${areaSlug}/${suburbSlug}/irrigation-installation.html">Irrigation Installation – ${suburbTitle}</a>`,
        `<a href="/irrigation/${areaSlug}/${suburbSlug}/irrigation-maintenance.html">Maintenance Plans – ${suburbTitle}</a>`,
        `<a href="/irrigation/${areaSlug}/${suburbSlug}/irrigation-products.html">Irrigation Products – ${suburbTitle}</a>`,
        `<a href="/irrigation/${areaSlug}/">Back to ${areaTitle}</a>`
      ].join('\n          ')
    : `<a href="/irrigation/">Irrigation Hub</a>`;

  // Load template
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const tokens = {
    PAGE_TITLE: pageTitle,
    META_DESCRIPTION: metaDesc,
    CANONICAL_URL: canonical,
    META_KEYWORDS: keywords,
    HERO_TITLE: heroTitle,
    HERO_INTRO: heroIntro,
    WEATHER_SUBURB: weatherSuburb,
    REGION_NAME: regionName,
  PAGE_SOURCE: pageSource,
  LOCAL_SERVICES_LINKS: localLinks,
  OVERVIEW_IMAGE_URL: args.overviewImageUrl || '/images/mrg products/removed back ground/esp-me_3stn-module_wide_00134_1-removebg-preview.png',
  OVERVIEW_IMAGE_ALT: args.overviewImageAlt || 'Smart Irrigation Controller',
  PRODUCTS_HEADING: args.productsHeading || 'Featured Irrigation Products',
  PRODUCT_GRID_ITEMS: buildProductGridItems(args.productsFile),
  PRODUCTS_COUNT: String(getHubProductCount()),
  PAGE_KEY: pageKey,
  CITY_NAME: areaTitle,
  SUBURB_NAME: suburbTitle
  };

  const output = replaceTokens(tpl, tokens);

  ensureDir(baseDir);
  const outPath = path.join(baseDir, 'index.html');
  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`Created: ${outPath}`);
  console.log(`Canonical: ${canonical}`);
}

function buildProductGridItems(productsFileArg) {
  const ROOT = process.cwd();
  let items = [];
  if (productsFileArg) {
    try {
      const p = path.resolve(ROOT, productsFileArg);
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(json)) items = json;
      if (json && Array.isArray(json.items)) items = json.items;
    } catch (e) {
      console.warn('Warning: failed to read productsFile, using defaults:', e.message);
    }
  }
  if (!items.length) {
    items = [
      { id: '101', img: '/images/mrg products/removed back ground/5004_rainbird_sprinkler.png', alt: 'Rain Bird 5004 Sprinkler', title: 'Rain Bird 5004 Sprinkler', price: 'R280.00', desc: 'Professional pop‑up sprinkler for even coverage.' },
      { id: '102', img: '/images/mrg products/removed back ground/Tm2_Rain_Bird_Wi-fi_Controller-removebg-preview.png', alt: 'Rain Bird TM2 Controller', title: 'Rain Bird TM2 Controller (6 station)', price: 'R2,999.00', desc: 'Smart controller with app control and weather sync.' },
      { id: '103', img: '/images/mrg products/removed back ground/rainbird_valve.png', alt: 'Rain Bird Irrigation Valve', title: 'Rain Bird Irrigation Valve', price: 'R290.00', desc: 'Reliable 24V valve for automated zone control.' },
      { id: '104', img: '/images/mrg products/removed back ground/ldp_25mm_pipe.png', alt: '100m LDP 25mm Irrigation Pipe', title: '100m LDP 25mm Irrigation Pipe', price: 'R380.00', desc: 'Quality LDP pipe for mainline and laterals.' }
    ];
  }
  return items.map(it => (
    `          <article class="product-card">\n` +
    `            <img src="${it.img}" alt="${it.alt}">\n` +
    `            <h3>${it.title}</h3>\n` +
    `            <p class="price">${it.price}</p>\n` +
    `            <p class="description" style="display: none;">${it.desc}</p>\n` +
    `            <button class="add-to-cart-btn" data-id="${it.id}" data-name="${it.title}" data-price="${(it.price||'').replace(/[^0-9.]/g,'')}">Add to Cart</button>\n` +
    `          </article>`
  )).join('\n');
}

function getHubProductCount() {
  try {
    const hubPath = path.resolve(ROOT, 'irrigation', 'index.html');
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

main();
