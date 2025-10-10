const fs = require('fs');
const path = require('path');

const pages = [
  path.join(__dirname, '..', 'services', 'leak-detection.html'),
  path.join(__dirname, '..', 'services', 'irrigation.html'),
  path.join(__dirname, '..', 'services', 'backup-water-systems.html')
];

function extractJsonLd(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const results = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

for (const p of pages) {
  console.log(`\nValidating ${p}`);
  let html;
  try {
    html = fs.readFileSync(p, 'utf8');
  } catch (err) {
    console.error(`  ERROR: cannot read file: ${err.message}`);
    continue;
  }

  const blocks = extractJsonLd(html);
  if (!blocks.length) {
    console.warn('  WARNING: no JSON-LD blocks found');
    continue;
  }

  blocks.forEach((b, i) => {
    try {
      const j = JSON.parse(b);
      const ok = j['@context'] && j['@type'];
      console.log(`  Block ${i + 1}: PARSE OK — @context=${!!j['@context']} @type=${!!j['@type']} `);
      if (!ok) console.warn('    WARNING: missing @context or @type');
    } catch (err) {
      console.error(`  Block ${i + 1}: PARSE ERROR — ${err.message}`);
    }
  });
}

console.log('\nValidation complete.');
