const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../service-templet/service-page-master-template.html');
const dataPath = path.join(__dirname, '../data/service-pages-master-demo.json');

const template = fs.readFileSync(templatePath, 'utf8');
const pageData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function populateTemplate(template, data) {
  return template.replace(/{{\s*([\w\-]+)\s*}}/g, (_, key) => data[key] || '');
}

Object.entries(pageData).forEach(([pageKey, data]) => {
  // Example: "irrigation_pretoria_east" => "irrigation/pretoria/east/index.html"
  const parts = pageKey.split('_');
  const outDir = path.join(__dirname, `../${parts.join('/')}`);
  const outFile = path.join(outDir, 'index.html');
  fs.mkdirSync(outDir, { recursive: true });
  const pageHtml = populateTemplate(template, data);
  fs.writeFileSync(outFile, pageHtml, 'utf8');
  console.log(`Wrote: ${outFile}`);
});

console.log('Master template demo page populated.');
