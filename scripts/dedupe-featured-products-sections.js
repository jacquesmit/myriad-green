#!/usr/bin/env node
/**
 * dedupe-featured-products-sections.js
 *
 * Goal: Ensure each HTML page has at most one Featured Products section.
 * - Keep the first canonical <section id="featured-products"> block.
 * - Remove any subsequent canonical duplicates.
 * - If a canonical exists, remove legacy/class-only featured-products blocks,
 *   including variants like class="featured-products section" and
 *   class-only with aria-labelledby="products-heading" or "parts-heading".
 * - Also strip any legacy id="featured-irrigation-products" blocks entirely.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIRS = [path.join(ROOT, 'irrigation')];

function walk(dir, acc = []){
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()){
      if (e.name === '_preview' || e.name.startsWith('.')) continue;
      walk(p, acc);
    } else if (e.isFile() && e.name.endsWith('.html')){
      acc.push(p);
    }
  }
  return acc;
}

function read(file){ return fs.readFileSync(file, 'utf8'); }
function write(file, c){ fs.writeFileSync(file, c, 'utf8'); }

function findSectionRange(html, token){
  const tokenPos = html.indexOf(token);
  if (tokenPos === -1) return null;
  const start = html.lastIndexOf('<section', tokenPos);
  if (start === -1) return null;
  // Walk until matching </section> (simple depth tracker on <section ...>)
  let idx = start;
  let depth = 0;
  while (idx < html.length){
    const nextOpen = html.indexOf('<section', idx + 1);
    const nextClose = html.indexOf('</section>', idx + 1);
    if (nextClose === -1) return null; // malformed
    if (nextOpen !== -1 && nextOpen < nextClose){
      depth++;
      idx = nextOpen;
    } else {
      if (depth === 0){
        const end = nextClose + '</section>'.length;
        return { start, end };
      } else {
        depth--;
        idx = nextClose + '</section>'.length - 1;
      }
    }
  }
  return null;
}

function dedupe(html){
  let out = html;
  let changed = false;

  // Remove legacy id="featured-irrigation-products" blocks completely
  let guardLegacy = 0;
  while (out.includes('id="featured-irrigation-products"') && guardLegacy < 50){
    const r = findSectionRange(out, 'id="featured-irrigation-products"');
    if (!r) break;
    out = out.slice(0, r.start) + out.slice(r.end);
    changed = true;
    guardLegacy++;
  }

  // Count canonical occurrences and keep only the first
  let firstFoundIdx = out.indexOf('id="featured-products"');
  if (firstFoundIdx !== -1){
    // Remove any further canonical duplicates
    let searchFrom = firstFoundIdx + 1;
    let guard = 0;
    while (guard < 100){
      const nextIdx = out.indexOf('id="featured-products"', searchFrom);
      if (nextIdx === -1) break;
      const r2 = findSectionRange(out, 'id="featured-products"');
      if (!r2) break;
      // We are at the first occurrence again if r2.start === firstRange.start,
      // so advance searchFrom to skip it and find the true next one.
      if (r2.start <= firstFoundIdx){
        searchFrom = firstFoundIdx + 1;
        // Find next occurrence beyond this instance to compute the range correctly.
        const nextAfterFirst = out.indexOf('id="featured-products"', firstFoundIdx + 1);
        if (nextAfterFirst === -1) break;
        const r3 = findSectionRange(out, out.slice(nextAfterFirst, nextAfterFirst + 'id="featured-products"'.length));
        // If r3 cannot be found via token slice (unlikely), fallback to generic token again.
        const rangeToRemove = r3 || findSectionRange(out, 'id="featured-products"');
        if (!rangeToRemove) break;
        out = out.slice(0, rangeToRemove.start) + out.slice(rangeToRemove.end);
        changed = true;
        // Do not update firstFoundIdx; keep the first.
        searchFrom = firstFoundIdx + 1;
      } else {
        // Remove range at nextIdx
        const rNext = findSectionRange(out, 'id="featured-products"');
        if (!rNext) break;
        out = out.slice(0, rNext.start) + out.slice(rNext.end);
        changed = true;
        searchFrom = firstFoundIdx + 1;
      }
      guard++;
    }

    // With a canonical present, remove legacy class-only featured-products variants
    const legacyTokens = [
      'class="featured-products section"',
      'class="featured-products" aria-labelledby="products-heading"',
      'class="featured-products" aria-labelledby="parts-heading"'
    ];
    for (const t of legacyTokens){
      let g = 0;
      while (out.includes(t) && g < 50){
        const r = findSectionRange(out, t);
        if (!r) break;
        out = out.slice(0, r.start) + out.slice(r.end);
        changed = true;
        g++;
      }
    }
  }

  return { html: out, changed };
}

function main(){
  let totalPatched = 0;
  for (const base of TARGET_DIRS){
    const files = walk(base);
    for (const f of files){
      const html = read(f);
      if (!/featured-products/.test(html)) continue;
      const { html: updated, changed } = dedupe(html);
      if (changed){
        write(f, updated);
        totalPatched++;
        console.log('Patched', f);
      }
    }
  }
  console.log('Done. Patched', totalPatched, 'files.');
}

main();
