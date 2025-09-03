/**
 * Normalize data-page-key attributes in irrigation service pages by removing a trailing .html suffix.
 *
 * Scope:
 *  - Only operates on irrigation subfolder index.html files (avoids editing legacy .html stubs)
 *  - Idempotent; skips write when no changes
 *
 * Usage:
 *  node scripts/normalize-data-page-key.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IRRIGATION_DIR = path.join(ROOT, 'irrigation');

/**
 * Recursively collect index.html files under irrigation tree
 */
function collectIndexFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectIndexFiles(p));
    } else if (entry.isFile() && entry.name.toLowerCase() === 'index.html') {
      out.push(p);
    }
  }
  return out;
}

/**
 * Normalize data-page-key values by stripping a trailing .html, supporting single or double quotes.
 */
function normalizeContent(html) {
  // Replace data-page-key="...something.html" -> data-page-key="...something"
  // and data-page-key='...something.html' -> data-page-key='...something'
  const reDouble = /(data-page-key\s*=\s*")([^"]+?)\.html(\")/g;
  const reSingle = /(data-page-key\s*=\s*')([^']+?)\.html(')/g;
  let changed = false;
  let out = html.replace(reDouble, (m, p1, key, p3) => {
    changed = true;
    return p1 + key + p3;
  });
  out = out.replace(reSingle, (m, p1, key, p3) => {
    changed = true;
    return p1 + key + p3;
  });
  return { out, changed };
}

function main() {
  if (!fs.existsSync(IRRIGATION_DIR)) {
    console.error('Irrigation directory not found:', IRRIGATION_DIR);
    process.exit(1);
  }

  const files = collectIndexFiles(IRRIGATION_DIR);
  let patched = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const { out, changed } = normalizeContent(html);
    if (changed) {
      fs.writeFileSync(file, out, 'utf8');
      console.log('Patched', file);
      patched++;
    }
  }
  console.log('Done. Patched', patched, 'files.');
}

if (require.main === module) {
  main();
}
