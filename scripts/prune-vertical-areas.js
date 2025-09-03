#!/usr/bin/env node
/**
 * prune-vertical-areas.js
 * Quickly remove non-applicable areas or suburbs from specified verticals.
 * Usage:
 *   node scripts/prune-vertical-areas.js <vertical> --areas=comma,list --suburbs=area:suburb1|suburb2,area2:suburbA
 * Examples:
 *   node scripts/prune-vertical-areas.js landscaping --areas=johannesburg,midrand
 *   node scripts/prune-vertical-areas.js pumps --suburbs=pretoria:hatfield|brooklyn,sandton:hyde-park
 */
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function rmDirSafe(p){ if (!fs.existsSync(p)) return; fs.rmSync(p, { recursive: true, force: true }); console.log('Removed', p); }

function parseArgs(){
  const [,, vertical, ...rest] = process.argv;
  if (!vertical) { console.error('Usage: node scripts/prune-vertical-areas.js <vertical> [--areas=..] [--suburbs=..]'); process.exit(1);} 
  const opts = { vertical, areas: [], suburbs: {} };
  for (const arg of rest){
    if (arg.startsWith('--areas=')){
      const v = arg.split('=')[1];
      if (v) opts.areas = v.split(',').map(s=>s.trim()).filter(Boolean);
    } else if (arg.startsWith('--suburbs=')){
      const v = arg.split('=')[1];
      if (v){
        for (const group of v.split(',')){
          const [area, subs] = group.split(':');
          if (!area || !subs) continue;
          opts.suburbs[area.trim()] = subs.split('|').map(s=>s.trim()).filter(Boolean);
        }
      }
    }
  }
  return opts;
}

function main(){
  const { vertical, areas, suburbs } = parseArgs();
  const base = path.join(ROOT, vertical);
  if (!fs.existsSync(base)) { console.error('Missing vertical', base); process.exit(1);} 

  // Remove entire areas
  for (const a of areas){ rmDirSafe(path.join(base, a)); }
  // Remove specific suburbs per area
  for (const [area, subs] of Object.entries(suburbs)){
    for (const s of subs){ rmDirSafe(path.join(base, area, s)); }
  }
  console.log('Done.');
}

main();
