import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'index.html?panel=capture'));
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.reload();
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
// Toms Handschrift importieren -> 'a' hat 3 Varianten
await page.setInputFiles('#fileHwImport', '/Users/tomhenniger/Downloads/toms_handschrift.handschrift.json');
await page.waitForTimeout(400);
await page.evaluate(() => window.Capture._debug.selectChar('a'));
const before = await page.evaluate(() => window.Capture._debug.variants('a').length);
// Thumbnail anklicken -> ansehen, Anzahl bleibt
await page.click('.vth >> nth=1');
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({ n: window.Capture._debug.variants('a').length, strokesGeladen: window.Capture._debug.strokeCount() > 0 }));
// Mülleimer der ersten Variante -> Anzahl sinkt
await page.click('.vth .del >> nth=0');
await page.waitForTimeout(200);
const afterDel = await page.evaluate(() => window.Capture._debug.variants('a').length);
const trash = await page.evaluate(() => document.querySelector('.vth .del').textContent);
console.log(`Varianten: ${before} → nach Ansehen: ${after.n} (Editor geladen: ${after.strokesGeladen}) → nach 🗑: ${afterDel} | Icon: ${trash}`);
await page.screenshot({ path: '/tmp/lac_test/varbar.png', clip: { x: 340, y: 560, width: 1160, height: 390 } });
await browser.close();
