import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const approx = (a, b, t) => Math.abs(a - b) < t;
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
await page.goto('file://' + path.join(appDir, 'studio.html'));
await page.waitForTimeout(400);

// 3D-Modell-Ebene anlegen → erzeugt das eingebettete misc-Tool (tool=model)
await page.evaluate(() => addLayer('misc', 'model'));
await page.waitForTimeout(400);
const frame = page.frames().find(f => /misc\.html/.test(f.url()));
if (!frame) { console.log('FAIL: kein Modell-iframe'); ok = false; }

// Würfel-STL im iframe laden
await frame.evaluate(() => {
  const v = [[-10,-10,-10],[10,-10,-10],[10,10,-10],[-10,10,-10],[-10,-10,10],[10,-10,10],[10,10,10],[-10,10,10]];
  const faces = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
  const nT = faces.length, buf = new ArrayBuffer(84 + nT * 50), dv = new DataView(buf); dv.setUint32(80, nT, true); let o = 84;
  for (const f of faces) { o += 12; for (const i of f) { const p = v[i]; dv.setFloat32(o, p[0], true); dv.setFloat32(o+4, p[1], true); dv.setFloat32(o+8, p[2], true); o += 12; } o += 2; }
  const inp = document.getElementById('inpModelFile'); const dt = new DataTransfer(); dt.items.add(new File([buf], 'wuerfel.stl', { type: 'model/stl' })); inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() => S.layers[0] && S.layers[0].strokesCache.length > 0, null, { timeout: 15000 });
await page.waitForTimeout(300);

const hash = () => page.evaluate(() => JSON.stringify(S.layers[0].strokesCache).length + ':' + JSON.stringify(S.layers[0].strokesCache[0]));
const pre = await page.evaluate(() => ({ cw: S.layers[0].cw, ch: S.layers[0].ch, x: S.layers[0].transform.x, y: S.layers[0].transform.y, sc: S.layers[0].transform.scale, eul: S.layers[0].modelEuler }));
const preHash = await hash();
console.log('vor Drehung:', JSON.stringify({ cw: +pre.cw.toFixed(1), ch: +pre.ch.toFixed(1), eul: pre.eul }));
if (!(pre.cw > 0 && pre.eul)) { console.log('FAIL: kein modelState/cw'); ok = false; }

// --- Trackball: Alt+Ziehen auf der Fläche dreht das Modell, Skalierung/Position bleiben fix ---
const c = await page.evaluate(() => { const L = S.layers[0]; const cx = L.transform.x + L.cw / 2 * L.transform.scale, cy = L.transform.y + L.ch / 2 * L.transform.scale; const q = mm2px(cx, cy), r = cv.getBoundingClientRect(); return { x: r.left + q[0] / devicePixelRatio, y: r.top + q[1] / devicePixelRatio }; });
await page.keyboard.down('Alt');
await page.mouse.move(c.x, c.y); await page.mouse.down();
await page.mouse.move(c.x + 70, c.y + 50); await page.mouse.move(c.x + 130, c.y + 90);
await page.mouse.up();
await page.keyboard.up('Alt');
await page.waitForTimeout(400);
const post = await page.evaluate(() => ({ cw: S.layers[0].cw, ch: S.layers[0].ch, x: S.layers[0].transform.x, y: S.layers[0].transform.y, sc: S.layers[0].transform.scale, eul: S.layers[0].modelEuler }));
const postHash = await hash();
console.log('nach Drehung:', JSON.stringify({ cw: +post.cw.toFixed(1), ch: +post.ch.toFixed(1), eul: post.eul }));
const rotated = preHash !== postHash;
const eulChanged = !pre.eul || !post.eul || Math.hypot(post.eul.x - pre.eul.x, post.eul.y - pre.eul.y) > 1;
const stable = approx(pre.cw, post.cw, 1e-6) && approx(pre.ch, post.ch, 1e-6) && approx(pre.x, post.x, 1e-6) && approx(pre.y, post.y, 1e-6) && approx(pre.sc, post.sc, 1e-6);
console.log('trackball:', JSON.stringify({ rotated, eulChanged, stable }));
if (!rotated) { console.log('FAIL: Alt+Drag dreht nicht'); ok = false; }
if (!eulChanged) { console.log('FAIL: Euler ändert sich nicht'); ok = false; }
if (!stable) { console.log('FAIL: Skalierung/Position ändert sich beim Drehen'); ok = false; }

// --- Exakte Euler-Eingabe (Studio behält die getippten Werte, Tool unterdrückt den Echo) ---
const typeEuler = async (x, y, z) => { await page.evaluate(([x, y, z]) => { $('inLrx').value = x; $('inLry').value = y; $('inLrz').value = z; for (const id of ['inLrx', 'inLry', 'inLrz']) $(id).dispatchEvent(new Event('input', { bubbles: true })); }, [x, y, z]); await page.waitForTimeout(300); };
await typeEuler(30, 40, 0);
const eul = await page.evaluate(() => S.layers[0].modelEuler);
console.log('nach Euler-Eingabe (30,40,0):', JSON.stringify(eul && { x: +eul.x.toFixed(1), y: +eul.y.toFixed(1), z: +eul.z.toFixed(1) }));
if (!(eul && approx(eul.x, 30, 0.01) && approx(eul.y, 40, 0.01) && approx(eul.z, 0, 0.01))) { console.log('FAIL: Euler-Eingabe nicht übernommen'); ok = false; }

// --- Gimbal-Lock: y=90 darf x/z nicht verschlucken (Echo unterdrückt) ---
await typeEuler(30, 90, 40);
const g = await page.evaluate(() => S.layers[0].modelEuler);
console.log('Gimbal (30,90,40):', JSON.stringify(g && { x: +g.x.toFixed(1), y: +g.y.toFixed(1), z: +g.z.toFixed(1) }));
if (!(g && approx(g.x, 30, 0.01) && approx(g.y, 90, 0.01) && approx(g.z, 40, 0.01))) { console.log('FAIL: Gimbal-Lock verschluckt x/z'); ok = false; }

// --- Farbe pro Ebene → Export-Gruppe bekommt die Farbe ---
await page.evaluate(() => { $('inLcolorOn').checked = true; $('inLcolor').value = '#cc0000'; $('inLcolor').dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(150);
const col = await page.evaluate(() => buildGroups().map(g => g.color));
console.log('Export-Farben:', JSON.stringify(col));
if (!(col.length && col.every(c => c === '204 0 0 255'))) { console.log('FAIL: Ebenen-Farbe nicht im Export'); ok = false; }

// --- Duplizieren übernimmt Farbe + 3D-Drehung ---
const dup = await page.evaluate(() => { duplicateSelected(); const a = S.layers[0], b = S.layers.find(L => L.id !== a.id); return { n: S.layers.length, srcColor: a.color, dupColor: b.color, srcEul: a.modelEuler, dupEul: b.modelEuler, aliased: a.modelEuler === b.modelEuler }; });
console.log('Duplikat:', JSON.stringify({ n: dup.n, dupColor: dup.dupColor, dupEul: dup.dupEul && { x: +dup.dupEul.x.toFixed(0), y: +dup.dupEul.y.toFixed(0), z: +dup.dupEul.z.toFixed(0) }, aliased: dup.aliased }));
if (!(dup.n === 2 && dup.dupColor === dup.srcColor && dup.dupEul && approx(dup.dupEul.x, dup.srcEul.x, 0.01) && approx(dup.dupEul.y, dup.srcEul.y, 0.01) && !dup.aliased)) { console.log('FAIL: Duplikat übernimmt Farbe/Drehung nicht (oder aliased)'); ok = false; }

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ STUDIO 3D-ROTATION + FARBE TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
