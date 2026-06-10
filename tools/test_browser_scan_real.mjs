import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'handschrift.html'));
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.reload();
const t0 = Date.now();
await page.setInputFiles('#fileScan', [
  '/Users/tomhenniger/Downloads/seite1.png',
  '/Users/tomhenniger/Downloads/seite2.png',
  '/Users/tomhenniger/Downloads/seite3.png',
]);
await page.waitForFunction(() => /^[✓KF]/.test(document.getElementById('scanStatus').textContent), { timeout: 600000 });
console.log('Dauer:', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('Status:', await page.evaluate(() => document.getElementById('scanStatus').textContent));
const stats = await page.evaluate(() => {
  const f = Object.values(JSON.parse(localStorage.getItem('hw_fonts')))[0];
  const counts = Object.entries(f.glyphsVar).filter(([c]) => c !== ' ');
  const ns = counts.flatMap(([, vars]) => vars.map(v => v.strokes.length));
  ns.sort((a, b) => a - b);
  return { zeichen: counts.length, varianten: ns.length,
           medianStriche: ns[Math.floor(ns.length / 2)], maxStriche: ns[ns.length - 1] };
});
console.log('Browser:', JSON.stringify(stats));
console.log('Python-Referenz: 87 Zeichen, 259 Varianten, Median 2, Max 6');
await browser.close();
