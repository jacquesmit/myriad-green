#!/usr/bin/env node
/**
 * Ensure every irrigation page shows the same number of products
 * as the irrigation hub (irrigation/index.html) in the Featured Products section.
 *
 * Behavior:
 * - Detect target count from the hub's product grid (<article class="product-card"> elements).
 * - For each /irrigation/**.html with <section id="featured-irrigation-products">:
 *   - If product-grid has more items than target, trim extras (keep first N).
 *   - If fewer, clone the last item until reaching N (preserve existing content).
 *   - If no product-grid or no items, skip (non-destructive for pages without that section).
 */
const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip preview/template directory to avoid toggling its example grid
      if (p.toLowerCase().includes(path.join('irrigation', '_preview').toLowerCase())) continue;
      walk(p, acc);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      // Skip any _preview html just in case
      if (p.toLowerCase().includes(path.join('irrigation', '_preview').toLowerCase())) continue;
      acc.push(p);
    }
  }
  return acc;
}

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content, 'utf8'); }

function countHubProducts(hubHtml) {
  // Support both legacy and canonical ids; consider all matches and take the max count found.
  const sections = hubHtml.match(new RegExp('<section[^>]*id=["\'](?:featured-irrigation-products|featured-products)["\'][^>]*>[\\s\\S]*?<\\/section>', 'gi')) || [];
  if (sections.length === 0) return 4; // sensible default
  let maxCount = 0;
  for (const sec of sections) {
    const grid = sec.match(/<div[^>]*class=["'][^"']*product-grid[^"']*["'][^>]*>[\s\S]*?<\/div>/i);
    if (!grid) continue;
    const count = (grid[0].match(/<article\s+class=["']product-card["']/gi) || []).length;
    if (count > maxCount) maxCount = count;
  }
  return maxCount || 4;
}

function adjustGridToCount(html, target) {
  // Patch both canonical and legacy Featured Products sections
  const patch = (input, idRe) => input.replace(new RegExp(`(<section[^>]*id=["']${idRe}["'][^>]*>)([\\s\\S]*?)(<\\/section>)`, 'i'),
    (secFull, secStart, secInner, secEnd) => {
      const replacedInner = secInner.replace(/(<div[^>]*class=["'][^"']*product-grid[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i,
        (gridFull, gridStart, gridInner, gridEnd) => {
          const items = gridInner.split(/(?=<article\s+class=["']product-card["'])/i).filter(Boolean);
          const currentCount = (gridInner.match(/<article\s+class=["']product-card["']/gi) || []).length;
          if (currentCount === 0) return gridFull; // nothing to do
          if (currentCount === target) return gridFull; // already aligned
          let newItems;
          if (currentCount > target) {
            newItems = items.slice(0, target);
          } else {
            newItems = items.slice();
            const last = items[items.length - 1];
            while (newItems.length < target) newItems.push(last);
          }
          return `${gridStart}${newItems.join('')}${gridEnd}`;
        }
      );
      return `${secStart}${replacedInner}${secEnd}`;
    }
  );
  let out = html;
  const before = out;
  out = patch(out, '(?:featured-irrigation-products|featured-products)');
  return out;
}

function main() {
  const ROOT = process.cwd();
  const base = path.join(ROOT, 'irrigation');
  const hubPath = path.join(base, 'index.html');
  if (!fs.existsSync(hubPath)) {
    console.error('Hub page not found:', hubPath);
    process.exit(1);
  }
  const hubHtml = read(hubPath);
  const targetCount = countHubProducts(hubHtml);
  console.log('Target product count:', targetCount);

  let patched = 0;
  for (const file of walk(base)) {
    const lower = file.toLowerCase();
    if (lower.includes(`${path.sep}_preview${path.sep}`) || lower.includes('/_preview/')) {
      continue;
    }
    const html = read(file);
    if (!/id=["'](?:featured-irrigation-products|featured-products)["']/i.test(html)) continue;
    const updated = adjustGridToCount(html, targetCount);
    if (updated !== html) {
      write(file, updated);
      console.log('Patched', file);
      patched++;
    }
  }
  console.log(`Done. Patched ${patched} files.`);
}

main();
