import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.goto('file://' + path.join(here, '..', 'app', 'misc.html'));
let ok = true;
fs.mkdirSync('/tmp/model_test', { recursive: true });

await page.selectOption('#inpTool', 'model');
await page.waitForTimeout(150);

// Würfel laden (12 Dreiecke, 12 Kanten)
await page.evaluate(() => {
  const v = [[-10,-10,-10],[10,-10,-10],[10,10,-10],[-10,10,-10],[-10,-10,10],[10,-10,10],[10,10,10],[-10,10,10]];
  const faces = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
  const nT = faces.length, buf = new ArrayBuffer(84 + nT * 50), dv = new DataView(buf);
  dv.setUint32(80, nT, true); let o = 84;
  for (const f of faces) { o += 12; for (const i of f) { const p = v[i]; dv.setFloat32(o, p[0], true); dv.setFloat32(o+4, p[1], true); dv.setFloat32(o+8, p[2], true); o += 12; } o += 2; }
  const file = new File([buf], 'wuerfel.stl', { type: 'model/stl' });
  const inp = document.getElementById('inpModelFile');
  const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() => window.THREE && S.strokes.length > 0, null, { timeout: 15000 });
await page.click('#btnModelIso'); await page.waitForTimeout(150);

async function setMode(m) { await page.evaluate(v => { const s = document.getElementById('inpModelHidden'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, m); await page.waitForTimeout(250); return page.evaluate(() => S.strokes.length); }

const nAll = await setMode('all');
const nVis = await setMode('visible');
const nDash = await setMode('dashed');
console.log(`HLR-Kantenzahlen: all=${nAll} visible=${nVis} dashed=${nDash}`);
// Würfel Iso: 12 Kanten gesamt, 3 hinten verdeckt → sichtbar 9; gestrichelt zerlegt verdeckte in viele kurze Segmente
if (!(nAll === 12)) { console.log('FAIL: all sollte 12 sein'); ok = false; }
if (!(nVis < nAll && nVis >= 6)) { console.log('FAIL: visible sollte < all und >= 6 sein'); ok = false; }
if (!(nDash > nAll)) { console.log('FAIL: dashed sollte mehr Striche als all liefern (Strichelung)'); ok = false; }

// --- Freies Drehen: 180°-Kippen (mit alter ±90°-Klemmung unmöglich) flippt einen Punkt ---
const flip = await page.evaluate(() => {
  __modelRot = rotFromAzEl(0, 0);
  const py = R => R[3] * 0 + R[4] * 1 + R[5] * 0;           // Projektions-Y des Top-Vertex (0,1,0)
  const before = py(__modelRot);
  __modelRot = m3ortho(m3mul(m3rotX(Math.PI), __modelRot)); // 180° um die Bildschirm-X-Achse taumeln
  const after = py(__modelRot);
  // Orthonormalität prüfen
  const R = __modelRot, row = i => [R[i*3], R[i*3+1], R[i*3+2]];
  const len = r => Math.hypot(r[0], r[1], r[2]);
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const ortho = Math.abs(len(row(0)) - 1) < 1e-6 && Math.abs(len(row(1)) - 1) < 1e-6 && Math.abs(len(row(2)) - 1) < 1e-6 && Math.abs(dot(row(0), row(1))) < 1e-6;
  return { before, after, ortho };
});
console.log('free-rotate:', JSON.stringify({ before: +flip.before.toFixed(3), after: +flip.after.toFixed(3), ortho: flip.ortho }));
if (!(flip.before > 0.99 && flip.after < -0.99 && flip.ortho)) { console.log('FAIL: freies Drehen / Orthonormalität'); ok = false; }

// --- Akkumulierende Orbit-Drehung ändert die Projektion (nicht nur az/el) ---
const acc = await page.evaluate(() => {
  __modelRot = rotFromAzEl(Math.PI / 5, Math.PI / 7); reprojectModel(false); const a = JSON.stringify(S.strokes[0]);
  __modelRot = m3ortho(m3mul(m3mul(m3rotY(0.8), m3rotX(0.5)), __modelRot)); reprojectModel(false); const b = JSON.stringify(S.strokes[0]);
  return a !== b;
});
console.log('orbit ändert Projektion:', acc);
if (!acc) { console.log('FAIL: Orbit ändert Projektion nicht'); ok = false; }

await page.evaluate(() => { const s = document.getElementById('inpModelHidden'); s.value = 'dashed'; s.dispatchEvent(new Event('input', { bubbles: true })); __modelRot = rotFromAzEl(Math.PI / 4, Math.atan(1 / Math.SQRT2)); reprojectModel(true); });
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/model_test/cube_hlr.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });

// --- Performance: dichteres Modell (UV-Kugel ~968 Dreiecke), HLR-Aufbau muss schnell sein (z-Buffer statt Raycast) ---
{
  await page.evaluate(() => {
    const nLat = 22, nLon = 22, R = 10, P = (i, j) => { const th = Math.PI * i / nLat, ph = 2 * Math.PI * j / nLon; return [R * Math.sin(th) * Math.cos(ph), R * Math.cos(th), R * Math.sin(th) * Math.sin(ph)]; };
    const faces = []; for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) { const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); faces.push([a, b, c], [a, c, d]); }
    const nT = faces.length, buf = new ArrayBuffer(84 + nT * 50), dv = new DataView(buf); dv.setUint32(80, nT, true); let o = 84;
    for (const f of faces) { o += 12; for (const p of f) { dv.setFloat32(o, p[0], true); dv.setFloat32(o + 4, p[1], true); dv.setFloat32(o + 8, p[2], true); o += 12; } o += 2; }
    const inp = document.getElementById('inpModelFile'); const dt = new DataTransfer(); dt.items.add(new File([buf], 'kugel.stl', { type: 'model/stl' })); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => S.strokes.length > 0 && /kugel/.test(document.getElementById('stInfo').textContent), null, { timeout: 15000 });
  // Cache leeren und einen frischen HLR-Aufbau (visible) timen
  const ms = await page.evaluate(() => {
    __modelData._dmSig = null; $('inpModelHidden').value = 'visible';
    const t0 = performance.now(); reprojectModel(true); return performance.now() - t0;
  });
  const faces = await page.evaluate(() => __modelData.faceCount);
  console.log(`HLR-Aufbau (frisch) für ${faces} Dreiecke: ${ms.toFixed(1)} ms`);
  if (!(ms < 1500)) { console.log('FAIL: HLR zu langsam'); ok = false; }
  // Moduswechsel bei gleicher Ansicht muss dank Cache quasi sofort sein
  const ms2 = await page.evaluate(() => { const t0 = performance.now(); $('inpModelHidden').value = 'dashed'; reprojectModel(true); return performance.now() - t0; });
  console.log(`Moduswechsel (gecachte Tiefe): ${ms2.toFixed(1)} ms`);
  await page.screenshot({ path: '/tmp/model_test/sphere_hlr.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });
}

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ 3D HLR + FREE-ROTATE TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
