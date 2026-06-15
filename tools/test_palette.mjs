import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.addInitScript(() => { for (const k of ["text", "handschrift", "bild"]) localStorage.setItem("tour_" + k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'bild.html'));

await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 240; c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 240);
  g.fillStyle = '#111111'; g.fillRect(10, 10, 100, 100);                       // schwarz
  g.fillStyle = '#d52b2b'; g.fillRect(130, 10, 100, 100);                      // rot
  g.fillStyle = '#2f6fd0'; g.fillRect(10, 130, 220, 100);                      // blau
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  window.loadImage(new File([blob], 'pal_test.png', { type: 'image/png' }));
});
await page.waitForTimeout(900);

await page.evaluate(() => {
  const cb = document.getElementById('inpMC'); cb.checked = true; cb.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('inpMCN').value = '4';
  document.getElementById('btnMCExtract').click();
});
await page.waitForTimeout(800);

const palette = await page.evaluate(() => MC.slice());
console.log('Extrahierte Palette:', palette);

await browser.close();

// erwartet: enthaelt grob weiss, schwarz, rot, blau
const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const near = (h, t, tol = 60) => { const c = hexToRgb(h); return Math.hypot(c[0]-t[0], c[1]-t[1], c[2]-t[2]) < tol; };
const targets = { weiss: [255,255,255], schwarz: [17,17,17], rot: [213,43,43], blau: [47,111,208] };
let ok = true;
if (palette.length < 3) { console.log('FAIL: zu wenige Farben:', palette.length); ok = false; }
for (const [name, t] of Object.entries(targets))
  if (!palette.some(h => near(h, t))) { console.log('FAIL: Farbe nicht gefunden:', name, t); ok = false; }
if (errs.length) { console.log('FAIL: JS-Fehler:', errs); ok = false; }
console.log(ok ? '\n✅ PALETTE-EXTRACTION TEST PASSED' : '\n❌ TEST FAILED');
process.exit(ok ? 0 : 1);
