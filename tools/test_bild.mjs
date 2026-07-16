import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
browser.contexts; // Tour-Autostart in Tests unterdrücken
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
page.on('pageerror', e => console.log('EXC:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CON:', m.text()); });
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'index.html?layer=image'));
await page.setInputFiles('#fileImg', '/tmp/lac_test/testbild.png');
await page.waitForTimeout(800);
for (const style of ['hatch', 'cross', 'squiggle', 'spiral', 'ascii', 'contour']) {
  await page.selectOption('#inpStyle', style);
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => document.getElementById('stInfo').textContent);
  console.log(style.padEnd(9), info);
  await page.screenshot({ path: `/tmp/lac_test/stil_${style}.png`, clip: { x: 340, y: 0, width: 1160, height: 880 } });
}
// Export prüfen
const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await download.saveAs('/tmp/lac_test/bild_test.lac');
console.log('Export ok');
await browser.close();
