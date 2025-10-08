#!/usr/bin/env node
// scripts/inject-trends-snapshots.js
// Reads `data/trends-snapshots/*.json` and injects a small SEO-friendly snippet into the service HTML pages.
// This script is intentionally conservative: it creates a `.bak` backup and only replaces a marker region.

const fs = require('fs');
const path = require('path');

const SNAP_DIR = path.resolve(__dirname, '..', 'data', 'trends-snapshots');
const CONFIG = path.resolve(__dirname, '..', 'services', 'trends-config.json');

if (!fs.existsSync(CONFIG)) {
  console.error('Missing config', CONFIG);
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

function injectIntoHtml(htmlPath, snapshot) {
  if (!fs.existsSync(htmlPath)) {
    console.warn('HTML file not found:', htmlPath);
    return;
  }

  const raw = fs.readFileSync(htmlPath, 'utf8');
  const backup = htmlPath + '.bak';
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, raw, 'utf8');

  // Replace the entire trends__insights block to ensure we remove any legacy or duplicate insight cards
  const insightsRegex = /<div class="trends__insights">[\s\S]*?<!-- Trends CTA/m;
  const match = raw.match(insightsRegex);
  if (!match) {
    console.warn('Could not find trends__insights block in', htmlPath);
    return;
  }

  const updatedAt = snapshot.snapshot.fetchedAt || new Date().toISOString();
  const top = snapshot.snapshot.topTerms || [];

  const insightsReplacement = `
          <div class="trends__insights">
            <div class="insights__grid">

              <div class="insight-card insight-card--primary">
                <div class="insight-card__icon"><i class="fas fa-water" aria-hidden="true"></i></div>
                <div class="insight-card__content">
                  <h4 class="insight-card__title">Market Snapshot</h4>
                  <p class="insight-card__text">${escapeHtml(snapshot.snapshot.summary || '')}</p>
                  <time class="insight-card__time" datetime="${updatedAt}">Updated ${new Date(updatedAt).toLocaleDateString()}</time>
                </div>
              </div>

              <div class="insight-card insight-card--secondary">
                <div class="insight-card__icon"><i class="fas fa-search" aria-hidden="true"></i></div>
                <div class="insight-card__content">
                  <h4 class="insight-card__title">Top Search</h4>
                  <p class="insight-card__text">${escapeHtml((top[0] && top[0].query) || '')} — ${escapeHtml(String((top[0] && top[0].score) || ''))} interest score</p>
                </div>
              </div>

              <div class="insight-card insight-card--tertiary">
                <div class="insight-card__icon"><i class="fas fa-list" aria-hidden="true"></i></div>
                <div class="insight-card__content">
                  <h4 class="insight-card__title">Top Terms</h4>
                  <p class="insight-card__text">${top.map(t => escapeHtml(t.query)).slice(0,3).join(', ')}</p>
                </div>
              </div>

            </div>
            <script type="application/ld+json">
${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Trends snapshot for ${snapshot.service}`,
    "numberOfItems": top.length,
    "itemListElement": top.map((t, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": t.query
    })),
    "dateModified": updatedAt
  }, null, 2)}
            </script>
          </div>

          <!-- Trends CTA`;

  // Remove any previous TRENDS_SNAPSHOT markers to avoid duplicates
  const cleaned = raw.replace(/<!-- TRENDS_SNAPSHOT_START -->[\s\S]*?<!-- TRENDS_SNAPSHOT_END -->/g, '');

  const newHtml = cleaned.replace(insightsRegex, insightsReplacement);
  fs.writeFileSync(htmlPath, newHtml, 'utf8');
  console.log('Injected snapshot into', htmlPath);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>\"]/g, function (s) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[s];
  });
}

for (const [name, svc] of Object.entries(config.services)) {
  const snapshotFile = path.join(SNAP_DIR, `${name}.json`);
  if (!fs.existsSync(snapshotFile)) {
    console.warn('Snapshot missing for', name);
    continue;
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  const htmlPath = path.resolve(__dirname, '..', svc.path);
  injectIntoHtml(htmlPath, snapshot);
}

console.log('Done. Please review modified HTML files and commit if satisfied.');
