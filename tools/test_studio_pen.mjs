import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
await page.goto('file://' + path.join(appDir, 'studio.html'));
await page.evaluate(() => { try { localStorage.removeItem('ttl_studio_layout'); } catch {} });
await page.waitForTimeout(300);

const toClient = (mm) => page.evaluate((mm) => { const r = cv.getBoundingClientRect(); return mm.map(([x, y]) => ({ x: r.left + x * S.view.scale + S.view.ox, y: r.top + y * S.view.scale + S.view.oy })); }, mm);

// --- Freihand: ziehen → Pfad-Ebene ---
await page.evaluate(() => setTool('free'));
{
  const p = await toClient([[60, 60], [90, 80], [120, 60], [150, 90], [180, 60]]);
  await page.mouse.move(p[0].x, p[0].y); await page.mouse.down();
  for (let i = 1; i < p.length; i++) await page.mouse.move(p[i].x, p[i].y);
  await page.mouse.up();
  const r = await page.evaluate(() => { const L = S.layers[S.layers.length - 1]; return { type: L.type, kind: L.pen && L.pen.kind, n: L.strokesCache.length, pts: L.strokesCache[0] ? L.strokesCache[0].length : 0 }; });
  console.log('freehand:', JSON.stringify(r));
  if (!(r.type === 'pen' && r.kind === 'free' && r.n >= 1 && r.pts >= 2)) { console.log('FAIL: Freihand erzeugt keine Pfad-Ebene'); ok = false; }
}

// --- Bézier: 4 Anker klicken, mit Kurve, Enter ---
await page.evaluate(() => setTool('pen'));
{
  const A = await toClient([[40, 200], [80, 160], [120, 200], [160, 160]]);
  for (let i = 0; i < A.length; i++) {
    await page.mouse.move(A[i].x, A[i].y); await page.mouse.down();
    if (i === 1) { await page.mouse.move(A[i].x + 20, A[i].y - 15); }   // beim 2. Anker ziehen → Kurve
    await page.mouse.up();
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => { const L = S.layers[S.layers.length - 1]; const a1 = L.pen.anchors[1]; return { type: L.type, kind: L.pen && L.pen.kind, anchors: L.pen.anchors.length, n: L.strokesCache.length, curved: !!(a1 && a1.hOut) }; });
  console.log('bezier:', JSON.stringify(r));
  if (!(r.type === 'pen' && r.kind === 'bezier' && r.anchors === 4 && r.n >= 1 && r.curved)) { console.log('FAIL: Bézier-Pfad fehlerhaft'); ok = false; }
}

// --- Pfad bearbeiten: ersten Anker ziehen → Strich ändert sich ---
{
  const before = await page.evaluate(() => { const L = S.layers[S.layers.length - 1]; selectLayer(L.id); startPenEdit(L); return JSON.stringify(L.strokesCache[0]); });
  const anc = await page.evaluate(() => { const L = penEdit.L, a = L.pen.anchors[0], p = layerMap(L)([a.x, a.y]), q = mm2px(p[0], p[1]), r = cv.getBoundingClientRect(); return { x: r.left + q[0] / devicePixelRatio, y: r.top + q[1] / devicePixelRatio }; });
  await page.mouse.move(anc.x, anc.y); await page.mouse.down(); await page.mouse.move(anc.x + 45, anc.y + 35); await page.mouse.up();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => { const L = S.layers[S.layers.length - 1]; return { editing: !!penEdit, after: JSON.stringify(L.strokesCache[0]) }; });
  console.log('edit changed:', before !== r.after, '| stillEditing:', r.editing);
  if (!(before !== r.after && !r.editing)) { console.log('FAIL: Pfad-Bearbeitung greift nicht / Edit-Modus nicht beendet'); ok = false; }
}

// --- "Knoten bearbeiten"-Werkzeug: aktiviert Bearbeitung der gewählten Pfad-Ebene; Hit-Test trifft den sichtbaren Anker ---
{
  const t = await page.evaluate(() => {
    const L = S.layers[S.layers.length - 1]; selectLayer(L.id); setTool('edit');
    const editOn = !!penEdit && penEdit.L === L;
    const a = L.pen.anchors[0], m = layerMap(L)([a.x, a.y]);   // Anker in Matten-mm
    const hit = !!penEditHit(L, m[0], m[1]);                   // Hit-Test an der sichtbaren Anker-Position muss treffen
    setTool('select'); const editOff = !penEdit;
    return { editOn, hit, editOff, btnOn: !!document.querySelector('.toolbtn[data-mode=edit]') };
  });
  console.log('edit-tool:', JSON.stringify(t));
  if (!(t.editOn && t.hit && t.editOff && t.btnOn)) { console.log('FAIL: Edit-Werkzeug / Hit-Test fehlerhaft'); ok = false; }
}

// --- Export enthält beide Pfad-Ebenen ---
const groups = await page.evaluate(() => buildGroups().length);
console.log('buildGroups:', groups);
if (groups < 2) { console.log('FAIL: Pfad-Ebenen nicht im Export'); ok = false; }

// --- Review-Fix: Auswahlwechsel im Edit-Werkzeug beendet die Bearbeitung sauber (kein Leak auf alte Ebene) ---
{
  const sc = await page.evaluate(() => {
    const bez = S.layers.find(x => x.pen && x.pen.kind === 'bezier'), other = S.layers.find(x => x.id !== bez.id);
    selectLayer(bez.id); setTool('edit'); const editing = !!penEdit && penEdit.L.id === bez.id;
    selectLayer(other.id); const leaked = !!penEdit;   // muss false sein
    setTool('select');
    return { editing, leaked, hasOther: !!other };
  });
  console.log('select-while-edit:', JSON.stringify(sc));
  if (!(sc.hasOther && sc.editing && !sc.leaked)) { console.log('FAIL: penEdit leakt bei Auswahlwechsel'); ok = false; }
}

// --- Review-Fix: Autospeichern pausiert während der Pfad-Bearbeitung, speichert nach dem Beenden ---
{
  const as = await page.evaluate(() => new Promise(res => {
    localStorage.removeItem('ttl_studio_layout');
    const bez = S.layers.find(x => x.pen && x.pen.kind === 'bezier'); selectLayer(bez.id); startPenEdit(bez); markDirty();
    setTimeout(() => { const during = localStorage.getItem('ttl_studio_layout'); finishPenEdit(); setTimeout(() => res({ during, after: localStorage.getItem('ttl_studio_layout') }), 800); }, 800);
  }));
  console.log('autosave-during-edit:', JSON.stringify({ during: as.during !== null, after: as.after !== null }));
  if (!(as.during === null && as.after !== null)) { console.log('FAIL: Autospeichern nicht an Pfad-Bearbeitung gekoppelt'); ok = false; }
}

// --- Review-Fix: Löschen der bearbeiteten Ebene räumt penEdit auf (kein Geister-Overlay) ---
{
  const del = await page.evaluate(() => {
    const bez = S.layers.find(x => x.pen && x.pen.kind === 'bezier'); selectLayer(bez.id); setTool('edit');
    const before = !!penEdit; deleteSelected(); const after = !!penEdit; setTool('select');
    return { before, after, gone: !S.layers.some(x => x.id === bez.id) };
  });
  console.log('delete-while-edit:', JSON.stringify(del));
  if (!(del.before && !del.after && del.gone)) { console.log('FAIL: penEdit nicht aufgeräumt beim Löschen'); ok = false; }
}

await page.screenshot({ path: '/tmp/studio_test/pen.png' });
if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ STUDIO PEN TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
