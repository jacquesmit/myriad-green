#!/usr/bin/env node
/**
 * enforce-product-grid-count-generic.js
 * Ensures Featured Products grids under id="featured-products" across non-irrigation verticals
 * have the same count as their vertical root hub's grid.
 *
 * Usage: node scripts/enforce-product-grid-count-generic.js [vertical]
 */
const fs = require('fs');
const path = require('path');

const VERTICALS = ['boreholes','pumps','water-storage-tanks','rain-water-harvesting','water-filtration','leak-detection','landscaping','grey-water-systems','waste-water-systems'];

function read(f){ return fs.readFileSync(f,'utf8'); }
function write(f,c){ fs.writeFileSync(f,c,'utf8'); }
function walk(dir, acc=[]) { for (const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory()) walk(p,acc); else if(e.isFile()&&e.name.endsWith('.html')) acc.push(p);} return acc; }

function countHubProducts(html){
  const sectionMatch = html.match(/<section[^>]*id=["']featured-products["'][^>]*>[\s\S]*?<\/section>/i);
  if (!sectionMatch) return 4;
  const grid = sectionMatch[0].match(/<div[^>]*class=["'][^"']*product-grid[^"']*["'][^>]*>[\s\S]*?<\/div>/i);
  if (!grid) return 4;
  const count = (grid[0].match(/<article\s+class=["']product-card["']/gi) || []).length;
  return count || 4;
}

function adjustGrid(html, target){
  return html.replace(/(<section[^>]*id=["']featured-products["'][^>]*>)([\s\S]*?)(<\/section>)/i,
    (secFull, secStart, secInner, secEnd) => {
      const replacedInner = secInner.replace(/(<div[^>]*class=["'][^"']*product-grid[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i,
        (gridFull, gridStart, gridInner, gridEnd) => {
          const items = gridInner.split(/(?=<article\s+class=["']product-card["'])/i).filter(Boolean);
          const currentCount = (gridInner.match(/<article\s+class=["']product-card["']/gi) || []).length;
          if (currentCount === 0) return gridFull;
          if (currentCount === target) return gridFull;
          let newItems;
          if (currentCount > target) newItems = items.slice(0, target); else { newItems = items.slice(); const last = items[items.length-1]; while (newItems.length < target) newItems.push(last); }
          return `${gridStart}${newItems.join('')}${gridEnd}`;
        }
      );
      return `${secStart}${replacedInner}${secEnd}`;
    }
  );
}

function main(){
  const ROOT = process.cwd();
  const arg = process.argv[2];
  const targets = arg ? [arg] : VERTICALS;
  for (const v of targets){
    const base = path.join(ROOT, v);
    const hub = path.join(base, 'index.html');
    if (!fs.existsSync(hub)) continue;
    const hubHtml = read(hub);
    const targetCount = countHubProducts(hubHtml);
    let patched = 0;
    for (const f of walk(base)){
      const html = read(f);
      if (!/id=["']featured-products["']/i.test(html)) continue;
      const updated = adjustGrid(html, targetCount);
      if (updated !== html){ write(f, updated); patched++; console.log('Patched', f); }
    }
    console.log(`[${v}] Enforced product grid count: ${targetCount}. Patched ${patched} files.`);
  }
}

main();
