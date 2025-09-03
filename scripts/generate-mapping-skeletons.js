#!/usr/bin/env node
/**
 * generate-mapping-skeletons.js
 * Walks all vertical pages and emits two JSON skeletons with keys for:
 *  - data/page-products.json (page-path keys)
 *  - data/related-products.json (section-path keys)
 * Existing keys in the real files are preserved (not duplicated in skeleton).
 * Output files:
 *  - data/page-products.skeleton.json
 *  - data/related-products.skeleton.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DATA_PRODUCTS = path.join(DATA_DIR, 'page-products.json');
const DATA_RELATED = path.join(DATA_DIR, 'related-products.json');
const OUT_PRODUCTS = path.join(DATA_DIR, 'page-products.skeleton.json');
const OUT_RELATED = path.join(DATA_DIR, 'related-products.skeleton.json');

const VERTICALS = [
  'irrigation','boreholes','pumps','water-storage-tanks','rain-water-harvesting',
  'water-filtration','leak-detection','landscaping','grey-water-systems','waste-water-systems'
];

function walk(dir, acc = []){
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function pageProductsKey(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const parts = rel.split('/');
  const vIdx = parts.findIndex(p => VERTICALS.includes(p));
  if (vIdx < 0) return null;
  const rest = parts.slice(vIdx).join('/');
  return '/' + rest + '/';
}

function sectionPathFromFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const parts = rel.split('/');
  const vIdx = parts.findIndex(p => VERTICALS.includes(p));
  if (vIdx < 0) return null;
  let url = '/' + parts.slice(vIdx).join('/');
  if (!url.endsWith('/')) url += '/';
  url = url.replace(/index\.html\/$/, '');
  return url;
}

function main(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const prodExisting = fs.existsSync(DATA_PRODUCTS) ? JSON.parse(fs.readFileSync(DATA_PRODUCTS, 'utf8')) : {};
  const relExisting = fs.existsSync(DATA_RELATED) ? JSON.parse(fs.readFileSync(DATA_RELATED, 'utf8')) : {};

  const prodSkel = {};
  const relSkel = {};
  let countPages = 0, addProd = 0, addRel = 0;

  for (const v of VERTICALS){
    const base = path.join(ROOT, v);
    if (!fs.existsSync(base)) continue;
    for (const file of walk(base)){
      countPages++;
      const pKey = pageProductsKey(file);
      const sKey = sectionPathFromFile(file);
      if (pKey && !(pKey in prodExisting) && !(pKey in prodSkel)){
        prodSkel[pKey] = [];
        addProd++;
      }
      if (sKey && !(sKey in relExisting) && !(sKey in relSkel)){
        relSkel[sKey] = [];
        addRel++;
      }
    }
  }

  fs.writeFileSync(OUT_PRODUCTS, JSON.stringify(prodSkel, null, 2));
  fs.writeFileSync(OUT_RELATED, JSON.stringify(relSkel, null, 2));
  console.log(`[skeleton] Pages scanned: ${countPages}`);
  console.log(`[skeleton] New product keys suggested: ${addProd}`);
  console.log(`[skeleton] New related keys suggested: ${addRel}`);
  console.log('Outputs:');
  console.log(' - ' + path.relative(ROOT, OUT_PRODUCTS));
  console.log(' - ' + path.relative(ROOT, OUT_RELATED));
}

main();
