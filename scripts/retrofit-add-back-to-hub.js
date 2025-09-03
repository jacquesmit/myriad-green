#!/usr/bin/env node
/**
 * Insert a standard "Back to {Suburb} hub" link on irrigation service pages
 * under /irrigation/{area}/{suburb}/<service>.html when missing.
 * - Detect hero section and insert backlink right after it; fallback to after <main>.
 * - Skip index.html and non-suburb pages.
 */
const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && entry.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function toTitle(s) {
  return s ? s.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ') : '';
}

function main() {
  const ROOT = process.cwd();
  const base = path.join(ROOT, 'irrigation');
  if (!fs.existsSync(base)) return;
  const files = walk(base);
  let patched = 0;
  for (const file of files) {
    const rel = file.replace(/\\/g, '/').split('/irrigation/')[1];
    if (!rel) continue;
    const parts = rel.split('/');
    // Expect structure: {area}/{suburb}/{file}.html
    const area = parts[0];
    const suburb = parts[1];
    const fname = parts[2] || '';
    if (!area || !suburb || !fname || fname.toLowerCase() === 'index.html') continue;
    if (/\.history\//i.test(file)) continue;
    // Only service pages inside suburb folder
    const areaIsFile = /\.html$/i.test(area);
    const suburbIsFile = /\.html$/i.test(suburb);
    if (areaIsFile || suburbIsFile) continue;

    const hubHref = `/irrigation/${area}/${suburb}/`;
    let html = fs.readFileSync(file, 'utf8');
    // If already linked back to hub, skip
    if (new RegExp(`href=["']${hubHref}["']`, 'i').test(html)) continue;

    const suburbTitle = toTitle(suburb);
    const snippet = `\n<section class="local-backlink" aria-label="Back to hub">\n  <div class="container">\n    <a class="back-link" href="${hubHref}">\u2190 Back to ${suburbTitle} hub</a>\n  </div>\n</section>\n`;

    let updated = html;
    // Prefer to insert right after hero section
    const heroCloseRe = /(<section[^>]*class=["'][^"']*hero-irrigation[^"']*["'][^>]*>[\s\S]*?<\/section>)/i;
    if (heroCloseRe.test(updated)) {
      updated = updated.replace(heroCloseRe, (m) => `${m}${snippet}`);
    } else {
      // Fallback: after opening <main>
      updated = updated.replace(/(<main[^>]*>)/i, (m) => `${m}${snippet}`);
    }

    if (updated !== html) {
      fs.writeFileSync(file, updated, 'utf8');
      console.log('Patched', file);
      patched++;
    }
  }
  console.log(`Done. Patched ${patched} files.`);
}

main();
