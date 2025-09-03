#!/usr/bin/env node
/**
 * migrate-water-tanks-2500l-to-5000l.js
 * - Replaces jojo-tank-2500l with jojo-tank-5000l in:
 *   - data/page-products.json entries whose key starts with /water-storage-tanks/
 *   - data/related-products.json entries whose key starts with /water-storage-tanks/
 * - Skips other verticals
 * - Non-destructive: writes files back with normalized formatting
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const PAGE_PRODUCTS = path.join(DATA_DIR, 'page-products.json');
const RELATED_PRODUCTS = path.join(DATA_DIR, 'related-products.json');

function readJson(p){ return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

function migrateList(list){
  let changed = false;
  const out = list.map(slug => {
    if (slug === 'jojo-tank-2500l') { changed = true; return 'jojo-tank-5000l'; }
    return slug;
  });
  return { out, changed };
}

function run(){
  let pp = readJson(PAGE_PRODUCTS);
  let rp = readJson(RELATED_PRODUCTS);
  let ppChanged = 0, rpChanged = 0;

  for (const key of Object.keys(pp)){
    if (!key.startsWith('/water-storage-tanks/')) continue;
    const { out, changed } = migrateList(pp[key] || []);
    if (changed) { pp[key] = out; ppChanged++; }
  }

  for (const key of Object.keys(rp)){
    if (!key.startsWith('/water-storage-tanks/')) continue;
    const { out, changed } = migrateList(rp[key] || []);
    if (changed) { rp[key] = out; rpChanged++; }
  }

  writeJson(PAGE_PRODUCTS, pp);
  writeJson(RELATED_PRODUCTS, rp);
  console.log(`Migrated page-products entries: ${ppChanged}, related-products entries: ${rpChanged}`);
}

run();
