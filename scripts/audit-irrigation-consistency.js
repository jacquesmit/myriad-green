#!/usr/bin/env node
/**
 * audit-irrigation-consistency.js
 * Scans the irrigation/ tree for consistency:
 *  - H1 present with id="page-h1" and data-page-key, data-city, data-suburb
 *  - Weather widget present with data-suburb
 *  - CSS includes irrigation sections stylesheet
 *  - Canonical tag presence (report-only)
 *  - Reports summary and lists offending files by category
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'irrigation');

function walk(dir, acc=[]) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.history' || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && /\.html$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

function auditFile(file){
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');

  const h1Match = html.match(/<h1[^>]*id=["']page-h1["'][^>]*>/i);
  let h1HasAttrs = false;
  if (h1Match) {
    const h1 = h1Match[0];
    h1HasAttrs = /data-page-key=/i.test(h1) && /data-city=/i.test(h1) && /data-suburb=/i.test(h1);
  }

  const weatherMatch = html.match(/<div[^>]*id=["']weather-widget["'][^>]*>/i);
  let weatherHasSuburb = false;
  if (weatherMatch) {
    const w = weatherMatch[0];
    weatherHasSuburb = /data-suburb=["'][^"']+["']/i.test(w);
  }

  const hasIrrCss = /<link[^>]+href=["'][^"']*irrigation-sections\.css["'][^>]*>/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);

  return {
    file: rel,
    h1Present: !!h1Match,
    h1HasAttrs,
    weatherPresent: !!weatherMatch,
    weatherHasSuburb,
    hasIrrCss,
    hasCanonical,
  };
}

function main(){
  const files = walk(DIR);
  if (!files.length) {
    console.log('No irrigation HTML files found.');
    return;
  }
  const results = files.map(auditFile);

  const problems = {
    missingH1: [],
    h1MissingAttrs: [],
    missingWeather: [],
    weatherMissingSuburb: [],
    missingIrrCss: [],
    missingCanonical: [],
  };

  for (const r of results){
    if (!r.h1Present) problems.missingH1.push(r.file);
    else if (!r.h1HasAttrs) problems.h1MissingAttrs.push(r.file);
    if (!r.weatherPresent) problems.missingWeather.push(r.file);
    else if (!r.weatherHasSuburb) problems.weatherMissingSuburb.push(r.file);
    if (!r.hasIrrCss) problems.missingIrrCss.push(r.file);
    if (!r.hasCanonical) problems.missingCanonical.push(r.file);
  }

  const summary = {
    total: results.length,
    h1Ok: results.filter(r => r.h1Present && r.h1HasAttrs).length,
    weatherOk: results.filter(r => r.weatherPresent && r.weatherHasSuburb).length,
    irrCssOk: results.filter(r => r.hasIrrCss).length,
    canonicalPresent: results.filter(r => r.hasCanonical).length,
  };

  console.log('Irrigation audit summary:', summary);
  for (const [k, v] of Object.entries(problems)){
    if (v.length) {
      console.log(`\n${k} (${v.length}):`);
      v.slice(0, 50).forEach(f => console.log('-', f));
      if (v.length > 50) console.log(`...and ${v.length - 50} more`);
    }
  }
}

main();
