const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../service-templet/service-page-master-template.html');
const dataPath = path.join(__dirname, '../data/service-pages.json');

const template = fs.readFileSync(templatePath, 'utf8');
const pageData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function populateTemplate(template, data) {
  return template.replace(/{{\s*([\w\-]+)\s*}}/g, (_, key) => data[key] || '');
}

Object.entries(pageData).forEach(([pageKey, data]) => {
  const [service, ...suburbParts] = pageKey.split('_');
  const outDir = path.join(__dirname, `../${service}/_preview`);
  const outFile = path.join(outDir, 'index.html');
  fs.mkdirSync(outDir, { recursive: true });
  const pageHtml = populateTemplate(template, data);
  fs.writeFileSync(outFile, pageHtml, 'utf8');
  console.log(`Wrote: ${outFile}`);
});

console.log('All service pages populated.');
