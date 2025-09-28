const fs = require('fs');
const path = require('path');

describe('CSS Tests', () => {
  test('CSS file is linked correctly in HTML', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../services/leak-detection.html'), 'utf-8');
    expect(html).toContain('<link rel="stylesheet" href="../css/leak-detection-main-page.css">');
  });

  test('CSS files are identical', () => {
    const irrigationCSS = fs.readFileSync(path.resolve(__dirname, '../css/irrigation-main-page.css'), 'utf-8');
    const leakDetectionCSS = fs.readFileSync(path.resolve(__dirname, '../css/leak-detection-main-page.css'), 'utf-8');
    expect(leakDetectionCSS).toBe(irrigationCSS);
  });
});