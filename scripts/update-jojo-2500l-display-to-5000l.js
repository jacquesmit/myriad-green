const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GLOB_ROOT = path.join(ROOT, 'water-storage-tanks');
const TARGET_IMG = '/images/mrg products/Eco tanks/Green/Eco_Tank_5000L_V_Eco_Green_resized.png';
const NEW_NAME = 'JoJo Water Tank 5000L';

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && p.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function replaceNearCard(html) {
  let changed = false;

  // Update display text and attributes first (broad but specific)
  const replacements = [
    { re: /<h3>\s*Jojo Tank 2500l\s*<\/h3>/gi, to: '<h3>' + NEW_NAME + '</h3>' },
    { re: /data-name="Jojo Tank 2500l"/gi, to: 'data-name="' + NEW_NAME + '"' },
    { re: /aria-label="Buy Jojo Tank 2500l now"/gi, to: 'aria-label="Buy ' + NEW_NAME + ' now"' },
    { re: /alt="Jojo Tank 2500l"/gi, to: 'alt="' + NEW_NAME + '"' },
  ];
  for (const { re, to } of replacements) {
    const next = html.replace(re, to);
    if (next !== html) { html = next; changed = true; }
  }

  // Targeted image swap for the jojo card only
  const linkMarker = '<a href="/shop/jojo-tank-2500l"';
  let searchFrom = 0;
  while (true) {
    const linkIdx = html.indexOf(linkMarker, searchFrom);
    if (linkIdx === -1) break;
    const figStart = html.indexOf('<figure>', linkIdx);
    const imgStart = figStart !== -1 ? html.indexOf('<img', figStart) : -1;
    const imgEnd = imgStart !== -1 ? html.indexOf('>', imgStart) : -1;
    if (imgStart !== -1 && imgEnd !== -1 && imgEnd > imgStart) {
      const newImg = `<img src="${TARGET_IMG}" alt="${NEW_NAME}" loading="lazy" decoding="async">`;
      html = html.slice(0, imgStart) + newImg + html.slice(imgEnd + 1);
      changed = true;
      searchFrom = imgStart + newImg.length;
    } else {
      // Fallback: not a standard structure, move past this link
      searchFrom = linkIdx + linkMarker.length;
    }
  }

  return { html, changed };
}

function main() {
  const files = walk(GLOB_ROOT);
  let touched = 0;
  files.forEach((file) => {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('/shop/jojo-tank-2500l')) return;
    const { html, changed } = replaceNearCard(src);
    if (changed) {
      fs.writeFileSync(file, html, 'utf8');
      touched++;
      console.log('Updated', path.relative(ROOT, file));
    }
  });
  console.log('Done. Updated files:', touched);
}

if (require.main === module) main();
