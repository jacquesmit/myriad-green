#!/usr/bin/env node
/**
 * Generate sitemap.xml and robots.txt for the current static site structure.
 * - Discovers HTML entry points and canonicalizes to extensionless URLs for services
 * - Uses trailing slashes for directory index pages
 * - Excludes legacy redirect stubs (simple meta refresh pages)
 * - Reads SITE_BASE_URL from env or falls back to http://localhost:3000
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIRS = [
  '',
  'irrigation',
  'shop',
  'blog',
  'boreholes',
  'landscaping',
  'leak-detection',
  'pumps',
  'rain-water-harvesting',
  'waste-water-systems',
  'water-filtration',
  'water-storage-tanks',
];

const BASE_URL = (process.env.SITE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

function isHtml(file) { return file.toLowerCase().endsWith('.html'); }
function isIndex(file) { return /(^|\\|\/)index\.html$/i.test(file); }

function isRedirectStub(fullPath) {
  // Heuristic: tiny file (< 1.5KB) that contains meta refresh to a canonical irrigation path
  try {
    const stat = fs.statSync(fullPath);
    if (stat.size > 1536) return false;
    const html = fs.readFileSync(fullPath, 'utf8');
    return /<meta[^>]+http-equiv=["']refresh["']/i.test(html) && /url=\//i.test(html);
  } catch {
    return false;
  }
}

function collectUrls() {
  const urls = new Set();

  const walk = (dirRel) => {
    const dirAbs = path.join(ROOT, dirRel);
    if (!fs.existsSync(dirAbs)) return;
    for (const name of fs.readdirSync(dirAbs)) {
      const rel = path.join(dirRel, name);
      const abs = path.join(ROOT, rel);
      const stat = fs.statSync(abs);

      if (stat.isDirectory()) {
        walk(rel);
      } else if (isHtml(name)) {
        if (isRedirectStub(abs)) continue;

        // Canonicalize URL
        if (isIndex(rel)) {
          // d/something/index.html => /d/something/
          const u = '/' + path.dirname(rel).replace(/\\/g, '/').replace(/^\.$/, '');
          urls.add(u.endsWith('/') ? u : (u + '/'));
        } else if (/^shop\//i.test(rel)) {
          // /shop/:slug.html => /shop/:slug
          const slug = path.basename(rel, '.html');
          const u = '/shop/' + slug;
          urls.add(u);
        } else {
          // Other loose html pages keep their filename
          const u = '/' + rel.replace(/\\/g, '/');
          urls.add(u);
        }
      }
    }
  };

  for (const d of PUBLIC_DIRS) walk(d);

  // Known root pages
  for (const name of [
    'index.html', 'about.html', 'contact.html', 'shop.html', 'blog.html',
    'privacy-policy.html', 'terms-and-conditions.html', 'thank-you.html', 'thank-you-order.html',
    'checkout.html', 'booking-page.html', 'cookie-notice.html'
  ]) {
    const abs = path.join(ROOT, name);
    if (fs.existsSync(abs) && !isRedirectStub(abs)) {
      urls.add('/' + name);
    }
  }

  return Array.from(urls)
    .filter(u => !/\/irrigation\/[\w-]+\.html$/i.test(u)) // drop remaining misplaced .html in irrigation root if any
    .sort((a, b) => a.localeCompare(b));
}

function writeSitemap(urls) {
  const now = new Date().toISOString();
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => `  <url>\n    <loc>${BASE_URL}${u}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u === '/' ? '1.0' : u.startsWith('/shop/') ? '0.6' : '0.7'}</priority>\n  </url>`),
    '</urlset>'
  ].join('\n');

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), body, 'utf8');
}

function writeRobots() {
  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${BASE_URL}/sitemap.xml`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), lines, 'utf8');
}

(function main() {
  const urls = collectUrls();
  writeSitemap(urls);
  writeRobots();
  console.log(`Done. Wrote sitemap.xml with ${urls.length} URLs and robots.txt (BASE_URL=${BASE_URL}).`);
})();
