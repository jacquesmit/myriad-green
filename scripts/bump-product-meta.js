#!/usr/bin/env node
/*
  Bump product meta version for one or more slugs to invalidate ETag on /shop/:slug.
  Usage:
    node scripts/bump-product-meta.js slug1 slug2
  Or with explicit version:
    node scripts/bump-product-meta.js --version 2025-08-15T12:00:00Z slug1 slug2
*/
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let explicitVersion = null;
const vIdx = args.indexOf('--version');
if (vIdx !== -1) {
  explicitVersion = args[vIdx + 1] || null;
  args.splice(vIdx, explicitVersion ? 2 : 1);
}

const slugs = args.filter(Boolean);
if (slugs.length === 0) {
  console.error('Please provide at least one product slug.');
  process.exit(1);
}

const metaPath = path.join(__dirname, '..', 'data', 'product-meta.json');
let meta = {};
if (fs.existsSync(metaPath)) {
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {}; } catch {}
}

const now = new Date().toISOString();
const versionVal = explicitVersion || now;

for (const slug of slugs) {
  meta[slug] = meta[slug] || {};
  meta[slug].updatedAt = versionVal;
  // Optionally increment a numeric version
  if (typeof meta[slug].version === 'number') {
    meta[slug].version += 1;
  } else {
    meta[slug].version = 1;
  }
}

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
console.log(`Updated ${slugs.length} product(s). Version tag: ${versionVal}`);
