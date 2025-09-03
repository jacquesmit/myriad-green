#!/usr/bin/env node
/**
 * report-content-coverage.js
 * Scans vertical pages and reports pages missing entries in data/page-products.json
 * and data/related-products.json. Writes a JSON report and prints a summary.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_PRODUCTS = path.join(ROOT, 'data', 'page-products.json');
const DATA_RELATED = path.join(ROOT, 'data', 'related-products.json');
const OUT_JSON = path.join(ROOT, 'data', 'content-coverage-report.json');

const VERTICALS = [
  'irrigation','boreholes','pumps','water-storage-tanks','rain-water-harvesting',
  'water-filtration','leak-detection','landscaping','grey-water-systems','waste-water-systems'
];

function walk(dir, acc=[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function pageProductsKey(file) {
  // Format used by apply-page-copy-and-products: `/${vertical}/${rest}/`
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const parts = rel.split('/');
  const vIdx = parts.findIndex(p => VERTICALS.includes(p));
  if (vIdx < 0) return null;
  const rest = parts.slice(vIdx).join('/');
  return '/' + rest.replace(/\\/g,'/') + '/';
}

function sectionPathFromFile(file) {
  // For related-products: we use the folder path ending in a trailing slash for index pages,
  // and the html filename for keyword pages, also followed by trailing slash
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const parts = rel.split('/');
  const vIdx = parts.findIndex(p => VERTICALS.includes(p));
  if (vIdx < 0) return null;
  const rest = parts.slice(vIdx).join('/');
  // Use the URL-like path without leading slash, then add it and ensure trailing slash
  let url = '/' + rest;
  if (!url.endsWith('/')) url += '/';
  // For index.html pages, drop the index.html segment to get the folder path
  url = url.replace(/index\.html\/$/, '');
  return url;
}

function main(){
  const prodMap = fs.existsSync(DATA_PRODUCTS) ? JSON.parse(fs.readFileSync(DATA_PRODUCTS,'utf8')) : {};
  const relatedMap = fs.existsSync(DATA_RELATED) ? JSON.parse(fs.readFileSync(DATA_RELATED,'utf8')) : {};

  const report = { missingProducts: [], missingRelated: [] };
  let total = 0;

  for (const v of VERTICALS){
    const base = path.join(ROOT, v);
    if (!fs.existsSync(base)) continue;
    for (const file of walk(base)){
      total++;
      const prodKey = pageProductsKey(file);
      const sectKey = sectionPathFromFile(file);
      if (prodKey && (!Array.isArray(prodMap[prodKey]) || prodMap[prodKey].length === 0)){
        report.missingProducts.push(prodKey);
      }
      if (sectKey && (!Array.isArray(relatedMap[sectKey]) || relatedMap[sectKey].length === 0)){
        report.missingRelated.push(sectKey);
      }
    }
  }

  // De-dup and sort
  report.missingProducts = Array.from(new Set(report.missingProducts)).sort();
  report.missingRelated = Array.from(new Set(report.missingRelated)).sort();
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  console.log(`[coverage] Total pages scanned: ${total}`);
  console.log(`[coverage] Pages missing products: ${report.missingProducts.length}`);
  console.log(`[coverage] Pages missing related-products: ${report.missingRelated.length}`);
  console.log(`\nReport written to: ${path.relative(ROOT, OUT_JSON)}`);
}

main();
