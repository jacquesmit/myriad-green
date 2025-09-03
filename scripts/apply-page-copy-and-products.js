#!/usr/bin/env node
/**
 * apply-page-copy-and-products.js
 * Injects per-page copy (hero intro) and featured product cards into pages
 * based on data/page-copy.json and data/page-products.json.
 *
 * Strategy:
 * - For each HTML page under the target vertical roots, locate:
 *   - <p data-hero-intro>...</p> and replace text with copy
 *   - <section id="featured-products"> with <div class="product-grid">,
 *     populate with product cards for slugs in page-products mapping by key.
 * - Page key: prefer <h1 id="page-h1" data-page-key>, else derive from path.
 *
 * Usage: node scripts/apply-page-copy-and-products.js [vertical1 vertical2 ...]
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_COPY = path.join(ROOT, 'data', 'page-copy.json');
const DATA_PRODUCTS = path.join(ROOT, 'data', 'page-products.json');

function readJson(p){ try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function read(file){ return fs.readFileSync(file, 'utf8'); }
function write(file, c){ fs.writeFileSync(file, c, 'utf8'); }

function walk(dir, acc=[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function deriveKeyFromPath(file){
  // /vertical/area/suburb/index.html -> vertical-area-suburb
  const rel = path.relative(ROOT, file).replace(/\\/g,'/');
  const parts = rel.split('/');
  const i = parts.indexOf('irrigation');
  const idx = i >= 0 ? i : (parts.findIndex(p => ['boreholes','pumps','water-storage-tanks','rain-water-harvesting','water-filtration','leak-detection','landscaping','grey-water-systems','waste-water-systems'].includes(p)));
  if (idx < 0) return null;
  const slice = parts.slice(idx, parts.length);
  const segs = slice.filter(s => s && s !== 'index.html' && s !== 'all-locations.html');
  return segs.join('-');
}

function getPageKey(html, file){
  const m = html.match(/<h1[^>]*id=["']page-h1["'][^>]*data-page-key=["']([^"']+)["'][^>]*>/i);
  if (m) return m[1];
  return deriveKeyFromPath(file);
}

function pageProductsKeyFromFile(file){
  // Path-based key used by coverage tooling: `/${vertical}/${rest}/`
  const rel = path.relative(ROOT, file).replace(/\\/g,'/');
  const parts = rel.split('/');
  const idx = parts.findIndex(p => ['irrigation','boreholes','pumps','water-storage-tanks','rain-water-harvesting','water-filtration','leak-detection','landscaping','grey-water-systems','waste-water-systems'].includes(p));
  if (idx < 0) return null;
  let rest = parts.slice(idx).join('/');
  // Always trailing slash
  if (!rest.endsWith('/')) rest += '/';
  return `/${rest}`;
}

function pageProductsKeyFromDataKey(vertical, dataKey){
  // Build `/vertical/.../` form from data-page-key tail segments
  if (!vertical || !dataKey) return null;
  const segs = dataKey.split('-');
  if (segs[0] !== vertical) return null;
  const tail = segs.slice(1).join('/');
  return `/${vertical}/${tail}/`;
}

function titleCase(s){
  return s.replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

function productCard(slug){
  const titleRaw = slug.replace(/[-_]/g,' ');
  const title = titleCase(titleRaw);
  const imgJpg = `/images/products/${slug}.jpg`;
  const imgPlaceholder = `/images/products/placeholder.svg`;
  const imgPathFs = path.join(ROOT, 'images', 'products', `${slug}.jpg`);
  const img = fs.existsSync(imgPathFs) ? imgJpg : imgPlaceholder;
  const url = `/shop/${slug}`;
  // No price catalogue yet; default to 0 so cart math is defined.
  const price = 0;
  return `<article class="product-card">
    <a href="${url}">
      <figure><img src="${img}" alt="${title}" loading="lazy" decoding="async"></figure>
      <h3>${title}</h3>
    </a>
    <p class="description" style="display:none;"></p>
    <div class="card-actions">
      <button class="add-to-cart-btn" data-id="${slug}" data-name="${title}" data-price="${price}">Add to Cart</button>
      <button class="buy-now-btn" data-id="${slug}" data-name="${title}" data-price="${price}" aria-label="Buy ${title} now">Buy Now</button>
    </div>
  </article>`;
}

function applyCopy(html, copy){
  if (!copy) return html;
  return html.replace(/(<p[^>]*data-hero-intro[^>]*>)([\s\S]*?)(<\/p>)/i, (m,a,_b,c)=>`${a}${copy}${c}`);
}

function applyProducts(html, slugs){
  if (!Array.isArray(slugs) || !slugs.length) return html;
  return html.replace(/(<section[^>]*id=["']featured-products["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*product-grid[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i,
    (m, pre, _inner, post) => `${pre}${slugs.map(productCard).join('')}${post}`
  );
}

function main(){
  const args = process.argv.slice(2);
  const targets = args.length ? args : ['boreholes','pumps','water-storage-tanks','rain-water-harvesting','water-filtration','leak-detection','landscaping','grey-water-systems','waste-water-systems'];
  const copyData = readJson(DATA_COPY) || { defaults: { hero: { intro: '' } }, overrides: {} };
  const prodData = readJson(DATA_PRODUCTS) || {};
  let patched = 0;

  for (const v of targets){
    const base = path.join(ROOT, v);
    if (!fs.existsSync(base)) continue;
    for (const file of walk(base)){
      let html = read(file);
      const key = getPageKey(html, file);
      const heroIntro = (copyData.overrides && copyData.overrides[key] && copyData.overrides[key].heroIntro)
        || (copyData.defaults && copyData.defaults.hero && copyData.defaults.hero.intro) || '';
  // Resolve products with robust fallback:
  // 1) exact path-based key from file path (supports keyword pages with filename)
  // 2) key derived from data-page-key segments (legacy: uses keyword segment only)
  // 3) legacy folder key for index pages already covered by (1)
  const k1 = pageProductsKeyFromFile(file);
  // Support foldered keyword pages like .../sprinkler-repair/index.html/ mapping to .../sprinkler-repair.html/
  const k1Alt = k1 && /\/index\.html\/$/i.test(k1) ? k1.replace(/\/index\.html\/$/i, '.html/') : null;
  const k2 = pageProductsKeyFromDataKey(v, key || '');
  const k3 = `/${v}/${(key||'').split('-').slice(1).join('/')}/`;
  const slugs = (k1 && prodData[k1]) || (k1Alt && prodData[k1Alt]) || prodData[k2] || prodData[k3] || [];

      const updated1 = applyCopy(html, heroIntro);
      const updated2 = applyProducts(updated1, slugs);
      if (updated2 !== html){
        write(file, updated2);
        patched++;
        console.log('Patched', file);
      }
    }
  }
  console.log(`Done. Patched ${patched} files.`);
}

main();
