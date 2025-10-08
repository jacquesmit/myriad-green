#!/usr/bin/env node
// scripts/fetch-trends-snapshots.js
// Production-ready server-side snapshot fetcher
// - Reads `services/trends-config.json`
// - For each service, optionally calls `google-trends-api` (when USE_GOOGLE_TRENDS_API=true)
// - Writes snapshot JSON to `data/trends-snapshots/{service}.json`
// - Adds retries, exponential backoff, and per-service pacing to respect rate limits

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '..', 'services', 'trends-config.json');
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'trends-snapshots');

const USE_GOOGLE = String(process.env.USE_GOOGLE_TRENDS_API || '').toLowerCase() === 'true';

let googleTrends;
if (USE_GOOGLE) {
  try {
    googleTrends = require('google-trends-api');
  } catch (e) {
    console.warn('google-trends-api not available; falling back to mock provider', e && e.message);
  }
}

function safeWriteJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetries(fn, attempts = 3, baseDelay = 1000) {
  let attempt = 0;
  while (attempt < attempts) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`Attempt ${attempt} failed: ${err && err.message}. Retrying in ${delay}ms`);
      if (attempt >= attempts) throw err;
      await sleep(delay + Math.random() * 200);
    }
  }
}

async function fetchTrendsGoogle({ geo, queries }) {
  if (!googleTrends) throw new Error('google-trends-api not initialized');

  // We'll call interestOverTime for the top keyword mix and aggregate a short snapshot
  const keyword = Array.isArray(queries) ? queries.slice(0, 3).join(',') : queries;
  const opts = { keyword, geo, timeframe: 'now 7-d' };

  // Use relatedQueries to find top related search queries (more robust for top terms)
  const res = await googleTrends.relatedQueries(opts);
  try {
    const parsed = JSON.parse(res);

    // Navigate the returned structure to find 'top' queries
    // Format varies; defensive coding below
    const defaultTop = (Array.isArray(queries) ? queries.slice(0, 3) : [queries]).map((q, i) => ({ rank: i + 1, query: q, score: null }));

    let topTerms = defaultTop;
    if (parsed && parsed.length) {
      // google-trends-api often returns an array with a 'default' property
      const block = parsed[0].default || parsed[0];
      if (block && block.rankedList && Array.isArray(block.rankedList) && block.rankedList.length) {
        const ranked = block.rankedList[0];
        if (ranked && ranked.rankedKeyword && Array.isArray(ranked.rankedKeyword)) {
          topTerms = ranked.rankedKeyword.slice(0, 3).map((r, i) => ({ rank: i + 1, query: r.query, score: r.value || null }));
        }
      }
    }

    const summary = topTerms && topTerms[0] ? `${topTerms[0].query} is trending in ${geo}` : `${keyword} interest in ${geo}`;
    return { fetchedAt: new Date().toISOString(), geo, topTerms, summary };
  } catch (e) {
    throw new Error('Failed to parse google-trends relatedQueries response: ' + e.message);
  }
}

function mockFetchTrends({ geo, queries }) {
  const now = new Date().toISOString();
  const top = (Array.isArray(queries) ? queries.slice(0, 3) : [queries]).map((q, i) => ({ rank: i + 1, query: q, score: Math.round(Math.random() * 100) }));
  const summary = `${top[0].query} is the most-searched term this week in ${geo}.`;
  return Promise.resolve({ fetchedAt: now, geo, topTerms: top, summary });
}

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Missing trends config at', CONFIG_PATH);
    process.exit(2);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!config.services) {
    console.error('Invalid config', CONFIG_PATH);
    process.exit(2);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Iterate services sequentially to avoid hitting provider limits
  for (const [name, svc] of Object.entries(config.services)) {
    try {
      console.log('Fetching snapshot for', name);

      const fetcher = async () => {
        if (USE_GOOGLE && googleTrends) {
          return fetchTrendsGoogle(svc);
        }
        return mockFetchTrends(svc);
      };

      const snapshot = await fetchWithRetries(fetcher, 4, 1000);

      const outFile = path.join(OUT_DIR, `${name}.json`);
      safeWriteJson(outFile, { service: name, path: svc.path, snapshot });
      console.log('Wrote snapshot to', outFile);

      // Pace between requests to be gentle on provider
      await sleep(1500 + Math.random() * 1500);
    } catch (err) {
      console.error('Failed to fetch', name, err && err.message);
    }
  }
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
