import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const page = await browser.newPage({ viewport: { width: 460, height: 820 } });
const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
await page.goto('file://' + path.join(appDir, 'misc.html') + '?embed=1&tool=model');
await page.waitForTimeout(500);

// Vorschau im Embed sichtbar (sonst kann man im Studio nicht drehen)
const st = await page.evaluate(() => ({
  embed: window.HS_EMBED === true,
  embedModel: document.documentElement.classList.contains('embed-model'),
  mainDisp: getComputedStyle(document.getElementById('main')).display,
  tool: document.getElementById('inpTool').value,
}));
console.log('embed-model preview:', JSON.stringify(st));
if (!(st.embed && st.embedModel && st.mainDisp !== 'none' && st.tool === 'model')) { console.log('FAIL: 3D-Vorschau im Embed nicht sichtbar'); ok = false; }

// Würfel laden
await page.evaluate(() => {
  const v = [[-10,-10,-10],[10,-10,-10],[10,10,-10],[-10,10,-10],[-10,-10,10],[10,-10,10],[10,10,10],[-10,10,10]];
  const faces = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
  const nT = faces.length, buf = new ArrayBuffer(84 + nT * 50), dv = new DataView(buf); dv.setUint32(80, nT, true); let o = 84;
  for (const f of faces) { o += 12; for (const i of f) { const p = v[i]; dv.setFloat32(o, p[0], true); dv.setFloat32(o+4, p[1], true); dv.setFloat32(o+8, p[2], true); o += 12; } o += 2; }
  const inp = document.getElementById('inpModelFile'); const dt = new DataTransfer(); dt.items.add(new File([buf], 'wuerfel.stl', { type: 'model/stl' })); inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() => window.THREE && S.strokes.length > 0, null, { timeout: 15000 });
await page.evaluate(() => { document.getElementById('main').scrollIntoView(); try { resize(); fitView(); } catch (e) {} });
await page.waitForTimeout(200);

// Auf der Vorschau ziehen → Modell dreht sich (Rotationsmatrix ändert sich)
const before = await page.evaluate(() => __modelRot.slice());
const box = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top }; });
console.log('canvas rect:', JSON.stringify(box));
await page.mouse.move(box.x, box.y); await page.mouse.down();
await page.mouse.move(box.x + 60, box.y + 40); await page.mouse.move(box.x + 120, box.y + 80);
await page.mouse.up();
const after = await page.evaluate(() => __modelRot.slice());
const changed = before.some((v, i) => Math.abs(v - after[i]) > 1e-3);
console.log('drag rotates model in embed:', changed);
if (!changed) { console.log('FAIL: Ziehen dreht das Modell nicht'); ok = false; }

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ EMBED 3D-PREVIEW TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
