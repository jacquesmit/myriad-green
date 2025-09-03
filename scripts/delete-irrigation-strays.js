#!/usr/bin/env node
/**
 * delete-irrigation-strays.js
 * Safely delete duplicate suburb-level service HTML files where the canonical
 * structure is a subfolder with index.html. Keeps index.html and area-level files.
 *
 * Examples of deletions per suburb directory:
 *  - sprinkler-repair.html (when sprinkler-repair/ exists)
 *  - irrigation-installation.html (when irrigation-installation/ exists)
 *  - irrigation-maintenance.html (when irrigation-maintenance/ exists)
 *  - irrigation-products.html (when irrigation-products/ exists)
 *  - Any file ending with -<suburb>.html that includes a service keyword
 *    (e.g., sprinkler-installation-hatfield.html, irrigation-products-hatfield.html)
 *  - Known typos like irrigation-repairs.html
 *
 * Idempotent, logs actions, skips .history and non-irrigation trees.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IRR = path.join(ROOT, 'irrigation');

function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function listAreas() {
  if (!fs.existsSync(IRR)) return [];
  return fs.readdirSync(IRR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['.history', 'shop', 'products'].includes(d.name))
    .map(d => d.name);
}

function listSuburbs(areaDir) {
  return fs.readdirSync(areaDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '.history')
    .map(d => d.name);
}

function safeUnlink(filePath) {
  try { fs.unlinkSync(filePath); return true; } catch { return false; }
}

function main() {
  const serviceTypes = new Set(['sprinkler-repair', 'irrigation-installation', 'irrigation-maintenance', 'irrigation-products']);
  const serviceKeywords = ['sprinkler', 'irrigation'];
  const knownTypos = new Set(['irrigation-repairs']);

  const areas = listAreas();
  let deleted = 0;
  let inspected = 0;

  for (const area of areas) {
    const areaDir = path.join(IRR, area);
    // Area-level stray .html files (non-index) should not exist; delete them.
    const areaEntries = fs.readdirSync(areaDir, { withFileTypes: true });
    for (const e of areaEntries) {
      if (e.isFile() && /\.html$/i.test(e.name) && e.name.toLowerCase() !== 'index.html') {
        const p = path.join(areaDir, e.name);
        if (safeUnlink(p)) {
          console.log('Deleted area-level stray file:', p);
          deleted++;
        }
      }
    }
    const suburbs = listSuburbs(areaDir);
    for (const suburb of suburbs) {
      const suburbDir = path.join(areaDir, suburb);
      const suburbSlug = suburb; // already slug-like
      const entries = fs.readdirSync(suburbDir, { withFileTypes: true });
      const folders = new Set(entries.filter(e => e.isDirectory()).map(e => e.name));
      const files = entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.html'));
      for (const f of files) {
        inspected++;
        if (f.name.toLowerCase() === 'index.html') continue;
        const base = f.name.replace(/\.html$/i, '');
        const fullPath = path.join(suburbDir, f.name);

        // Rule 1: exact match to a service type and folder exists
        if (serviceTypes.has(base) && folders.has(base)) {
          if (safeUnlink(fullPath)) {
            console.log('Deleted duplicate service file:', fullPath);
            deleted++;
            continue;
          }
        }

        // Rule 2: ends with -<suburb> and includes a service keyword
        if (base.endsWith(`-${suburbSlug}`) && serviceKeywords.some(k => base.includes(k))) {
          if (safeUnlink(fullPath)) {
            console.log('Deleted suburb-suffixed service file:', fullPath);
            deleted++;
            continue;
          }
        }

        // Rule 3: known typo/legacy names
        if (knownTypos.has(base)) {
          if (safeUnlink(fullPath)) {
            console.log('Deleted known-typo service file:', fullPath);
            deleted++;
            continue;
          }
        }
      }
    }
  }

  console.log(`Done. Deleted ${deleted} stray files. Inspected ${inspected} suburb-level HTML files.`);
}

main();
