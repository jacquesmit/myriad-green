#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function walk(dir, acc=[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && entry.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function slugFromPath(p) {
  return p.replace(/\\/g,'/').split('/').slice(-3).join('-').replace(/\.html$/, '');
}

function ensureH1Markers(html, { pageKey, cityName, suburbName }) {
  // 1) Strip page-h1/data-* markers from all h1s to avoid duplicates
  let out = html.replace(/<h1([^>]*)>/gi, (full, attrs) => {
    const cleaned = attrs
      .replace(/\s+id=["']page-h1["']/gi, '')
      .replace(/\s+data-page-key=["'][^"']*["']/gi, '')
      .replace(/\s+data-city=["'][^"']*["']/gi, '')
      .replace(/\s+data-suburb=["'][^"']*["']/gi, '');
    return `<h1${cleaned}>`;
  });
  // 2) Add id="page-h1" and data markers to the hero h1 (with data-hero-title), or fallback to first h1
  const addAttrs = (attrs) => {
    let a = attrs || '';
    if (!/id=\"page-h1\"/i.test(a)) a += ' id="page-h1"';
    if (!/data-page-key=/i.test(a)) a += ` data-page-key="${pageKey}"`;
    if (cityName && !/data-city=/i.test(a)) a += ` data-city="${cityName}"`;
    if (suburbName && !/data-suburb=/i.test(a)) a += ` data-suburb="${suburbName}"`;
    return a;
  };
  // Try hero h1 first
  if (/(<h1[^>]*data-hero-title[^>]*>)/i.test(out)) {
    out = out.replace(/<h1([^>]*data-hero-title[^>]*)>([\s\S]*?)<\/h1>/i, (m, attrs, text) => {
      return `<h1${addAttrs(attrs)}>${text}</h1>`;
    });
  } else {
    // fallback: first h1
    out = out.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/i, (m, attrs, text) => {
      return `<h1${addAttrs(attrs)}>${text}</h1>`;
    });
  }
  return out;
}

function ensureScripts(html) {
  // Standardize and dedupe script includes for core JS files
  const ensureSingle = (content, src, canonicalTag, shouldInclude = true) => {
    // Remove any existing script tag that references the src (module/defer/any attrs)
    const re = new RegExp(`\\s*<script[^>]+src=["']${src}["'][^>]*>\\s*<\\/script>`, 'gi');
    let out = content.replace(re, '');
    if (shouldInclude) {
      out = out.replace(/(<\/body>\s*<\/html>)/i, `${canonicalTag}\n$1`);
    }
    return out;
  };
  let out = html;
  const hasRelatedContainer = /id=\"related-products\"/i.test(out);
  out = ensureSingle(out, '/js/h1-injector.js', '<script src="/js/h1-injector.js" defer></script>');
  out = ensureSingle(out, '/js/weather-signal.js', '<script src="/js/weather-signal.js" defer></script>');
  out = ensureSingle(out, '/js/related-products.js', '<script src="/js/related-products.js" defer></script>', hasRelatedContainer);
  return out;
}

function tidyRelatedProducts(html) {
  const hasRelatedContainer = /id=\"related-products\"/.test(html);
  if (!hasRelatedContainer) {
    return html.replace(/\s*<script\s+src=\"\/js\/related-products\.js\"[^>]*>\s*<\/script>/i, '');
  }
  return html;
}

function main() {
  const ROOT = process.cwd();
  const base = path.join(ROOT, 'irrigation');
  if (!fs.existsSync(base)) return;
  const files = walk(base);
  let updated = 0;
  for (const f of files) {
    let html = fs.readFileSync(f, 'utf8');
  const key = slugFromPath(f);
  // Derive city (area) and suburb from path when available
  const parts = f.replace(/\\/g, '/').split('/');
  const irrIdx = parts.findIndex(p => p === 'irrigation');
  const areaSlugCand = irrIdx !== -1 && parts[irrIdx + 1] ? parts[irrIdx + 1] : '';
  const areaSlug = areaSlugCand && !/\.html$/i.test(areaSlugCand) ? areaSlugCand : '';
  const suburbSlugCand = irrIdx !== -1 && parts[irrIdx + 2] ? parts[irrIdx + 2] : '';
  const suburbSlug = suburbSlugCand && !/\.html$/i.test(suburbSlugCand) ? suburbSlugCand : '';
  const toTitle = s => s ? s.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ') : '';
  const cityName = toTitle(areaSlug);
  const suburbName = toTitle(suburbSlug);
    const before = html;
  html = ensureH1Markers(html, { pageKey: key, cityName, suburbName });
  html = ensureScripts(html);
  html = tidyRelatedProducts(html);
    if (html !== before) {
      fs.writeFileSync(f, html, 'utf8');
      console.log('Patched', f);
      updated++;
    }
  }
  console.log(`Done. Patched ${updated} files.`);
}

main();
