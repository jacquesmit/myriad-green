#!/usr/bin/env node
/**
 * delete-landscaping-strays.js
 * Safely delete duplicate suburb-level landscaping service HTML files where the canonical
 * structure is a subfolder with index.html (keeps index.html). Also delete area-level
 * stray files matching landscaping-*.html (keeps index.html and all-locations.html).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'landscaping');

function listAreas() {
  if (!fs.existsSync(BASE)) return [];
  return fs.readdirSync(BASE, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '.history')
    .map(d => d.name);
}

function listSuburbs(areaDir) {
  return fs.readdirSync(areaDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '.history')
    .map(d => d.name);
}

function safeUnlink(p) { try { fs.unlinkSync(p); return true; } catch { return false; } }

function main() {
  const serviceTypes = new Set(['landscaping-installation', 'landscaping-maintenance', 'landscaping-products', 'landscaping-repairs']);
  let deleted = 0, inspected = 0;

  for (const area of listAreas()) {
    const areaDir = path.join(BASE, area);
    // Area-level: remove landscaping-*.html strays (keep index.html and all-locations.html)
    for (const e of fs.readdirSync(areaDir, { withFileTypes: true })) {
      if (e.isFile() && /\.html$/i.test(e.name)) {
        const name = e.name.toLowerCase();
        if (name === 'index.html' || name === 'all-locations.html') continue;
        if (/^landscaping-[a-z0-9-]+\.html$/i.test(e.name)) {
          const p = path.join(areaDir, e.name);
          if (safeUnlink(p)) { console.log('Deleted area-level landscaping stray:', p); deleted++; }
        }
      }
    }

    // Suburbs: delete duplicate service files when matching folder exists
    for (const suburb of listSuburbs(areaDir)) {
      const suburbDir = path.join(areaDir, suburb);
      const entries = fs.readdirSync(suburbDir, { withFileTypes: true });
      const folders = new Set(entries.filter(x => x.isDirectory()).map(x => x.name));
      const files = entries.filter(x => x.isFile() && x.name.toLowerCase().endsWith('.html'));
      for (const f of files) {
        inspected++;
        const lower = f.name.toLowerCase();
        if (lower === 'index.html') continue;
        const base = f.name.replace(/\.html$/i, '');
        if (serviceTypes.has(base) && folders.has(base)) {
          const p = path.join(suburbDir, f.name);
          if (safeUnlink(p)) { console.log('Deleted duplicate landscaping service file:', p); deleted++; }
        }
      }
    }
  }

  console.log(`Done. Deleted ${deleted} landscaping strays. Inspected ${inspected} suburb-level HTML files.`);
}

main();
