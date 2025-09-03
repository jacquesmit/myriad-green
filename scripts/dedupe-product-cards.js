#!/usr/bin/env node
/*
  dedupe-product-cards.js
  - Finds duplicate product cards inside product grids and removes duplicates, keeping first.
  - Dedupe key priority: product href slug from <a href="/shop/slug">, else <h3> text, else data-id on buttons.
  - Targets pages in /shop and any other pages with .product-grid.
  - Non-destructive around content outside product grids.
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/^(node_modules|.git|.history)$/i.test(e.name)) continue;
      files = files.concat(walk(p));
    } else if (e.isFile() && p.toLowerCase().endsWith('.html')) {
      files.push(p);
    }
  }
  return files;
}

function extractKey(cardHtml) {
  // try href within <a href="/shop/...">
  const hrefMatch = cardHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (hrefMatch) {
    const href = hrefMatch[1];
    const m = href.match(/\/shop\/([^\/?#]+)(?:[\/?#]|$)/i);
    if (m) return `href:${m[1].toLowerCase()}`;
    return `href:${href.toLowerCase()}`;
  }
  // else h3 text
  const h3 = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  if (h3) return `h3:${h3[1].replace(/<[^>]*>/g, '').trim().toLowerCase()}`;
  // else data-id from button
  const bid = cardHtml.match(/data-id=["']([^"']+)["']/i);
  if (bid) return `id:${bid[1].toLowerCase()}`;
  // fallback: hash snippet
  return `hash:${cardHtml.slice(0, 120).toLowerCase()}`;
}

function dedupeInContent(html) {
  // find product grids
  let changed = false;
  const gridRegex = /(<div[^>]*class=["'][^"']*product-grid[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/gi;
  html = html.replace(gridRegex, (full, open, inner, close) => {
    // split by product-card articles
    const parts = inner.split(/(<article[^>]*class=["'][^"']*product-card[^"']*["'][^>]*>[\s\S]*?<\/article>)/gi);
    if (parts.length <= 1) return full; // nothing to split
    const seen = new Set();
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (!seg) continue;
      if (/^<article/i.test(seg) && /product-card/i.test(seg)) {
        const key = extractKey(seg);
        if (seen.has(key)) {
          changed = true; // drop duplicate
          continue;
        }
        seen.add(key);
        result.push(seg);
      } else {
        result.push(seg);
      }
    }
    const newInner = result.join('');
    if (newInner !== inner) changed = true;
    return open + newInner + close;
  });
  return { html, changed };
}

(function main() {
  const files = walk(ROOT);
  let changedCount = 0;
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    if (!/product-grid/.test(content)) continue;
    const { html, changed } = dedupeInContent(content);
    if (changed) {
      fs.writeFileSync(f, html, 'utf8');
      changedCount++;
    }
  }
  console.log(`Dedupe complete. Patched ${changedCount} file(s).`);
})();
