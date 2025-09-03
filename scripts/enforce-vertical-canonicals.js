#!/usr/bin/env node
/**
 * enforce-vertical-canonicals.js
 * Ensures each HTML file under a given vertical has a canonical tag
 * pointing to the extensionless, trailing-slash URL on https://www.myriadgreen.co.za
 *
 * Usage: node scripts/enforce-vertical-canonicals.js <vertical> [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const [,, verticalArg, maybeDry] = process.argv;
const DRY_RUN = maybeDry === '--dry-run';

if (!verticalArg) {
  console.error('Usage: node scripts/enforce-vertical-canonicals.js <vertical> [--dry-run]');
  process.exit(1);
}

const VERTICAL = verticalArg.replace(/^[\/]+|[\/]+$/g, '');
const BASE_DIR = path.join(ROOT, VERTICAL);

function isHtmlFile(name){ return /\.html?$/i.test(name); }
function walk(dir, acc=[]) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.history' || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.isFile() && isHtmlFile(e.name)) acc.push(p);
  }
  return acc;
}

function toUrlPath(filePath) {
  // Get path from vertical onward
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  // Examples of rel:
  // boreholes/index.html -> /boreholes/
  // boreholes/pretoria/index.html -> /boreholes/pretoria/
  // boreholes/pretoria/faerie-glen/index.html -> /boreholes/pretoria/faerie-glen/
  // boreholes/pretoria/faerie-glen/boreholes-installation.html -> /boreholes/pretoria/faerie-glen/boreholes-installation/
  // boreholes/pretoria/all-locations.html -> /boreholes/pretoria/all-locations/
  let url = '/' + rel;
  // Normalize index.html -> folder
  url = url.replace(/index\.html?$/i, '');
  // any *.html -> * (remove .html)
  url = url.replace(/\.html?$/i, '/');
  // ensure single trailing slash
  url = url.replace(/\/+/g, '/');
  if (!url.endsWith('/')) url += '/';
  return url;
}

function upsertCanonical(html, canonicalUrl) {
  const linkTag = `<link rel="canonical" href="https://www.myriadgreen.co.za${canonicalUrl}" />`;
  if (/\brel=["']canonical["']/i.test(html)) {
    // Replace existing canonical href
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, linkTag);
  }
  // Try to insert early inside <head>
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m)=> `${m}\n  ${linkTag}`);
  }
  return html; // no <head> found — unlikely
}

function main(){
  if (!fs.existsSync(BASE_DIR)) {
    console.error('Vertical folder not found:', BASE_DIR);
    process.exit(1);
  }
  const files = walk(BASE_DIR);
  let changed = 0;
  for (const f of files) {
    let html = fs.readFileSync(f, 'utf8');
    const canonicalPath = toUrlPath(f);
    const updated = upsertCanonical(html, canonicalPath);
    if (updated !== html) {
      if (!DRY_RUN) fs.writeFileSync(f, updated, 'utf8');
      console.log('Canonical set:', path.relative(ROOT, f), '->', canonicalPath);
      changed++;
    }
  }
  console.log(`Done. Updated canonicals for ${changed} files under /${VERTICAL}.`);
}

main();
