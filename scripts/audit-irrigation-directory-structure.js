#!/usr/bin/env node
/**
 * audit-irrigation-directory-structure.js
 * Verifies irrigation/area/suburb directories have required pieces:
 *  - suburb/index.html present
 *  - service subfolders exist with index.html: sprinkler-repair, irrigation-installation,
 *    irrigation-maintenance, irrigation-products
 * Reports any missing folders/files and any leftover .html service files.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IRR = path.join(ROOT, 'irrigation');
const SERVICES = ['sprinkler-repair', 'irrigation-installation', 'irrigation-maintenance', 'irrigation-products'];

function listAreas(){
  if (!fs.existsSync(IRR)) return [];
  return fs.readdirSync(IRR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['.history','shop','products'].includes(d.name))
    .map(d => d.name);
}
function listSuburbs(areaDir){
  return fs.readdirSync(areaDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '.history')
    .map(d => d.name);
}

function main(){
  const issues = { missingIndex: [], missingServiceFolder: [], missingServiceIndex: [], leftoverServiceHtml: [] };
  for (const area of listAreas()) {
    const areaDir = path.join(IRR, area);
    for (const suburb of listSuburbs(areaDir)) {
      const suburbDir = path.join(areaDir, suburb);
      const idx = path.join(suburbDir, 'index.html');
      if (!fs.existsSync(idx)) issues.missingIndex.push(idx);
      const entries = fs.readdirSync(suburbDir, { withFileTypes: true });
      const folders = new Set(entries.filter(e => e.isDirectory()).map(e => e.name));
      for (const svc of SERVICES) {
        if (!folders.has(svc)) {
          issues.missingServiceFolder.push(path.join(suburbDir, svc));
        } else {
          const svcIdx = path.join(suburbDir, svc, 'index.html');
          if (!fs.existsSync(svcIdx)) issues.missingServiceIndex.push(svcIdx);
        }
        const svcHtml = path.join(suburbDir, `${svc}.html`);
        if (fs.existsSync(svcHtml)) issues.leftoverServiceHtml.push(svcHtml);
      }
    }
  }
  const counts = Object.fromEntries(Object.entries(issues).map(([k,v]) => [k, v.length]));
  console.log('Irrigation directory structure audit:', counts);
  for (const [k, arr] of Object.entries(issues)) {
    if (arr.length) {
      console.log(`\n${k}: ${arr.length}`);
      arr.slice(0, 100).forEach(p => console.log('-', p));
      if (arr.length > 100) console.log(`...and ${arr.length - 100} more`);
    }
  }
}

main();
