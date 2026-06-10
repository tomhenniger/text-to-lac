import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.goto(appDir + '/handschrift.html');
await page.setInputFiles('#fileImport', '/Users/tomhenniger/Downloads/toms_handschrift.handschrift.json');
await page.waitForTimeout(400);
await Promise.all([page.waitForNavigation(), page.click('#btnUse')]);
await page.fill('#inpText', 'Hallo, ich bin Toms Handschrift!\nDieser Text wurde nie geschrieben —\nzumindest nicht so. 1234567890\nÄpfel, Öl, Übermut und süße Grüße.');
await page.click('#btnFit');
await page.waitForTimeout(400);
const info = await page.evaluate(() => ({
  font: currentFont().name,
  fehlend: [...cachedLayout.missing].join('') || 'keine',
}));
console.log('Schrift:', info.font, '| fehlende Zeichen:', info.fehlend);
await page.screenshot({ path: '/tmp/lac_test/demo_tom.png', clip: { x: 340, y: 0, width: 1160, height: 700 } });
await browser.close();
