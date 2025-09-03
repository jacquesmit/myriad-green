#!/usr/bin/env node
/**
 * apply-water-tanks-option-b.js
 * Implements the requested product selection rules for water-storage-tanks:
 * - Index/products/all-locations pages: 5000L, 2500L, 2000L, 1000L-slimline
 * - Installation pages: 5000L, 2500L
 * - Maintenance pages: tank-fittings-kit, tank-level-indicator
 * - Repairs pages: tank-stand-basic, tank-fittings-kit
 * Also ensures related-products for each JoJo tank shop page cross-link the other capacities.
 *
 * Non-destructive for other verticals; only updates keys starting with /water-storage-tanks/ in data files,
 * and adds/updates related entries for /shop/jojo-tank-*.json keys.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const PAGE_PRODUCTS = path.join(DATA_DIR, 'page-products.json');
const RELATED_PRODUCTS = path.join(DATA_DIR, 'related-products.json');

function readJson(p){ return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

const CAPACITIES = ['jojo-tank-5000l', 'jojo-tank-2500l', 'jojo-tank-2000l', 'jojo-tank-1000l-slimline'];
const INSTALLATION = ['jojo-tank-5000l', 'jojo-tank-2500l'];
const MAINTENANCE = ['tank-fittings-kit', 'tank-level-indicator'];
const REPAIRS = ['tank-stand-basic', 'tank-fittings-kit'];

function classify(key){
  if (!key.startsWith('/water-storage-tanks/')) return null;
  if (key.endsWith('/index.html/')) return 'index';
  if (key.includes('/water-storage-tanks-products.html/')) return 'products';
  if (key.includes('/all-locations.html/')) return 'all';
  if (key.includes('/water-storage-tanks-installation.html/')) return 'installation';
  if (key.includes('/water-storage-tanks-maintenance.html/')) return 'maintenance';
  if (key.includes('/water-storage-tanks-repairs.html/')) return 'repairs';
  return 'other';
}

function applyOptionB(){
  let pp = readJson(PAGE_PRODUCTS);
  let rp = readJson(RELATED_PRODUCTS);

  let ppChanged = 0;
  for (const key of Object.keys(pp)){
    const type = classify(key);
    if (!type) continue;
    let desired;
    switch(type){
      case 'index':
      case 'products':
      case 'all': desired = CAPACITIES; break;
      case 'installation': desired = INSTALLATION; break;
      case 'maintenance': desired = MAINTENANCE; break;
      case 'repairs': desired = REPAIRS; break;
      default: continue;
    }
    const current = pp[key] || [];
    const same = current.length === desired.length && current.every((v,i)=>v===desired[i]);
    if (!same){ pp[key] = desired; ppChanged++; }
  }

  // Ensure related-products for shop tank pages cross-link other capacities
  const tankPages = CAPACITIES;
  for (const slug of tankPages){
    const key = `/shop/${slug}`;
    const others = tankPages.filter(s => s !== slug);
    if (!rp[key] || JSON.stringify(rp[key]) !== JSON.stringify(others)){
      rp[key] = others;
    }
  }

  writeJson(PAGE_PRODUCTS, pp);
  writeJson(RELATED_PRODUCTS, rp);
  console.log(`Updated page-products entries (water-storage-tanks): ${ppChanged}`);
  console.log(`Ensured related-products for shop tank pages: ${tankPages.length}`);
}

applyOptionB();
