const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GLOB_ROOT = path.join(ROOT, 'water-storage-tanks');

function walk(dir, acc = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, acc);
    else if (d.isFile() && p.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function update(html) {
  let changed = false;
  const replacements = [
    ['href="/shop/jojo-tank-2500l"', 'href="/shop/jojo-tank-5000l"'],
    ['data-id="jojo-tank-2500l"', 'data-id="jojo-tank-5000l"'],
  ];
  for (const [from, to] of replacements) {
    const next = html.split(from).join(to);
    if (next !== html) { html = next; changed = true; }
  }
  return { html, changed };
}

function main() {
  const files = walk(GLOB_ROOT);
  let touched = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('/shop/jojo-tank-2500l') && !src.includes('data-id="jojo-tank-2500l"')) continue;
    const { html, changed } = update(src);
    if (changed) {
      fs.writeFileSync(file, html, 'utf8');
      console.log('Updated', path.relative(ROOT, file));
      touched++;
    }
  }
  console.log('Done. Updated files:', touched);
}

if (require.main === module) main();
