import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.goto('file://' + path.join(here, '..', 'app', 'misc.html'));
fs.mkdirSync('/tmp/model_test', { recursive: true });
let ok = true;

await page.selectOption('#inpTool', 'model');
await page.waitForTimeout(200);
const before = await page.evaluate(() => ({ n: S.strokes.length, info: document.getElementById('stInfo').textContent }));
console.log('vor Laden:', JSON.stringify(before), '(erwartet 0 + "STL-Datei laden")');

// Würfel-STL (binär, 12 Dreiecke) in-page erzeugen und laden
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
// auf Three.js-Load + Strokes warten
await page.waitForFunction(() => window.THREE && S.strokes.length > 0, null, { timeout: 15000 });
const loaded = await page.evaluate(() => ({ n: S.strokes.length, cw: +S.cw.toFixed(1), ch: +S.ch.toFixed(1), info: document.getElementById('stInfo').textContent, rev: window.THREE && window.THREE.REVISION }));
console.log('geladen:', JSON.stringify(loaded));
if (!(loaded.n >= 9 && loaded.cw > 0 && loaded.ch > 0)) { console.log('FAIL: zu wenige Kanten / keine Größe'); ok = false; }

// Ansicht wechseln (Front vs Iso) → Koordinaten müssen sich ändern (view-abhängige Projektion)
await page.click('#btnModelFront'); await page.waitForTimeout(150);
const front = await page.evaluate(() => JSON.stringify(S.strokes[0]));
await page.click('#btnModelIso'); await page.waitForTimeout(150);
const iso = await page.evaluate(() => JSON.stringify(S.strokes[0]));
console.log('Front vs Iso erste Linie unterschiedlich:', front !== iso);
if (front === iso) { console.log('FAIL: Drehung ändert die Projektion nicht'); ok = false; }
await page.screenshot({ path: '/tmp/model_test/cube_iso.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });

// Export → .lac prüfen
await page.fill('#inpFname', 'Wuerfel');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await dl.saveAs('/tmp/model_test/model.lac');
execSync('cd /tmp/model_test && rm -rf out && mkdir out && unzip -oq model.lac -d out');
const obj = JSON.parse(fs.readFileSync('/tmp/model_test/out/2D/2dmodel.json', 'utf8')).canvas_list[0].obj_list[0];
console.log('.lac Objekt:', obj.name, '| Pfad-Länge:', obj.path_data.length);
if (!obj || obj.name !== 'Wuerfel' || !(obj.path_data.length > 50)) { console.log('FAIL: .lac fehlerhaft'); ok = false; }

// Crease-Winkel sehr hoch → ein Würfel (90°) verliert Knickkanten, nur Silhouette bleibt
await page.evaluate(() => { const s = document.getElementById('inpModelCrease'); s.value = 89; s.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(200);
const hi = await page.evaluate(() => S.strokes.length);
console.log('Kanten bei Crease 89°:', hi, '(sollte < 12, nur Silhouette)');

await browser.close();
if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
console.log(ok ? '\n✅ 3D-TOOL TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
