import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
await page.goto('file://' + path.join(here, '..', 'app', 'misc.html'));
let ok = true;

await page.selectOption('#inpTool', 'pen');
await page.waitForTimeout(200);

// Zwei Striche auf die Fläche zeichnen
const cbox = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
async function drawStroke(pts) {
  await page.mouse.move(cbox.l + pts[0][0], cbox.t + pts[0][1]); await page.mouse.down();
  for (let i = 1; i < pts.length; i++) await page.mouse.move(cbox.l + pts[i][0], cbox.t + pts[i][1]);
  await page.mouse.up();
}
await drawStroke([[300, 300], [340, 320], [380, 300], [420, 340], [460, 300]]);
await drawStroke([[300, 400], [400, 420], [500, 400]]);
await page.waitForTimeout(150);
const n2 = await page.evaluate(() => S.strokes.length);
console.log('pen: Striche nach 2 Zügen =', n2);
if (!(n2 === 2)) { console.log('FAIL: Zeichnen erzeugt nicht 2 Striche'); ok = false; }
const pts0 = await page.evaluate(() => S.strokes[0].length);
if (!(pts0 >= 2)) { console.log('FAIL: erster Strich hat zu wenige Punkte'); ok = false; }

// Rückgängig → 1 Strich
await page.click('#btnPenUndo'); await page.waitForTimeout(100);
const n1 = await page.evaluate(() => S.strokes.length);
console.log('pen: nach Rückgängig =', n1);
if (n1 !== 1) { console.log('FAIL: Rückgängig'); ok = false; }

// Leeren → 0
await page.click('#btnPenClear'); await page.waitForTimeout(100);
const n0 = await page.evaluate(() => S.strokes.length);
console.log('pen: nach Leeren =', n0);
if (n0 !== 0) { console.log('FAIL: Leeren'); ok = false; }

// Export nach neuem Zeichnen
await drawStroke([[300, 300], [350, 350], [400, 300]]);
await page.waitForTimeout(120);
const exp = await page.evaluate(() => ({ n: S.strokes.length, cw: S.cw, ch: S.ch }));
console.log('pen export-bereit:', JSON.stringify(exp));
if (!(exp.n >= 1 && exp.cw > 0 && exp.ch > 0)) { console.log('FAIL: kein exportierbarer Strich'); ok = false; }

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await page.close();

// Embed (Studio): Zeichenfläche muss in einem kleinen iframe-Viewport sichtbar/oben sein
{
  const ep = await browser.newPage({ viewport: { width: 380, height: 380 } });   // wie ein schmales Studio-Panel
  await ep.goto('file://' + path.join(here, '..', 'app', 'misc.html') + '?embed=1&tool=pen');
  await ep.waitForTimeout(500);
  const r = await ep.evaluate(() => { const rect = cv.getBoundingClientRect(); return { embedDraw: document.documentElement.classList.contains('embed-draw'), mainDisp: getComputedStyle(document.getElementById('main')).display, top: rect.top, h: rect.height }; });
  console.log('embed pen canvas:', JSON.stringify({ embedDraw: r.embedDraw, mainDisp: r.mainDisp, top: Math.round(r.top), h: Math.round(r.h) }));
  if (!(r.embedDraw && r.mainDisp !== 'none' && r.top < 380 && r.h > 50)) { console.log('FAIL: Zeichenfläche im Embed nicht erreichbar'); ok = false; }
  await ep.close();
}
await browser.close();
console.log(ok ? '\n✅ PEN TOOL TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
