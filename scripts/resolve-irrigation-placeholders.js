#!/usr/bin/env node
/**
 * resolve-irrigation-placeholders.js
 * Replaces canonical template tokens in injected irrigation sections with
 * real values inferred from file paths and directory structure.
 * Also ensures H1 data attributes are present and coherent.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IRRIGATION_DIR = path.join(ROOT, 'irrigation');

function walk(dir, acc=[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '_preview') continue;
      walk(p, acc);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      acc.push(p);
    }
  }
  return acc;
}

function titleCase(s){
  return s.replace(/[-_]/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

const KNOWN_AREAS = new Set(['sandton','pretoria','johannesburg','east-rand','midrand','centurion']);

function deriveContext(file){
  const rel = path.relative(ROOT, file).replace(/\\/g,'/');
  const parts = rel.split('/');
  const i = parts.indexOf('irrigation');
  let area = null, suburb = null;
  if (i >= 0){
    const a = parts[i+1];
    if (a && a !== 'index.html' && a.indexOf('.') === -1) {
      if (KNOWN_AREAS.has(a)) {
        area = a;
        const s = parts[i+2];
        if (s && s !== 'index.html' && s.indexOf('.') === -1) suburb = s;
      } else {
        // Not a direct known area folder; handle hyphenated prefixes like "pretoria-west"
        // If prefix is a known area, treat the remainder as a pseudo-suburb under that area.
        const segs = a.split('-');
        if (segs.length > 1 && KNOWN_AREAS.has(segs[0])) {
          area = segs[0];
          // Use full label for suburb like "Pretoria West" (city + remainder)
          suburb = segs.slice(1).join('-');
          // Mark that this page is effectively a suburb-level page rooted under the detected area
        } else {
          // Keyword page directly under irrigation
          area = null;
        }
      }
    }
  }
  const region = area ? titleCase(area) : 'Gauteng';
  const city = region; // treat area as city label
  // For hyphenated area style (e.g., pretoria-west), suburb should be "Pretoria West"
  let suburbName = '';
  if (suburb) {
    // If the top-level folder was a hyphenated area, include the city in the suburb display for clarity.
    // Detect by checking that the folder at parts[i+1] isn't exactly the resolved area.
    const rawAreaDir = parts[i+1];
    if (rawAreaDir && rawAreaDir !== area && rawAreaDir.startsWith(area + '-')) {
      suburbName = `${titleCase(area)} ${titleCase(suburb)}`;
    } else {
      suburbName = titleCase(suburb);
    }
  }

  // Page key like irrigation-area-suburb or keyword
  const segs = parts.slice(i).filter(s=>s && s!== 'index.html');
  const pageKey = segs.join('-');

  // URL path for canonical-ish refs
  let urlPath = '/' + parts.slice(i).join('/');
  if (urlPath.endsWith('index.html')) urlPath = urlPath.slice(0, -'index.html'.length);
  if (!urlPath.endsWith('/')) urlPath += '/';

  return { rel, area, suburb, region, city, suburbName, pageKey, urlPath };
}

function generateLocalLinks(ctx){
  try {
    let baseDir;
    if (ctx.area && ctx.suburb){
      baseDir = path.join(IRRIGATION_DIR, ctx.area);
    } else if (ctx.area && !ctx.suburb){
      baseDir = path.join(IRRIGATION_DIR, ctx.area);
    } else {
      // keyword/root: aggregate top areas
      const links = Array.from(KNOWN_AREAS).map(a=>`<a class="suburb-link" href="/irrigation/${a}/">${titleCase(a)}</a>`);
      return links.join('\n');
    }
    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(n => n && !n.startsWith('_'));
    // If we're at area index, link suburbs; if at suburb page, link siblings
    const links = entries.map(n => `<a class="suburb-link" href="/irrigation/${ctx.area}/${n}/">${titleCase(n)}</a>`);
    return links.join('\n');
  } catch {
    return '';
  }
}

function ensureH1DataAttrs(html, ctx){
  // add/replace data attributes on the H1#page-h1 if present
  return html.replace(/<h1([^>]*id=["']page-h1["'][^>]*)>([\s\S]*?)<\/h1>/i, (m, attrs, inner)=>{
    // ensure data-page-key, data-city, data-suburb
    let a = attrs;
    const setAttr = (name, val) => {
      const re = new RegExp(name+"=\\\"[^\\\"]*\\\"|"+name+"='[^']*'", 'i');
      if (re.test(a)) a = a.replace(re, `${name}="${val}"`);
      else a += ` ${name}="${val}"`;
    };
    setAttr('data-page-key', ctx.pageKey);
    setAttr('data-city', ctx.city);
    setAttr('data-suburb', ctx.suburbName || ctx.region);
    return `<h1${a}>${inner}</h1>`;
  });
}

function replaceTokens(html, ctx){
  const replacements = new Map([
    ['{{REGION_NAME}}', ctx.region],
    ['{{CITY_NAME}}', ctx.city],
    ['{{SUBURB_NAME}}', ctx.suburbName],
    ['{{WEATHER_SUBURB}}', ctx.suburbName || ctx.region],
    ['{{PRODUCTS_HEADING}}', ctx.region ? `Popular Irrigation Products in ${ctx.region}` : 'Popular Irrigation Products'],
    ['{{PRODUCTS_COUNT}}', '4'],
    ['{{PAGE_SOURCE}}', ctx.urlPath],
    ['{{CANONICAL_URL}}', `https://www.myriadgreen.co.za${ctx.urlPath}`],
    ['{{PAGE_TITLE}}', ctx.suburbName ? `Irrigation ${ctx.suburbName} | Myriad Green` : `Irrigation ${ctx.region} | Myriad Green`],
    ['{{META_DESCRIPTION}}', ctx.suburbName ? `Irrigation services in ${ctx.suburbName}: installation, repairs, and smart automation.` : `Irrigation services in ${ctx.region}: installation, repairs, and smart automation.`],
    ['{{META_KEYWORDS}}', `irrigation, ${ctx.region.toLowerCase()}, smart irrigation, repairs, installation`],
    ['{{HERO_TITLE}}', ctx.suburbName ? `Irrigation in ${ctx.suburbName}` : `Irrigation in ${ctx.region}`],
    ['{{HERO_INTRO}}', 'Professional irrigation services: smart controllers, drip/spray systems, and expert repairs.'],
    ['{{OVERVIEW_IMAGE_URL}}', '/images/work/Irrigation Repairs.png'],
    ['{{OVERVIEW_IMAGE_ALT}}', `Irrigation services in ${ctx.suburbName || ctx.region}`],
  ]);
  let out = html;
  for (const [k,v] of replacements){
    out = out.split(k).join(v);
  }
  // Clear grid placeholder if still present
  out = out.replace('{{PRODUCT_GRID_ITEMS}}','');
  // Local services links
  if (out.includes('{{LOCAL_SERVICES_LINKS}}')){
    out = out.replace('{{LOCAL_SERVICES_LINKS}}', generateLocalLinks(ctx));
  }
  // Fix weather widget data-suburb if attribute remained with token
  out = out.replace(/(id=["']weather-widget["'][^>]*data-suburb=)["'][^"']*["']/i, `$1"${ctx.suburbName || ctx.region}"`);
  return ensureH1DataAttrs(out, ctx);
}

function main(){
  const files = walk(IRRIGATION_DIR);
  let patched = 0;
  for (const f of files){
    const html = fs.readFileSync(f, 'utf8');
    const ctx = deriveContext(f);
    const updated = replaceTokens(html, ctx);
    if (updated !== html){
      fs.writeFileSync(f, updated, 'utf8');
      patched++;
      console.log('Patched', f);
    }
  }
  console.log('Done. Patched', patched, 'files.');
}

main();
