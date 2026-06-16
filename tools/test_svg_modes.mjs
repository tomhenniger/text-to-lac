import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.goto('file://' + path.join(appDir, 'misc.html'));
await page.selectOption('#inpTool', 'svg');
await page.waitForTimeout(400);
fs.mkdirSync('/tmp/svg_modes', { recursive: true });
let ok = true;

// Gefüllte „Signatur": dicke gefüllte Striche (kein stroke, nur fill) — wie eine echte Unterschrift-SVG
const sig = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">' +
  '<path d="M20 20 h14 v80 h-14 z" fill="#000"/>' +          // dicker vertikaler Balken (H links)
  '<path d="M70 20 h14 v80 h-14 z" fill="#000"/>' +          // dicker vertikaler Balken (H rechts)
  '<path d="M34 54 h36 v12 h-36 z" fill="#000"/>' +          // Querbalken
  '<path d="M110 30 q60 -20 110 30 q-60 50 -110 8 q40 -20 70 -16 q-40 -6 -70 -22 z" fill="#000"/>' +  // gefüllter Schwung
  '</svg>';

const setMode = async (m) => { await page.selectOption('#inpSvgMode', m); await page.waitForTimeout(700); };
const read = () => page.evaluate(() => ({ n: S.strokes.length, pts: S.strokes.reduce((a, s) => a + s.length, 0), cw: +S.cw.toFixed(1), ch: +S.ch.toFixed(1) }));

// Datei laden + auf Rasterung warten
await page.evaluate((svg) => {
  const inp = document.getElementById('inpSvgFile');
  const f = new File([svg], 'sig.svg', { type: 'image/svg+xml' });
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
}, sig);
await page.waitForFunction(() => typeof __svgData !== 'undefined' && __svgData && __svgData.gray, null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(400);

// Auto-Erkennung: gefüllte SVG (fill, kein stroke) muss automatisch auf „Mittellinie" springen — sonst zerpflückt der Umriss-Trace die Flächen
const autoFilled = await page.evaluate(() => document.getElementById('inpSvgMode').value);
console.log('Auto-Modus (gefüllt):', autoFilled);
if (autoFilled !== 'centerline') { console.log('FAIL: gefüllte SVG nicht automatisch auf Mittellinie'); ok = false; }

await setMode('outline'); const out = await read(); await page.screenshot({ path: '/tmp/svg_modes/outline.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });
await setMode('centerline'); const cen = await read(); await page.screenshot({ path: '/tmp/svg_modes/centerline.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });
await setMode('fill'); const fil = await read(); await page.screenshot({ path: '/tmp/svg_modes/fill.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });

console.log('outline   :', JSON.stringify(out));
console.log('centerline:', JSON.stringify(cen));
console.log('fill      :', JSON.stringify(fil));

// Erwartungen: alle Modi liefern Striche; Mittellinie hat deutlich weniger Punkte als Umriss (eine Linie pro Strich statt Kontur);
// Füllen erzeugt viele Schraffur-Linien; alle behalten ~Zielgröße (längste Seite ≈ inpSize, Default 120mm).
const sizeOk = (r) => Math.abs(Math.max(r.cw, r.ch) - 120) < 6;
if (!(out.n >= 1 && sizeOk(out))) { console.log('FAIL: Umriss-Modus'); ok = false; }
if (!(cen.n >= 1 && cen.pts > 0 && sizeOk(cen))) { console.log('FAIL: Mittellinie liefert keine Striche'); ok = false; }
if (!(cen.pts < out.pts)) { console.log('FAIL: Mittellinie sollte weniger Punkte als Umriss haben'); ok = false; }
if (!(fil.n >= 5 && sizeOk(fil))) { console.log('FAIL: Füllen erzeugt zu wenig Schraffur'); ok = false; }
if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }

await browser.close();
console.log(ok ? '\n✅ SVG-MODI TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
