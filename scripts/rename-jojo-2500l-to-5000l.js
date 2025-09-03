const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOP_DIR = path.join(ROOT, 'shop');
const OLD_SLUG = 'jojo-tank-2500l';
const NEW_SLUG = 'jojo-tank-5000l';

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.isFile()) acc.push(p);
  }
  return acc;
}

function safeRead(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function replaceAll(content, replacements) {
  let changed = false;
  for (const [from, to] of replacements) {
    const next = content.split(from).join(to);
    if (next !== content) { content = next; changed = true; }
  }
  return { content, changed };
}

function renameShopFile() {
  const oldPath = path.join(SHOP_DIR, `${OLD_SLUG}.html`);
  const newPath = path.join(SHOP_DIR, `${NEW_SLUG}.html`);
  if (fs.existsSync(oldPath)) {
    // Update canonical and any old slug references inside the file
    const src = safeRead(oldPath);
    if (src) {
      const { content } = replaceAll(src, [
        [`/shop/${OLD_SLUG}`, `/shop/${NEW_SLUG}`],
        [OLD_SLUG, NEW_SLUG],
        ['jojo tank 2500l', 'JoJo Water Tank 5000L'],
      ]);
      write(newPath, content);
      fs.unlinkSync(oldPath);
      console.log('Renamed shop file:', `${OLD_SLUG}.html -> ${NEW_SLUG}.html`);
    }
  } else if (fs.existsSync(newPath)) {
    console.log('Shop file already renamed.');
  } else {
    console.warn('Shop file not found:', oldPath);
  }
}

function updateRepoWide() {
  const files = walk(ROOT).filter((p) => /\.(html|js|json)$/i.test(p));
  let updated = 0;
  for (const file of files) {
    // Skip history and node_modules
    if (file.includes(path.sep + '.history' + path.sep)) continue;
    if (file.includes(path.sep + 'node_modules' + path.sep)) continue;

    const src = safeRead(file);
    if (!src) continue;

    // Only process files that mention the old slug or jojo tank 2500l name
    if (!src.includes(OLD_SLUG) && !/Jojo Tank 2500l/i.test(src)) continue;

    const replacements = [
      // Update links and IDs first
      [`/shop/${OLD_SLUG}`, `/shop/${NEW_SLUG}`],
      [`data-id="${OLD_SLUG}"`, `data-id="${NEW_SLUG}"`],
      // Normalize the display name where lingering
      [/Jojo Tank 2500l/gi, 'JoJo Water Tank 5000L'],
      // Related data entries in JSON/JS
      [`'${OLD_SLUG}'`, `'${NEW_SLUG}'`],
      [`"${OLD_SLUG}"`, `"${NEW_SLUG}"`],
    ];

    let content = src;
    let changed = false;
    for (const pair of replacements) {
      if (pair[0] instanceof RegExp) {
        const next = content.replace(pair[0], pair[1]);
        if (next !== content) { content = next; changed = true; }
      } else {
        const next = content.split(pair[0]).join(pair[1]);
        if (next !== content) { content = next; changed = true; }
      }
    }

    if (changed) {
      write(file, content);
      updated++;
      console.log('Updated', path.relative(ROOT, file));
    }
  }
  console.log('Done. Files updated:', updated);
}

function main() {
  renameShopFile();
  updateRepoWide();
}

if (require.main === module) main();
