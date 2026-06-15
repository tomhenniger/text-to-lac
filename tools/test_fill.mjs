import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.addInitScript(() => { for (const k of ["text", "handschrift", "bild"]) localStorage.setItem("tour_" + k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'bild.html'));

// Bild mit gefuellten Farbflaechen erzeugen (schwarz/rot/blau auf weiss)
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 240; c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 240);
  g.fillStyle = '#000000'; g.fillRect(20, 20, 80, 80);                                   // schwarzes Quadrat
  g.fillStyle = '#e23b3b'; g.beginPath(); g.arc(170, 70, 45, 0, 7); g.fill();            // roter Kreis
  g.fillStyle = '#2f6fd0'; g.beginPath(); g.moveTo(120, 230); g.lineTo(40, 150); g.lineTo(200, 150); g.closePath(); g.fill();  // blaues Dreieck
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  window.loadImage(new File([blob], 'fill_test.png', { type: 'image/png' }));
});
await page.waitForTimeout(900);

await page.selectOption('#inpStyle', 'fill');
await page.evaluate(() => { const cb = document.getElementById('inpMC'); cb.checked = true; cb.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(1200);

const withOutline = await page.evaluate(() => S.groups.map(g => ({ color: g.color, strokes: g.strokes.length })));
console.log('Mit Kontur:', JSON.stringify(withOutline));

// Kontur ausschalten -> weniger Striche pro Gruppe
await page.evaluate(() => { const cb = document.getElementById('inpFOutline'); cb.checked = false; cb.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(1200);
const noOutline = await page.evaluate(() => S.groups.map(g => g.strokes.length));
console.log('Ohne Kontur (nur Fuellung):', JSON.stringify(noOutline));

await browser.close();

let ok = true;
if (withOutline.length !== 3) { console.log('FAIL: erwartet 3 Gruppen, bekam', withOutline.length); ok = false; }
if (withOutline.some(g => g.strokes < 5)) { console.log('FAIL: Fuellung zu duenn (Gruppe < 5 Striche)'); ok = false; }
// Kontur muss zusaetzliche Striche bringen
for (let i = 0; i < withOutline.length; i++)
  if (!(withOutline[i].strokes > noOutline[i])) { console.log('FAIL: Kontur fuegt keine Striche hinzu in Gruppe', i + 1); ok = false; }
if (errs.length) { console.log('FAIL: JS-Fehler:', errs); ok = false; }
console.log(ok ? '\n✅ FILL+OUTLINE TEST PASSED' : '\n❌ TEST FAILED');
process.exit(ok ? 0 : 1);
