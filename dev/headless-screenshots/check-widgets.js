const playwright = require('playwright');
(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/services/backup-water-systems.html', { waitUntil: 'domcontentloaded' });
  // wait a short time for JS to run
  await page.waitForTimeout(1200);
  const count = await page.evaluate(() => document.querySelectorAll('.weather-widget').length);
  console.log('weather-widget count:', count);
  // Also list visible elements' outerHTML briefly
  const htmls = await page.evaluate(() => Array.from(document.querySelectorAll('.weather-widget')).map(el => ({outer: el.outerHTML.slice(0,200), id: el.id || null, dataPartial: el.getAttribute('data-partial'), dataService: el.getAttribute('data-service')})));
  console.log(JSON.stringify(htmls, null, 2));
  await browser.close();
})();