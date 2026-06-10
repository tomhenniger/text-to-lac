// E2E-Test Handschrift: Varianten zeichnen -> in Schreib-App nutzen -> Export
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const outDir = '/tmp/lac_test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
page.on('pageerror', e => console.log('EXC:', e.message));

await page.goto(appDir + '/handschrift.html');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.uncheck('#inpAutoNext');

const bb = await page.locator('#draw').boundingBox();
async function stroke(pts) {
  await page.mouse.move(bb.x + pts[0][0], bb.y + pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(bb.x + x, bb.y + y, { steps: 8 });
  await page.mouse.up();
}
const baseY = bb.height * 0.72, xh = bb.height * 0.72 - 170;

// 'a': Variante 1 — Bogen + Abstrich
await stroke([[300, xh + 60], [260, xh + 40], [240, baseY - 40], [280, baseY], [320, baseY - 60]]);
await stroke([[320, xh + 20], [325, baseY]]);
await page.click('#btnSaveVar');
// 'a': Variante 2 — deutlich anders (eckiger, 3 Striche)
await stroke([[310, xh + 10], [245, xh + 30], [235, baseY]]);
await stroke([[235, baseY], [330, baseY - 10]]);
await stroke([[315, xh], [330, baseY + 25]]);
await page.click('#btnSaveVar');
// 'b': eine Variante
await page.evaluate(() => selectChar('b'));
await stroke([[250, baseY - 290], [255, baseY]]);
await stroke([[255, baseY - 130], [320, baseY - 150], [330, baseY - 50], [260, baseY]]);
await page.click('#btnSaveVar');

const counts = await page.evaluate(() => {
  const f = Object.values(JSON.parse(localStorage.getItem('hw_fonts')))[0];
  return Object.fromEntries(Object.entries(f.glyphsVar).map(([c, v]) => [c, v.length]));
});
console.log('Erfasste Varianten:', counts);
await page.screenshot({ path: outDir + '/hw_capture.png' });

// In Schreib-App verwenden
await Promise.all([page.waitForNavigation(), page.click('#btnUse')]);
console.log('Navigiert zu:', page.url());
await page.fill('#inpText', 'ab ab ab ab');
await page.click('#btnFit');
await page.waitForTimeout(300);

const check = await page.evaluate(() => {
  const f = currentFont();
  const as = cachedLayout.glyphs.filter(g => g.char === 'a');
  const key = g => JSON.stringify(g.strokes.map(s => s.length));
  return { font: f.name, hatVarianten: !!f.glyphsVar,
           aInstanzen: as.length, unterschiedlich: new Set(as.map(key)).size };
});
console.log('Check:', check);
if (!check.hatVarianten || check.unterschiedlich < 2)
  console.log('WARNUNG: Varianten werden nicht durchgemischt!');
await page.screenshot({ path: outDir + '/hw_write.png' });

const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await download.saveAs(outDir + '/handschrift_test.lac');
console.log('Export ok:', outDir + '/handschrift_test.lac');
await browser.close();
