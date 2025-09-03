#!/usr/bin/env node
// Quick internal link checker for irrigation pages.
// - Scans irrigation HTML files (excludes .history)
// - Collects href/src candidates pointing to local HTML paths
// - Resolves root-absolute (/irrigation/...) and relative links
// - Reports missing targets and any -hatfield.html references
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_ROOT = path.join(ROOT);
const argDir = process.argv[2];
const TARGET_DIR = path.isAbsolute(argDir || '')
  ? argDir
  : path.join(SITE_ROOT, argDir || 'irrigation');

/** Utility: walk directory recursively, ignoring common folders */
const IGNORE_DIRS = new Set(['.history', 'node_modules', '.git', '.vscode']);
function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
  if (IGNORE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** Normalize and check if a local path exists */
function existsLocal(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

let scanRoot = TARGET_DIR;
if (!fs.existsSync(scanRoot)) {
  console.warn('Scan root does not exist, falling back to irrigation:', scanRoot);
  scanRoot = path.join(SITE_ROOT, 'irrigation');
}
const htmlFiles = walk(scanRoot).filter(f => f.toLowerCase().endsWith('.html'));
const missingHtml = [];
const missingAssets = [];
const hatfieldVariants = [];
const seen = new Set();

const HREF_RE = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;

function isExternal(url) {
  return /^(?:https?:)?\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:');
}

function resolveTarget(fromFile, url) {
  if (url.startsWith('#')) return null; // anchor only
  // Only check html files within project
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return null;

  if (clean.startsWith('/')) {
    // Root-absolute on site
    const targetAbs = path.join(SITE_ROOT, clean.replace(/^\//, ''));
    return targetAbs;
  } else {
    // Relative to fromFile dir
    const baseDir = path.dirname(fromFile);
    return path.normalize(path.join(baseDir, clean));
  }
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = HREF_RE.exec(html)) !== null) {
  // m[1] is the quote, m[2] is the captured URL
  const url = m[2];
    if (isExternal(url)) continue;
    const target = resolveTarget(file, url);
    if (!target) continue;

    // Only check local files
    if (!target.startsWith(SITE_ROOT)) continue;

    // HTML links
    if (/\.html?$/i.test(target)) {
      // Record any -hatfield variants in live tree
      if (/\-hatfield\.html$/i.test(target)) {
        hatfieldVariants.push({ from: file, url });
      }
      if (!existsLocal(target)) {
        const key = `HTML ${file} -> ${url}`;
        if (!seen.has(key)) {
          seen.add(key);
          missingHtml.push({ from: file, url, resolved: target });
        }
      }
      continue;
    }

    // Asset links (css/js/images/fonts)
    if (/\.(?:css|js|png|jpe?g|svg|webp|gif|ico|woff2?|ttf|otf|eot)$/i.test(target)) {
      if (!existsLocal(target)) {
        const key = `ASSET ${file} -> ${url}`;
        if (!seen.has(key)) {
          seen.add(key);
          missingAssets.push({ from: file, url, resolved: target });
        }
      }
      continue;
    }
  }
}

if (hatfieldVariants.length) {
  console.log('Found links to -hatfield.html variants:');
  for (const v of hatfieldVariants) console.log('-', path.relative(SITE_ROOT, v.from), '=>', v.url);
} else {
  console.log('No links to -hatfield.html variants found.');
}

if (missingHtml.length) {
  console.log(`Missing HTML link targets (${missingHtml.length}):`);
  for (const m of missingHtml) console.log('-', path.relative(SITE_ROOT, m.from), '=>', m.url, '=>', path.relative(SITE_ROOT, m.resolved));
} else {
  console.log('All internal HTML links resolve to existing files.');
}

if (missingAssets.length) {
  console.log(`Missing asset targets (${missingAssets.length}):`);
  for (const m of missingAssets) console.log('-', path.relative(SITE_ROOT, m.from), '=>', m.url, '=>', path.relative(SITE_ROOT, m.resolved));
}

if (missingHtml.length || missingAssets.length) {
  process.exitCode = 1;
}
