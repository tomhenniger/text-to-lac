import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const approx = (a, b, t = 0.01) => Math.abs(a - b) < t;

const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.goto('file://' + path.join(appDir, 'studio.html'));
await page.waitForTimeout(300);

// 3 Test-Layer ohne iframe direkt einsetzen (Geometrie als Rechteck-Strich)
await page.evaluate(() => {
  const mk = (x, y, w, h) => { const L = makeLayer('misc', 'qr'); L.cw = w; L.ch = h; L.strokesCache = [[[0, 0], [w, 0], [w, h], [0, h], [0, 0]]]; L.transform = { x, y, scale: 1, rot: 0 }; S.layers.push(L); return L; };
  mk(10, 10, 20, 20); mk(50, 80, 30, 10); mk(120, 40, 20, 40);
  S.selIds = S.layers.map(L => L.id); S.selId = S.layers[2].id; updatePropsUI(); renderList(); redraw();
});

// --- Multiselect-Status ---
{
  const n = await page.evaluate(() => S.selIds.length);
  const alignEnabled = await page.evaluate(() => !document.querySelector('#alignRow .abtn').disabled);
  const distEnabled = await page.evaluate(() => !document.querySelector('.distbtn').disabled);
  const primary = await page.evaluate(() => document.querySelectorAll('.lrow.primary').length);
  const selRows = await page.evaluate(() => document.querySelectorAll('.lrow.sel').length);
  console.log(`multiselect: n=${n} alignEnabled=${alignEnabled} distEnabled=${distEnabled} primaryRows=${primary} selRows=${selRows}`);
  if (n !== 3 || !alignEnabled || !distEnabled || primary !== 1 || selRows !== 3) { console.log('FAIL multiselect-status'); ok = false; }
}

// --- Align left (Bezug: Auswahl) → alle minX gleich = min(10,50,120)=10 ---
{
  const xs = await page.evaluate(() => { $('alignRef').value = 'selection'; alignLayers('left'); return S.layers.map(L => layerAABB(L).minX); });
  console.log('align left minX:', xs.map(v => +v.toFixed(2)));
  if (!xs.every(v => approx(v, 10))) { console.log('FAIL align left'); ok = false; }
}

// --- Align top → alle minY gleich = min(10,80,40)=10 ---
{
  const ys = await page.evaluate(() => { alignLayers('top'); return S.layers.map(L => layerAABB(L).minY); });
  console.log('align top minY:', ys.map(v => +v.toFixed(2)));
  if (!ys.every(v => approx(v, 10))) { console.log('FAIL align top'); ok = false; }
}

// --- Reset Positionen, dann horizontal verteilen (gleiche Lücken) ---
{
  const gaps = await page.evaluate(() => {
    S.layers[0].transform = { x: 10, y: 10, scale: 1, rot: 0 };   // w20 → [10,30]
    S.layers[1].transform = { x: 40, y: 10, scale: 1, rot: 0 };   // w30 → [40,70]
    S.layers[2].transform = { x: 150, y: 10, scale: 1, rot: 0 };  // w20 → [150,170]
    $('alignRef').value = 'selection'; distribute('h');
    const bb = S.layers.map(L => layerAABB(L)).sort((a, b) => a.minX - b.minX);
    return [bb[1].minX - bb[0].maxX, bb[2].minX - bb[1].maxX];   // zwei Lücken
  });
  console.log('distribute h gaps:', gaps.map(v => +v.toFixed(3)));
  // Span [10..170]=160, Summe Breiten=70 → 2 Lücken je (160-70)/2=45
  if (!approx(gaps[0], gaps[1], 0.05) || !approx(gaps[0], 45, 0.1)) { console.log('FAIL distribute'); ok = false; }
}

// --- Align an Arbeitsfläche: horizontal zentrieren → centerX = matW/2 = 150 ---
{
  const cx = await page.evaluate(() => { $('alignRef').value = 'area'; alignLayers('hcenter'); return S.layers.map(L => { const a = layerAABB(L); return (a.minX + a.maxX) / 2; }); });
  console.log('align-to-area hcenter centerX:', cx.map(v => +v.toFixed(2)));
  if (!cx.every(v => approx(v, 150, 0.1))) { console.log('FAIL align-to-area'); ok = false; }
}

// --- Selektions-API: selectLayer / toggleSelect / rangeSelect / selectAll ---
{
  const r = await page.evaluate(() => {
    const ids = S.layers.map(L => L.id);
    selectLayer(ids[0]); const a = [S.selIds.length, S.selId === ids[0]];
    toggleSelect(ids[2]); const b = [S.selIds.length, S.selId === ids[2]];     // 2 ausgewählt, primary letzte
    toggleSelect(ids[2]); const c = [S.selIds.length, S.selId === ids[0]];     // wieder abgewählt, primary zurück
    selectLayer(ids[1]); rangeSelect(ids[2]); const d = S.selIds.length;        // Bereich 1..2 → 2
    selectAll(); const e = S.selIds.length;
    selectLayer(null); const f = S.selIds.length;
    return { a, b, c, d, e, f };
  });
  console.log('sel-API:', JSON.stringify(r));
  if (!(r.a[0] === 1 && r.a[1] && r.b[0] === 2 && r.b[1] && r.c[0] === 1 && r.c[1] && r.d === 2 && r.e === 3 && r.f === 0)) { console.log('FAIL sel-API'); ok = false; }
}

// --- Single-Select: alignRef "Auswahl" deaktiviert, Distribute deaktiviert ---
{
  const st = await page.evaluate(() => { selectLayer(S.layers[0].id); return { selOptDisabled: $('alignRef').querySelector('option[value=selection]').disabled, refVal: $('alignRef').value, distDisabled: document.querySelector('.distbtn').disabled, xform: getComputedStyle($('obXform')).display !== 'none' }; });
  console.log('single-select:', JSON.stringify(st));
  if (!(st.selOptDisabled && st.refVal !== 'selection' && st.distDisabled && st.xform)) { console.log('FAIL single-select-ui'); ok = false; }
}

// --- distribute (Bezug Auswahl) mit überlappenden/größenverschiedenen Layern: Bounding-Box bleibt fix ---
{
  const r = await page.evaluate(() => {
    S.layers.forEach(L => { if (L._frame) L._frame.remove(); }); S.layers.length = 0; S.selIds = []; S.selId = null;
    const mk = (x, w) => { const L = makeLayer('misc', 'qr'); L.cw = w; L.ch = 20; L.strokesCache = [[[0, 0], [w, 0], [w, 20], [0, 20], [0, 0]]]; L.transform = { x, y: 10, scale: 1, rot: 0 }; S.layers.push(L); return L; };
    mk(0, 10); mk(-50, 150); mk(200, 10);   // AABB [0,10] [-50,100] [200,210]
    S.selIds = S.layers.map(L => L.id); S.selId = S.layers[2].id;
    $('alignRef').value = 'selection'; distribute('h');
    const bb = S.layers.map(L => layerAABB(L));
    const minX = Math.min(...bb.map(b => b.minX)), maxX = Math.max(...bb.map(b => b.maxX));
    const s = bb.slice().sort((a, b) => a.minX - b.minX);
    return { minX, maxX, gaps: [s[1].minX - s[0].maxX, s[2].minX - s[1].maxX] };
  });
  console.log(`distribute overlap → unionMinX=${r.minX.toFixed(1)} unionMaxX=${r.maxX.toFixed(1)} gaps=${JSON.stringify(r.gaps.map(g => +g.toFixed(2)))}`);
  // Außenkanten bleiben bei [-50, 210], Lücken gleich (45)
  if (!(approx(r.minX, -50, 0.1) && approx(r.maxX, 210, 0.1) && approx(r.gaps[0], r.gaps[1], 0.1) && approx(r.gaps[0], 45, 0.2))) { console.log('FAIL distribute-overlap'); ok = false; }
}

// --- Sticky-Snap behoben: beim Ziehen über eine Snap-Linie bleibt der Layer nicht kleben ---
{
  await page.evaluate(() => {
    S.layers.forEach(L => { if (L._frame) L._frame.remove(); }); S.layers.length = 0; S.selIds = []; S.selId = null;
    S.view.scale = 1; S.view.ox = 50; S.view.oy = 50; S.snap = true; $('inSnap').checked = true;
    const L = makeLayer('misc', 'qr'); L.cw = 20; L.ch = 20; L.strokesCache = [[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]]; L.transform = { x: 120, y: 120, scale: 1, rot: 0 };
    S.layers.push(L); S.selIds = [L.id]; S.selId = L.id; updatePropsUI(); redraw();
  });
  const coords = await page.evaluate(() => {
    const rect = cv.getBoundingClientRect(), tc = (mx, my) => ({ x: rect.left + mx * S.view.scale + S.view.ox, y: rect.top + my * S.view.scale + S.view.oy });
    const path = []; for (let mx = 130; mx <= 210; mx += 1) path.push(tc(mx, 130));   // Cursor 1mm-Schritte über Snap-Ziel x=150 hinweg
    return { start: tc(130, 130), path };
  });
  await page.mouse.move(coords.start.x, coords.start.y); await page.mouse.down();
  for (const p of coords.path) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  const minX = await page.evaluate(() => layerAABB(S.layers[0]).minX);
  console.log(`sticky-snap: finale minX=${minX.toFixed(1)} (Snap-Ziel 150, Cursor endet bei 200)`);
  if (!(minX > 190)) { console.log('FAIL: Layer klebt an der Snap-Linie'); ok = false; }
}

// Screenshot der Mehrfachauswahl
await page.evaluate(() => {
  S.layers.forEach(L => { if (L._frame) L._frame.remove(); }); S.layers.length = 0; S.selIds = []; S.selId = null;
  const mk = (x, y) => { const L = makeLayer('misc', 'qr'); L.cw = 30; L.ch = 30; L.strokesCache = [[[0, 0], [30, 0], [30, 30], [0, 30], [0, 0]]]; L.transform = { x, y, scale: 1, rot: 0 }; S.layers.push(L); };
  mk(40, 40); mk(90, 80); mk(150, 50);
  S.selIds = S.layers.map(L => L.id); S.selId = S.layers[2].id; updatePropsUI(); renderList(); redraw();
});
await page.screenshot({ path: '/tmp/studio_test/align.png' });

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await page.close();
await browser.close();
console.log(ok ? '\n✅ ALIGN TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
