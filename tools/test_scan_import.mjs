// E2E: gescannte .handschrift.json -> handschrift.html (Laden) -> Schreib-App
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));

await page.goto(appDir + '/handschrift.html');
await page.evaluate(() => localStorage.clear());
await page.setInputFiles('#fileImport', '/tmp/lac_test/scan_test.handschrift.json');
await page.waitForTimeout(400);
await page.evaluate(() => selectChar('a'));
await page.screenshot({ path: '/tmp/lac_test/scan_import.png' });

await Promise.all([page.waitForNavigation(), page.click('#btnUse')]);
await page.fill('#inpText', 'ai ba ab ia');
await page.click('#btnFit');
await page.waitForTimeout(300);
const info = await page.evaluate(() => ({
  font: currentFont().name, glyphs: cachedLayout.glyphs.length,
  fehlend: [...cachedLayout.missing].join(''),
}));
console.log(info);
await page.screenshot({ path: '/tmp/lac_test/scan_write.png' });
await browser.close();
