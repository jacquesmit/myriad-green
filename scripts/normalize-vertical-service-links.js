#!/usr/bin/env node
/**
 * normalize-vertical-service-links.js
 * For a given vertical, convert keyword service links from .html to folder URLs with trailing slashes.
 * It updates both absolute links (e.g., /boreholes/pretoria/faerie-glen/boreholes-installation.html)
 * and relative links within a suburb directory (e.g., boreholes-installation.html).
 *
 * Usage: node scripts/normalize-vertical-service-links.js <vertical> [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const [,, verticalArg, maybeDry] = process.argv;
const DRY_RUN = maybeDry === '--dry-run';

if (!verticalArg) {
  console.error('Usage: node scripts/normalize-vertical-service-links.js <vertical> [--dry-run]');
  process.exit(1);
}

const VERTICAL = verticalArg.replace(/^[\/]+|[\/]+$/g, '');
const BASE_DIR = path.join(ROOT, VERTICAL);

function walk(dir, acc=[]) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.history' || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) acc.push(p);
  }
  return acc;
}

function normalize(html, vertical) {
  // Patterns to cover: <vertical>-installation|maintenance|repairs|products
  const svc = `${vertical}-(?:installation|maintenance|repairs|products)`;
  // Absolute links
  const absRe = new RegExp(`href=("|')\\s*(\/${vertical}\/[a-z0-9-]+\/[a-z0-9-]+\/${svc})\.html\/?\\s*(\\1)`, 'gi');
  html = html.replace(absRe, (m, q, base) => `href=${q}${base}/${q}`);
  // Relative links
  const relRe = new RegExp(`href=("|')\\s*(?:\\.\/)?(${svc})\.html\/?\\s*(\\1)`, 'gi');
  html = html.replace(relRe, (m, q, svcPath) => `href=${q}${svcPath}/${q}`);
  return html;
}

function main(){
  if (!fs.existsSync(BASE_DIR)) {
    console.error('Vertical folder not found:', BASE_DIR);
    process.exit(1);
  }
  const files = walk(BASE_DIR);
  let changed = 0;
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8');
    const after = normalize(before, VERTICAL);
    if (after !== before) {
      if (!DRY_RUN) fs.writeFileSync(f, after, 'utf8');
      console.log('Updated service links:', path.relative(ROOT, f));
      changed++;
    }
  }
  console.log(`Done. Updated ${changed} files under /${VERTICAL}.`);
}

main();
