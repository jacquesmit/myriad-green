const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.join(__dirname, '..', '..', '.tmp', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  // Load light theme (default)
  await page.goto('http://localhost:3000/services/backup-water-systems.html', { waitUntil: 'networkidle' });
  // Ensure data-theme is light
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'backup-light.png'), fullPage: true });

  // Load dark theme
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'backup-dark.png'), fullPage: true });

  await browser.close();
  console.log('Screenshots saved to', outDir);
})();
