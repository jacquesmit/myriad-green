#!/usr/bin/env node
/**
 * Retrofit existing suburb index.html pages to include a Local Services links block
 * and remove accidental duplicate HTML documents.
 *
 * Usage (PowerShell):
 *   node scripts/retrofit-suburb-index-links.js [--areas Pretoria,Sandton,...]
 */
const fs = require('fs');
const path = require('path');

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

function titleCase(input) {
  return String(input)
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(s => s[0].toUpperCase() + s.slice(1))
    .join(' ');
}

function listAreas(root) {
  const dir = path.join(root, 'irrigation');
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['sprinkler-repair','products','drip-irrigation-systems','shop'].includes(d.name))
    .map(d => d.name);
}

function retrofitFile(filePath, areaSlug, suburbSlug) {
  let html = fs.readFileSync(filePath, 'utf8');

  // Remove accidental duplicate HTML documents appended after </html>.
  const dupIdx = html.indexOf('\n</html>\n<!DOCTYPE html>');
  if (dupIdx !== -1) {
    html = html.slice(0, html.indexOf('</html>') + 7);
  }

  const areaTitle = titleCase(areaSlug.replace(/-/g, ' '));
  const suburbTitle = titleCase(suburbSlug.replace(/-/g, ' '));
  const block = [
    `<a href="/irrigation/${areaSlug}/${suburbSlug}/sprinkler-repair.html">Sprinkler Repair – ${suburbTitle}</a>`,
    `<a href="/irrigation/${areaSlug}/${suburbSlug}/irrigation-installation.html">Irrigation Installation – ${suburbTitle}</a>`,
    `<a href="/irrigation/${areaSlug}/${suburbSlug}/irrigation-maintenance.html">Maintenance Plans – ${suburbTitle}</a>`,
    `<a href="/irrigation/${areaSlug}/${suburbSlug}/irrigation-products.html">Irrigation Products – ${suburbTitle}</a>`,
    `<a href="/irrigation/${areaSlug}/">Back to ${areaTitle}</a>`
  ].join('\n          ');

  // Try to find the local-service-areas section grid and replace its inner HTML.
  const markerStart = '<div class="suburb-list-grid">';
  const idxStart = html.indexOf(markerStart);
  if (idxStart !== -1) {
    const idxEnd = html.indexOf('</div>', idxStart);
    if (idxEnd !== -1) {
      const before = html.slice(0, idxStart + markerStart.length);
      const after = html.slice(idxEnd);
      html = `${before}\n          ${block}${after}`;
    }
  }

  fs.writeFileSync(filePath, html, 'utf8');
  return true;
}

function main() {
  const ROOT = process.cwd();
  const args = process.argv.slice(2);
  const areasArgIdx = args.findIndex(a => a === '--areas');
  let areas = [];
  if (areasArgIdx !== -1) {
    areas = (args[areasArgIdx + 1] || '').split(',').map(s => s.trim()).filter(Boolean);
  }
  if (!areas.length) {
    areas = listAreas(ROOT);
  }

  let updated = 0;
  for (const area of areas) {
    const areaDir = path.join(ROOT, 'irrigation', slugify(area));
    if (!fs.existsSync(areaDir)) continue;
    const entries = fs.readdirSync(areaDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of entries) {
      const suburbSlug = d.name;
      const filePath = path.join(areaDir, suburbSlug, 'index.html');
      if (fs.existsSync(filePath)) {
        retrofitFile(filePath, path.basename(areaDir), suburbSlug);
        updated++;
        console.log('Updated', filePath);
      }
    }
  }
  console.log(`Done. Updated ${updated} suburb index pages.`);
}

main();
