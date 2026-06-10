import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'handschrift.html'));
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.reload();
await page.setInputFiles('#fileScan', [
  '/Users/tomhenniger/Downloads/seite1.png',
  '/Users/tomhenniger/Downloads/seite2.png',
  '/Users/tomhenniger/Downloads/seite3.png',
]);
await page.waitForFunction(() => /^[✓KF]/.test(document.getElementById('scanStatus').textContent), { timeout: 300000 });
console.log(await page.evaluate(() => document.getElementById('scanStatus').textContent));
const font = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('hw_fonts')))[0]);
fs.writeFileSync('/tmp/lac_test/toms_smooth.json', JSON.stringify(font));
await browser.close();
