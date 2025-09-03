// Inject sections from irrigation/_preview/index.html into irrigation pages
// Non-destructive for hero/FAQ; replaces/creates core sections sitewide in irrigation/**
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'service-templet', 'irrigation-page-template.html');
const IRRIGATION_DIR = path.join(ROOT, 'irrigation');

// Section tokens to sync (match by a unique id or class token within <section ...>)
const TOKENS = [
  'class="icon-strip-horizontal',
  'class="overview section',
  'id="about-us"',
  'class="testimonials-section',
  'class="features section',
  'class="why-choose-us-section',
  'class="how-it-works section',
  'class="irrigation-services-section',
  'class="pricing section',
  'class="monthly-pricing section',
  'class="project-gallery-section',
  'class="trust-badges section',
  'class="design-packages section',
  'class="process-promise section',
  'class="map-section section',
  'class="local-service-areas section',
  'class="faq-section section',
  'class="contact-form-section',
  'id="featured-products"'
];

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeFile(p, content) {
  fs.writeFileSync(p, content, 'utf8');
}

function findSectionRange(html, token) {
  const tokenPos = html.indexOf(token);
  if (tokenPos === -1) return null;
  const start = html.lastIndexOf('<section', tokenPos);
  if (start === -1) return null;
  // find matching </section> accounting for nested sections
  let idx = start;
  let depth = 0;
  const len = html.length;
  while (idx < len) {
    const nextOpen = html.indexOf('<section', idx + 1);
    const nextClose = html.indexOf('</section>', idx + 1);
    if (nextClose === -1) return null; // malformed
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      idx = nextOpen;
    } else {
      if (depth === 0) {
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

function extractTemplateSections(templateHtml) {
  const map = new Map();
  for (const token of TOKENS) {
    const range = findSectionRange(templateHtml, token);
    if (range) {
      map.set(token, templateHtml.slice(range.start, range.end));
    }
  }
  return map;
}

function listHtmlFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (p.includes(path.sep + '_preview')) continue;
        stack.push(p);
      } else if (e.isFile()) {
        if (e.name.toLowerCase().endsWith('.html')) out.push(p);
      }
    }
  }
  return out;
}

function injectIntoFile(filePath, sectionsMap) {
  let html = readFile(filePath);

  // Fix legacy featured section id if present
  if (html.includes('id="featured-irrigation-products"')) {
    const legacyRange = findSectionRange(html, 'id="featured-irrigation-products"');
    const tpl = sectionsMap.get('id="featured-products"');
    if (legacyRange && tpl) {
      html = html.slice(0, legacyRange.start) + tpl + html.slice(legacyRange.end);
    }
  }

  // Also fix legacy featured section using only class (no id)
  // Many older pages used: <section class="featured-products section"> ...
  // Be precise to avoid matching the canonical block (which is class="featured-products" without the extra "section" class)
  const legacyFeaturedToken = 'class="featured-products section"';
  if (html.includes(legacyFeaturedToken)) {
    const tpl = sectionsMap.get('id="featured-products"');
    if (tpl) {
      // Replace all occurrences defensively
      let guard = 0;
      while (html.includes(legacyFeaturedToken) && guard < 50) {
        const legacyClassRange = findSectionRange(html, legacyFeaturedToken);
        if (!legacyClassRange) break;
        html = html.slice(0, legacyClassRange.start) + tpl + html.slice(legacyClassRange.end);
        guard++;
      }
    }
  }

    // Handle another legacy variant: class-only featured-products with products-heading aria label
    // Example: <section class="featured-products" aria-labelledby="products-heading"> ... </section>
    // If a canonical id="featured-products" already exists on the page, remove the legacy block(s).
    // If not, replace the legacy block with the canonical template section.
    const legacyClassOnlyToken = 'aria-labelledby="products-heading"';
    if (html.includes('class="featured-products"') && html.includes(legacyClassOnlyToken)) {
      const tpl = sectionsMap.get('id="featured-products"');
      let guard2 = 0;
      while (html.includes('class="featured-products"') && html.includes(legacyClassOnlyToken) && guard2 < 50) {
        const legacyRange2 = findSectionRange(html, legacyClassOnlyToken);
        if (!legacyRange2) break;
        const hasCanonical = html.includes('id="featured-products"');
        if (hasCanonical) {
          // Remove duplicate legacy block
          html = html.slice(0, legacyRange2.start) + html.slice(legacyRange2.end);
        } else if (tpl) {
          // Replace with canonical template
          html = html.slice(0, legacyRange2.start) + tpl + html.slice(legacyRange2.end);
        } else {
          // No template available; leave as-is and break to avoid infinite loop
          break;
        }
        guard2++;
      }
    }

  let changed = false;
  for (const [token, tplSection] of sectionsMap.entries()) {
    // Skip hero and FAQ on purpose (we didn’t include their tokens)
    const targetToken = token;
    const existingRange = findSectionRange(html, targetToken);
    if (existingRange) {
      // Replace block with template version
      html = html.slice(0, existingRange.start) + tplSection + html.slice(existingRange.end);
      changed = true;
    } else {
      // Insert before </main> or </body>
      const insertAnchor = html.lastIndexOf('</main>') !== -1 ? '</main>' : '</body>';
      const anchorIdx = html.lastIndexOf(insertAnchor);
      if (anchorIdx !== -1) {
        html = html.slice(0, anchorIdx) + tplSection + '\n' + html.slice(anchorIdx);
        changed = true;
      }
    }
  }

  if (changed) writeFile(filePath, html);
  return changed;
}

function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('Template not found:', TEMPLATE_PATH);
    process.exit(1);
  }
  const templateHtml = readFile(TEMPLATE_PATH);
  const sectionsMap = extractTemplateSections(templateHtml);
  if (sectionsMap.size === 0) {
    console.error('No sections extracted from template. Aborting.');
    process.exit(1);
  }
  const files = listHtmlFiles(IRRIGATION_DIR).filter(p => !p.includes(path.sep + '_preview' + path.sep));
  let patched = 0;
  for (const f of files) {
    const changed = injectIntoFile(f, sectionsMap);
    if (changed) {
      patched++;
      console.log('Patched', f);
    }
  }
  console.log('Done. Patched', patched, 'files.');
}

main();
