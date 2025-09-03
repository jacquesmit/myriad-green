#!/usr/bin/env node
/**
 * normalize-irrigation-service-links.js
 * Convert any irrigation service links pointing to .html files to folder URLs
 * with trailing slashes, both absolute and relative, across irrigation/.
 *
 * Example:
 *  /irrigation/pretoria/waverley/sprinkler-repair.html -> /irrigation/pretoria/waverley/sprinkler-repair/
 *  href="sprinkler-repair.html" -> href="sprinkler-repair/"
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'irrigation');

function walk(dir, acc=[]) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.history' || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) acc.push(p);
  }
  return acc;
}

function normalize(html) {
  // Absolute links with area/suburb
  html = html.replace(/href=("|')\s*(\/irrigation\/[a-z0-9-]+\/[a-z0-9-]+\/(sprinkler-repair|irrigation-installation|irrigation-maintenance|irrigation-products))\.html\/?\s*(\1)/gi,
    (m, q, base, svc, q2) => `href=${q}${base}/${q}`);

  // Relative links within suburb pages
  html = html.replace(/href=("|')\s*(\.\/)?(sprinkler-repair|irrigation-installation|irrigation-maintenance|irrigation-products)\.html\/?\s*(\1)/gi,
    (m, q, dot, svc, q2) => `href=${q}${svc}/${q}`);

  return html;
}

function main(){
  const files = walk(BASE);
  let changed = 0;
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8');
    const after = normalize(before);
    if (after !== before) {
      fs.writeFileSync(f, after, 'utf8');
      console.log('Updated links:', path.relative(ROOT, f));
      changed++;
    }
  }
  console.log(`Done. Updated ${changed} files.`);
}

main();
