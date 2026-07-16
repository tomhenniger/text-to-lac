import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const GC = '//gc.zgo.at/count.js';   // GoatCounter scheitert unter file:// (unabhängig von dieser Änderung)

const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes(GC) && !m.text().includes('ERR_INVALID_URL') && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });

await page.goto('file://' + path.join(appDir, 'studio.html'));
await page.evaluate(() => { try { localStorage.removeItem('ttl_studio_layout'); } catch {} });
await page.reload();
await page.waitForTimeout(400);

// --- Szene: eine dichte QR-Ebene + eine dichte Freihand-Pfad-Ebene (201-Punkt-Sinus) ---
await page.evaluate(() => addLayer('misc', 'qr'));
await page.waitForFunction(() => S.layers.length && S.layers[S.layers.length - 1].strokesCache.length > 0, null, { timeout: 20000 });
await page.evaluate(() => {
  const poly = [];
  for (let i = 0; i <= 200; i++) poly.push([20 + i * 0.6, 100 + 30 * Math.sin(i * 0.2)]);   // 201 Punkte, keine Vorab-Vereinfachung
  const L = makePenLayer({ kind: 'free', poly }, 'Sinus');
  S.layers.push(L); selectLayer(L.id); redraw();
});
const rawPts = await page.evaluate(() => S.layers.reduce((s, L) => s + (L.strokesCache || []).reduce((a, st) => a + st.length, 0), 0));
console.log('Szene: ' + (await page.evaluate(() => S.layers.length)) + ' Ebenen, Roh-Punkte gesamt=' + rawPts);

// --- API-Oberfläche: rdpStudio entfernt, LacExport-Funnel vorhanden ---
const api = await page.evaluate(() => ({
  rdpStudioGone: typeof rdpStudio === 'undefined',
  hasRdp: typeof LacExport.rdp === 'function',
  hasResampleEps: typeof LacExport.resampleEps === 'function',
  hasResampleStrokes: typeof LacExport.resampleStrokes === 'function',
  eps: [1, 2, 3, 4, 5].map(q => LacExport.resampleEps(q)),
}));
console.log('API:', JSON.stringify(api));
if (!(api.rdpStudioGone && api.hasRdp && api.hasResampleEps && api.hasResampleStrokes)) { console.log('FAIL: Funnel-API unvollständig oder rdpStudio noch da'); ok = false; }
if (JSON.stringify(api.eps) !== JSON.stringify([0.3, 0.1, 0.03, 0.01, 0])) { console.log('FAIL: resampleEps-Tabelle falsch'); ok = false; }

// --- Punktzahl je Stufe: Q5 == roh, monoton fallend Q5 ≥ Q3 ≥ Q1, Q1 echt kleiner ---
async function pointsAt(q) {
  return page.evaluate((q) => {
    setQuality(q);
    let thrown = null;
    try { redraw(); } catch (e) { thrown = e.message; }
    const g = buildGroups();
    const pts = g.reduce((s, grp) => s + grp.strokes.reduce((a, st) => a + st.length, 0), 0);
    const segs = g.reduce((s, grp) => s + grp.strokes.reduce((a, st) => a + Math.max(0, st.length - 1), 0), 0);
    return { pts, segs, thrown };
  }, q);
}
const q5 = await pointsAt(5), q3 = await pointsAt(3), q1 = await pointsAt(1);
console.log('Punkte: Q5=' + q5.pts + ' Q3=' + q3.pts + ' Q1=' + q1.pts + ' | Segmente: Q5=' + q5.segs + ' Q3=' + q3.segs + ' Q1=' + q1.segs);
for (const [lbl, r] of [['Q5', q5], ['Q3', q3], ['Q1', q1]]) if (r.thrown) { console.log('FAIL: redraw wirft bei ' + lbl + ': ' + r.thrown); ok = false; }
if (q5.pts !== rawPts) { console.log('FAIL: Q5 (bypass) != Roh-Punkte (' + q5.pts + ' vs ' + rawPts + ')'); ok = false; }
if (!(q5.pts >= q3.pts && q3.pts >= q1.pts)) { console.log('FAIL: nicht monoton fallend'); ok = false; }
if (!(q1.pts < q5.pts)) { console.log('FAIL: Q1 nicht echt kleiner als Q5'); ok = false; }

// --- redraw an ALLEN Stufen wirft nichts (auch Q2/Q4) ---
const drawErr = await page.evaluate(() => { for (const q of [1, 2, 3, 4, 5]) { setQuality(q); redraw(); } return null; }).then(() => null).catch(e => e.message);
if (drawErr) { console.log('FAIL: redraw wirft auf einer Stufe: ' + drawErr); ok = false; }

// --- .lac-Export: path_data an Q1 echt kleiner als an Q5 (bypass) ---
fs.mkdirSync('/tmp/studio_quality', { recursive: true });
async function exportLen(q, file) {
  await page.evaluate((q) => { setQuality(q); $('inFname').value = 'Q' + q; }, q);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportLac())]);
  await dl.saveAs('/tmp/studio_quality/' + file);
  execSync('cd /tmp/studio_quality && rm -rf out && mkdir out && unzip -oq ' + file + ' -d out');
  const objs = JSON.parse(fs.readFileSync('/tmp/studio_quality/out/2D/2dmodel.json', 'utf8')).canvas_list[0].obj_list;
  return { pathLen: objs.reduce((s, o) => s + (o.path_data ? o.path_data.length : 0), 0), objs: objs.length, bytes: fs.statSync('/tmp/studio_quality/' + file).size };
}
const e5 = await exportLen(5, 'q5.lac'), e1 = await exportLen(1, 'q1.lac');
console.log('.lac path_data: Q5=' + e5.pathLen + ' (' + e5.bytes + 'B) Q1=' + e1.pathLen + ' (' + e1.bytes + 'B), Objekte Q5=' + e5.objs + ' Q1=' + e1.objs);
if (!(e1.pathLen < e5.pathLen)) { console.log('FAIL: .lac path_data an Q1 nicht kleiner als an Q5'); ok = false; }
if (e5.objs < 2 || e1.objs < 2) { console.log('FAIL: Ebenen im Export verloren'); ok = false; }

// --- Persistenz: quality läuft durch serializeLayout → loadLayout zurück ---
const rt = await page.evaluate(() => {
  setQuality(2);
  const json = serializeLayout();
  const serialized = json.quality;
  setQuality(5);
  loadLayout(json);
  return { serialized, restored: S.quality };
});
console.log('Persistenz: serialize=' + rt.serialized + ' → restore=' + rt.restored);
if (!(rt.serialized === 2 && rt.restored === 2)) { console.log('FAIL: quality-Round-Trip'); ok = false; }

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ STUDIO QUALITY TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
