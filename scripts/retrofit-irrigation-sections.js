#!/usr/bin/env node
/**
 * Retrofit irrigation pages sitewide:
 * - Replace or insert canonical About section from irrigation/_preview/index.html
 * - Replace or insert canonical How It Works section from the same template
 * - Ensure required CSS links exist (about-us-section.css, how-it-works.css, weather-widget.css)
 * - Ensure required JS exists (site-init.js, how-it-works-animate.js, weather-widget.js)
 * - Enforce H1 specificity using data-city/data-suburb when current H1 is generic
 *
 * Notes:
 * - Does not duplicate sections; replaces <section id="about-us"> and <section class="how-it-works section"> if found.
 * - Inserts About after the Overview section if missing; inserts How It Works after Features if missing.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_ROOT = path.join(ROOT);
const IRR_ROOT = path.join(SITE_ROOT, 'irrigation');
const PREVIEW = path.join(IRR_ROOT, '_preview', 'index.html');

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, data) { fs.writeFileSync(file, data, 'utf8'); }
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === '.history' || e.name === 'node_modules' || e.name === '.git' || e.name === '.vscode') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (/\.html?$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

if (!exists(PREVIEW)) {
  console.error('Cannot find preview template at', PREVIEW);
  process.exit(1);
}

const template = read(PREVIEW);
function extractSection(html, idOrClassRegex) {
  const re = new RegExp(`<section[^>]*${idOrClassRegex}[^>]*>[\\s\\S]*?<\\/section>`, 'i');
  const m = html.match(re);
  return m ? m[0] : null;
}

const aboutTpl = extractSection(template, 'id="about-us"');
const howTpl = extractSection(template, 'class=\\"how-it-works section\\"');
const faqTpl = extractSection(template, 'id="faq"');
if (!aboutTpl || !howTpl || !faqTpl) {
  console.error('Failed to extract sections from template. About:', !!aboutTpl, 'How:', !!howTpl, 'FAQ:', !!faqTpl);
  process.exit(1);
}

const targetFiles = walk(IRR_ROOT).filter(f => /\\index\.html$/i.test(f));
const cssMustHave = [
  '/css/irrigation-sections.css',
  '/css/about-us-section.css',
  '/css/how-it-works.css',
  '/css/faq-section.css',
  '/css/weather-widget.css'
];
const jsMustHave = [
  '/js/site-init.js',
  '/js/how-it-works-animate.js',
  '/js/weather-widget.js'
];

function ensureHeadLinks(html) {
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) return html;
  let head = html.slice(0, headEnd);
  const rest = html.slice(headEnd);

  for (const href of cssMustHave) {
    if (!head.includes(`href="${href}"`)) {
      head += `\n  <link rel="stylesheet" href="${href}">`;
    }
  }
  return head + rest;
}

function ensureFooterScripts(html) {
  const bodyEnd = html.lastIndexOf('</body>');
  if (bodyEnd === -1) return html;
  let before = html.slice(0, bodyEnd);
  const after = html.slice(bodyEnd);

  for (const src of jsMustHave) {
    if (!before.includes(`src="${src}"`)) {
      before += `\n  <script src="${src}" defer></script>`;
    }
  }
  return before + after;
}

function replaceOrInsertSection(html, sectionIdRegex, newMarkup, insertHintRegexes) {
  const re = new RegExp(`<section[^>]*${sectionIdRegex}[^>]*>[\\s\\S]*?<\\/section>`, 'i');
  if (re.test(html)) {
    return html.replace(re, newMarkup);
  }
  // Insert after first hint that matches
  for (const hint of insertHintRegexes) {
    const hintRe = new RegExp(hint, 'i');
    const m = html.match(hintRe);
    if (m) {
      const idx = m.index + m[0].length;
      return html.slice(0, idx) + `\n\n${newMarkup}` + html.slice(idx);
    }
  }
  return html + `\n\n${newMarkup}`;
}

function normalizeH1(text) {
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

function enforceH1Specificity(html) {
  // Find H1 with data attributes
  const h1Re = /<h1[^>]*id="page-h1"[^>]*>([\s\S]*?)<\/h1>/i;
  const h1AttrRe = /<h1[^>]*id="page-h1"[^>]*data-page-key="([^"]*)"[^>]*data-city="([^"]*)"[^>]*data-suburb="([^"]*)"[^>]*>/i;
  const attrMatch = html.match(h1AttrRe);
  const h1Match = html.match(h1Re);
  if (!h1Match) return html;

  let currentText = normalizeH1(h1Match[1] || '');
  if (!attrMatch) return html; // no data to specialize
  const city = (attrMatch[2] || '').trim();
  const suburb = (attrMatch[3] || '').trim();

  // Determine if the current text is generic
  const looksGeneric = /^(Smart\s+)?Irrigation( Services)?( in (Gauteng|Pretoria|Sandton|Centurion))?$/i.test(currentText) || /Irrigation Services$/i.test(currentText);
  if (!looksGeneric) return html; // assume already specific

  let newText = '';
  if (suburb && city && suburb.toLowerCase() !== city.toLowerCase()) {
    newText = `Irrigation in ${suburb}, ${city}`;
  } else if (suburb) {
    newText = `Irrigation in ${suburb}`;
  } else if (city) {
    newText = `Irrigation in ${city}`;
  } else {
    return html; // nothing better to use
  }

  return html.replace(h1Re, (m) => m.replace(h1Match[1], newText));
}

let changed = 0;
for (const file of targetFiles) {
  let html = read(file);
  let original = html;

  html = ensureHeadLinks(html);
  html = ensureFooterScripts(html);

  html = replaceOrInsertSection(
    html,
    'id=\\"about-us\\"',
    aboutTpl,
    [
      // insert after Overview or after Hero
      '<section[^>]*class=\\"overview',
      '<section[^>]*class=\\"hero-irrigation'
    ]
  );

  html = replaceOrInsertSection(
    html,
    'class=\\"how-it-works section\\"',
    howTpl,
    [
      '<section[^>]*class=\\"features',
      '<section[^>]*class=\\"why-choose-us-section'
    ]
  );

  html = enforceH1Specificity(html);

  // FAQ: replace existing or insert after Featured Products or after How It Works; fallback before Contact Form
  html = replaceOrInsertSection(
    html,
    'id=\\"faq\\"',
    faqTpl,
    [
      // After Featured Products section
      '<section[^>]*id=\\"featured-products[\\s\\S]*?<\\/section>',
      // After How It Works section
      '<section[^>]*class=\\"how-it-works section\\"[\\s\\S]*?<\\/section>',
      // Before contact form: insert after previous section heading as fallback
      '<section[^>]*class=\\"process-promise section\\"[\\s\\S]*?<\\/section>'
    ]
  );

  if (html !== original) {
    write(file, html);
    changed++;
    console.log('Patched', path.relative(SITE_ROOT, file));
  }
}

console.log('Done. Patched', changed, 'files.');
