import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'handschrift.html'));
await page.evaluate(() => { localStorage.removeItem('hw_fonts'); });
await page.reload();

const t0 = Date.now();
await page.setInputFiles('#fileScan', '/tmp/lac_test/scan_filled.png');
await page.waitForFunction(() => document.getElementById('scanStatus').textContent.startsWith('✓') ||
  document.getElementById('scanStatus').textContent.startsWith('Keine') ||
  document.getElementById('scanStatus').textContent.startsWith('Fehler'), { timeout: 120000 });
console.log('Dauer:', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('Status:', await page.evaluate(() => document.getElementById('scanStatus').textContent));
const result = await page.evaluate(() => {
  const f = Object.values(JSON.parse(localStorage.getItem('hw_fonts')))[0];
  const out = {};
  for (const [ch, vars] of Object.entries(f.glyphsVar))
    if (ch !== ' ') out[ch] = vars.map(v => v.strokes.length);
  return out;
});
console.log('Browser-Ergebnis:', JSON.stringify(result));
console.log('Python-Referenz:  {"a":[2,2,2],"b":[1,1,1],"i":[2,2,2]}');
await browser.close();
