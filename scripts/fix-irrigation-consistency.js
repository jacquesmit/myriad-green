#!/usr/bin/env node
/**
 * fix-irrigation-consistency.js
 * Brings irrigation/ pages up to a consistent baseline:
 *  - Adds <h1 id="page-h1" data-page-key data-city data-suburb> hero if missing
 *  - Adds weather widget if missing (data-suburb inferred)
 *  - Injects /css/irrigation-sections.css into <head> if missing
 *  - Adds canonical <link> if missing (extensionless for index pages)
 * Safe and idempotent: only adds when missing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'irrigation');

function walk(dir, acc=[]) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.history' || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && /\.html$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

function titleCase(s){
  return s.split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ').trim();
}

function inferContext(rel){
  // rel like irrigation/area/suburb/file.html or irrigation/area/index.html
  const parts = rel.replace(/\\/g,'/').split('/');
  let area = null, suburb = null, file = null;
  if (parts[0] === 'irrigation') {
    area = parts[1] || null;
    if (parts.length >= 4 && !/\.html$/i.test(parts[2])) suburb = parts[2];
    file = parts[parts.length-1];
  }
  // Normalize special cases
  let city = area ? titleCase(area) : 'Gauteng';
  let sub = suburb ? titleCase(suburb) : (area ? titleCase(area) : 'Gauteng');
  const pageKeyBase = ['irrigation', area, suburb].filter(Boolean).join('-');
  const pageKey = file && file.toLowerCase() !== 'index.html' ? `${pageKeyBase}-${file}` : pageKeyBase;
  const isIndex = file && file.toLowerCase() === 'index.html';
  return { city, suburb: sub, pageKey, isIndex };
}

function ensureCanonical(html, rel){
  // Desired canonical: extensionless everywhere under irrigation/ (add trailing slash)
  // For other verticals: index.html -> directory trailing slash; other pages keep filename.
  const isIrr = /^irrigation\//i.test(rel);
  let desired;
  if (/\/index\.html$/i.test(rel)) {
    const dir = path.posix.dirname(rel);
    desired = '/' + (dir === '.' ? '' : dir + '/')
      .replace(/^\/+/, '/');
  } else if (isIrr) {
    const dir = path.posix.dirname(rel).replace(/\\/g,'/');
    const base = path.posix.basename(rel, '.html');
    desired = `/${dir}/${base}/`.replace(/\/+/, '/');
  } else {
    desired = '/' + rel.replace(/\\/g,'/');
  }

  const hasCanon = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
  if (hasCanon) {
    // Replace href value if different
    const updated = html.replace(/(<link[^>]+rel=["']canonical["'][^>]*href=)["'][^"']*["']([^>]*>)/i, (m, p1, p2) => `${p1}"${desired}"${p2}`);
    return updated;
  }
  const link = `  <link rel="canonical" href="${desired}" />\n`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + '\n' + link);
  return link + html;
}

function ensureIrrCss(html){
  if (/<link[^>]+irrigation-sections\.css/i.test(html)) return html;
  const tag = `  <link rel="stylesheet" href="/css/irrigation-sections.css" />\n`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + '\n' + tag);
  return tag + html;
}

function ensureH1(html, ctx){
  if (/<h1[^>]*id=["']page-h1["']/i.test(html)) return html;
  const title = ctx.suburb && ctx.city && ctx.suburb !== ctx.city
    ? `Irrigation in ${ctx.suburb}, ${ctx.city}`
    : `Irrigation in ${ctx.city}`;
  const block = `\n<section class="hero-irrigation"><div class="hero-grid"><div class="hero-text"><h1 data-hero-title id="page-h1" data-page-key="${ctx.pageKey}" data-city="${ctx.city}" data-suburb="${ctx.suburb}">${title}</h1><p data-hero-intro>Trusted local specialists for design, installation and maintenance.</p><button class="btn book-now-button" id="hero-book-service">Get a Quote</button></div></div></section>\n`;
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, m => m + block);
  return block + html;
}

function ensureWeather(html, ctx){
  if (/<div[^>]*id=["']weather-widget["'][^>]*>/i.test(html)) return html;
  const w = `\n<div id="weather-widget" class="weather-widget" data-suburb="${ctx.suburb}" data-country="ZA" data-units="metric" data-cache-mins="120" data-stale-mins="240" data-theme="xbox" data-tone="solid" data-icon="#ffffff"></div>\n`;
  // Try to append near end of body
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, w + '</main>');
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, w + '</body>');
  return html + w;
}

function processFile(abs){
  const rel = path.relative(ROOT, abs).replace(/\\/g,'/');
  let html = fs.readFileSync(abs, 'utf8');
  const ctx = inferContext(rel);
  const before = html;
  html = ensureCanonical(html, rel);
  html = ensureIrrCss(html);
  html = ensureH1(html, ctx);
  html = ensureWeather(html, ctx);
  if (html !== before) {
    fs.writeFileSync(abs, html, 'utf8');
    return true;
  }
  return false;
}

function main(){
  const files = walk(DIR);
  let changed = 0;
  for (const f of files) { if (processFile(f)) changed++; }
  console.log(`Fixed irrigation pages: ${changed}/${files.length}`);
}

main();
