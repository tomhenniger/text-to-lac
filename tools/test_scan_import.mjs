// E2E: gescannte .handschrift.json -> Capture-Modal (Laden) -> Übernehmen -> Studio
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');

const browser = await chromium.launch();
browser.contexts; // Tour-Autostart in Tests unterdrücken
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));

await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto(appDir + '/index.html?panel=capture');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
await page.setInputFiles('#fileHwImport', '/tmp/lac_test/scan_test.handschrift.json');
await page.waitForTimeout(400);
await page.evaluate(() => window.Capture._debug.selectChar('a'));
await page.screenshot({ path: '/tmp/lac_test/scan_import.png' });

await page.click('#btnHwUse');
await page.waitForFunction(() => document.getElementById('captureModal').hidden);
await page.fill('#inpText', 'ai ba ab ia');
await page.click('#btnFit');
await page.waitForTimeout(300);
const info = await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  const lay = window.__studio.activeLayout();
  return { font: window.TextLayer.fontById(l.fontId).name, glyphs: lay.glyphs.length,
           fehlend: [...lay.missing].join('') };
});
console.log(info);
await page.screenshot({ path: '/tmp/lac_test/scan_write.png' });
await browser.close();
