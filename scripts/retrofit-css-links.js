#!/usr/bin/env node
/*
  retrofit-css-links.js
  - Scans HTML files and ensures a consistent set of CSS links are present in <head>.
  - Non-destructive: skips if a link already exists; preserves manual edits and order where possible.
  - Adds links just before </head> (or after last existing <link rel="stylesheet">) using root-absolute paths.
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Minimal standard bundles; order matters for cascade.
const CSS_BUNDLE = [
  // Fonts & icons
  '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet" />',
  '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />',
  // Base
  '<link rel="stylesheet" href="/css/reset.css" />',
  '<link rel="stylesheet" href="/css/theme.css" />',
  '<link rel="stylesheet" href="/css/utilities.css" />',
  '<link rel="stylesheet" href="/css/main.css" />',
  // Page sections (safe generics)
  '<link rel="stylesheet" href="/css/landinghero.css" />',
  '<link rel="stylesheet" href="/css/servicesection.css" />',
  '<link rel="stylesheet" href="/css/booking-modal.css" />',
  '<link rel="stylesheet" href="/css/faq-section.css" />',
  '<link rel="stylesheet" href="/css/testimonials.css" />',
  '<link rel="stylesheet" href="/css/about-us-section.css" />',
  // Nav/Footer + Bars
  '<link rel="stylesheet" href="/css/main-navigation.css" />',
  '<link rel="stylesheet" href="/css/mobile-nav.css" />',
  '<link rel="stylesheet" href="/css/footer.css" />',
  '<link rel="stylesheet" href="/css/navbar.css" />',
  '<link rel="stylesheet" href="/css/theme-toggle.css" />',
  '<link rel="stylesheet" href="/css/components/buttons/book-now-button.css" />',
  '<link rel="stylesheet" href="/css/components/buttons/social-bar.css" />',
  '<link rel="stylesheet" href="/css/floating-bar-reopen-btn.css" />',
  '<link rel="stylesheet" href="/css/contact-us-form.css">',
  // Mobile & layout
  '<link rel="stylesheet" href="/css/mobile-tweaks.css" />',
  '<link rel="stylesheet" href="/css/icon-strip-mobile.css" />',
  '<link rel="stylesheet" href="/css/mobile-tap-feedback.css" />',
  '<link rel="stylesheet" href="/css/mobile-scroll-icon-animate.css" />',
  '<link rel="stylesheet" href="/css/layout.css" />',
  // Widgets
  '<link rel="stylesheet" href="/css/weather-widget.css">',
  // Shop (safe even if not used on all pages)
  '<link rel="stylesheet" href="/css/cart-modal.css" />',
  '<link rel="stylesheet" href="/css/checkout.css" />',
  '<link rel="stylesheet" href="/css/shop-section.css" />',
];

const IRRIGATION_SECTION_LINK = '<link rel="stylesheet" href="/css/services/irrigation-sections.css" />';

// Accept only .html under site content; skip node_modules/public if any.
function isHtmlFile(filePath) {
  return filePath.toLowerCase().endsWith('.html');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip typical build/output or hidden folders if present
      if (/^(node_modules|.git|public)$/i.test(entry.name)) continue;
      files = files.concat(walk(res));
    } else if (entry.isFile() && isHtmlFile(res)) {
      files.push(res);
    }
  }
  return files;
}

function hasLink(content, hrefOrTag) {
  // If full tag provided, check by href attribute presence to avoid duplicates
  const hrefMatch = hrefOrTag.match(/href=\"([^\"]+)\"/);
  const href = hrefMatch ? hrefMatch[1] : hrefOrTag;
  const regex = new RegExp(`<link[^>]+href=[\"\']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\"\'][^>]*>`, 'i');
  return regex.test(content);
}

function insertLinks(content, links) {
  const missing = links.filter(tag => !hasLink(content, tag));
  if (missing.length === 0) return content; // nothing to do

  // Prefer to insert before </head>. If not found, prepend to file.
  const headCloseIdx = content.search(/<\/head>/i);
  if (headCloseIdx !== -1) {
    return (
      content.slice(0, headCloseIdx) +
      '  \n  ' + missing.join('\n  ') + '\n' +
      content.slice(headCloseIdx)
    );
  }
  // Fallback: inject after first <head>
  const headOpenIdx = content.search(/<head[^>]*>/i);
  if (headOpenIdx !== -1) {
    const insertPos = headOpenIdx + content.match(/<head[^>]*>/i)[0].length;
    return content.slice(0, insertPos) + '\n  ' + missing.join('\n  ') + '\n' + content.slice(insertPos);
  }
  // If no head, prepend bundle at top to be safe
  return missing.join('\n') + '\n' + content;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  // Only process documents that look like full pages (contain <html ...>)
  if (!/<html[\s\S]*?<\/html>/i.test(original)) return false;

  // Determine if this is an irrigation page (not in shop section)
  const parts = filePath.split(path.sep).map(s => s.toLowerCase());
  const isIrrigation = parts.includes('irrigation') && !parts.includes('shop');
  const links = isIrrigation ? [...CSS_BUNDLE, IRRIGATION_SECTION_LINK] : CSS_BUNDLE;

  const updated = insertLinks(original, links);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

(function main() {
  const htmlFiles = walk(ROOT);
  let changed = 0;
  for (const file of htmlFiles) {
    try {
      if (processFile(file)) changed++;
    } catch (e) {
      // Log and continue; don't halt the whole run on one bad file
      console.warn(`WARN: Failed to patch ${path.relative(ROOT, file)}: ${e.message}`);
    }
  }
  console.log(`Retrofit CSS complete. Patched ${changed} file(s).`);
})();
