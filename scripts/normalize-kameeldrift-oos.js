#!/usr/bin/env node
/**
 * Normalize 'Kameeldrift Oos' naming and links across irrigation/Pretoria HTML files.
 * - href="/irrigation/pretoria/kameldrift-oos/" -> /irrigation/pretoria/kameeldrift-oos/
 * - Visible text 'Kameldrift Oos' -> 'Kameeldrift Oos'
 * - Hyphenated 'Kameldrift-Oos' -> 'Kameeldrift-Oos'
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'irrigation', 'pretoria');

/** Recursively list files in a directory */
function listFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/** Apply content replacements */
function normalize(content) {
  return content
    // Normalize URLs first
    .replace(/\/irrigation\/pretoria\/kameldrift-oos\//g, '/irrigation/pretoria/kameeldrift-oos/')
    // Visible text variants
    .replace(/Kameldrift-Oos/g, 'Kameeldrift-Oos')
    .replace(/Kameldrift Oos/g, 'Kameeldrift Oos')
    // Also lower-case slug in plain text if exists (rare)
    .replace(/kameldrift-oos/g, 'kameeldrift-oos');
}

function run() {
  if (!fs.existsSync(TARGET_DIR)) {
    console.error('Target directory not found:', TARGET_DIR);
    process.exit(1);
  }
  const files = listFiles(TARGET_DIR).filter(f => f.toLowerCase().endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = normalize(before);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changed++;
      console.log('Updated:', path.relative(ROOT, file));
    }
  }
  console.log(`Done. Files changed: ${changed}/${files.length}`);
}

run();
