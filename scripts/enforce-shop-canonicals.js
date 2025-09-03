#!/usr/bin/env node
/**
 * enforce-shop-canonicals.js
 * Ensures each shop/{slug}.html has a single canonical <link> to /shop/{slug}.
 * - Removes duplicate canonical tags.
 * - Inserts canonical if missing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SHOP = path.join(ROOT, 'shop');

function listHtml(dir){
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.html'))
    .map(d => path.join(dir, d.name));
}

function upsertCanonical(file){
  let html = fs.readFileSync(file, 'utf8');
  const slug = path.basename(file, '.html');
  const canonicalHref = `/shop/${slug}`;

  // Remove existing canonical link tags
  const before = html;
  html = html.replace(/\n?\s*<link[^>]*rel=["']canonical["'][^>]*>\s*/gi, '');

  // Inject canonical just before closing head
  if (/<\/head>/i.test(html)){
    html = html.replace(/<\/head>/i, `  <link rel="canonical" href="${canonicalHref}" />\n</head>`);
  } else {
    // no head? prepend for safety
    html = `<link rel="canonical" href="${canonicalHref}" />\n` + html;
  }

  if (html !== before){
    fs.writeFileSync(file, html, 'utf8');
    console.log('Canonical enforced:', path.relative(ROOT, file));
    return 1;
  }
  return 0;
}

function main(){
  if (!fs.existsSync(SHOP)) return;
  let changed = 0;
  for (const f of listHtml(SHOP)) changed += upsertCanonical(f);
  console.log(`Done. Updated ${changed} product pages.`);
}

main();
