import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const root = path.join(here, '..');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;

// --- 1) Advanced-Toggle auf der Landing blendet die Studio-Karte ein ---
{
  const page = await browser.newPage();
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => getComputedStyle(document.getElementById('cardStudio')).display);
  await page.click('#btnAdv');
  const after = await page.evaluate(() => getComputedStyle(document.getElementById('cardStudio')).display);
  console.log('landing: cardStudio display vorher=' + before + ' nachher=' + after);
  if (before !== 'none' || after === 'none') { console.log('FAIL: Advanced-Toggle'); ok = false; }
  await page.close();
}

// --- 2) Studio: Layer anlegen, Striche cachen, Transform, Export ---
{
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
  await page.goto('file://' + path.join(appDir, 'studio.html'));
  await page.waitForTimeout(400);

  async function addAndWait(call, label) {
    await page.evaluate(call);   // z.B. () => addLayer('misc','qr')
    await page.waitForFunction(() => S.layers.length && S.layers[S.layers.length - 1].strokesCache.length > 0, null, { timeout: 20000 });
    const n = await page.evaluate(() => S.layers[S.layers.length - 1].strokesCache.length);
    console.log('Layer "' + label + '" Striche=' + n);
    if (!(n > 0)) ok = false;
  }
  await addAndWait(() => addLayer('misc', 'qr'), 'QR');
  await addAndWait(() => addLayer('text'), 'Text');

  const layers = await page.evaluate(() => S.layers.map(L => ({ type: L.type, tool: L.tool, name: L.name, n: L.strokesCache.length, cw: +L.cw.toFixed(1), ch: +L.ch.toFixed(1) })));
  console.log('Layer:', JSON.stringify(layers));
  // generische Namen "Layer N" (nicht der Tool-Name)
  if (!(/^Layer \d+$/.test(layers[0].name) && /^Layer \d+$/.test(layers[1].name) && layers[0].name !== layers[1].name)) { console.log('FAIL: Ebenen heißen nicht "Layer N"'); ok = false; }

  // Inline-Umbenennen: Escape verwirft, Enter übernimmt
  const rn = await page.evaluate(() => {
    const L = S.layers[0], orig = L.name, lns = document.querySelectorAll('.lrow .ln');
    const fire = (inp, key) => inp.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    startRename(L, lns[lns.length - 1]); let inp = document.querySelector('.lnedit'); inp.value = 'VERWORFEN'; fire(inp, 'Escape');
    const afterEsc = L.name;
    const lns2 = document.querySelectorAll('.lrow .ln'); startRename(L, lns2[lns2.length - 1]); inp = document.querySelector('.lnedit'); inp.value = 'NeuerName'; fire(inp, 'Enter');
    return { orig, afterEsc, afterEnter: L.name };
  });
  console.log('rename:', JSON.stringify(rn));
  if (!(rn.afterEsc === rn.orig && rn.afterEnter === 'NeuerName')) { console.log('FAIL: Umbenennen (Escape/Enter)'); ok = false; }

  // Transform: ersten Layer (QR) verschieben + skalieren + drehen via Inputs
  await page.evaluate(() => { selectLayer(S.layers[0].id); });
  await page.fill('#inLx', '60'); await page.dispatchEvent('#inLx', 'input');
  // Größe wird jetzt in echten mm angezeigt (B = cw·scale). Für scale 0.6 also cw·0.6 in das Breitenfeld.
  const cw = await page.evaluate(() => S.layers[0].cw);
  await page.fill('#inLw', String(cw * 0.6)); await page.dispatchEvent('#inLw', 'input');
  await page.fill('#inLr', '30'); await page.dispatchEvent('#inLr', 'input');
  const tf = await page.evaluate(() => S.layers[0].transform);
  // Breiten-/Höhenfeld muss die echten mm zeigen (cw·scale, ch·scale), gekoppelt an die Skalierung
  const dims = await page.evaluate(() => ({ w: +document.getElementById('inLw').value, h: +document.getElementById('inLh').value, ew: Math.round(S.layers[0].cw * S.layers[0].transform.scale), eh: Math.round(S.layers[0].ch * S.layers[0].transform.scale) }));
  console.log('QR transform:', JSON.stringify(tf), '| mm-Anzeige:', JSON.stringify(dims));
  if (!(tf.x === 60 && Math.abs(tf.scale - 0.6) < 1e-4 && Math.abs(tf.rot - Math.PI / 6) < 1e-3)) { console.log('FAIL transform'); ok = false; }
  if (!(dims.w === dims.ew && dims.h === dims.eh)) { console.log('FAIL: mm-Anzeige nicht an Skalierung gekoppelt'); ok = false; }
  // Review-Fix: getippte mm dürfen die Skalierung nicht über die Griff-Grenzen (0.05–50) hinaus treiben
  const clamp = await page.evaluate(() => { const cw = S.layers[0].cw; const inp = document.getElementById('inLw'); inp.value = String(cw * 9999); inp.dispatchEvent(new Event('input', { bubbles: true })); return S.layers[0].transform.scale; });
  console.log('scale nach Riesen-Breite:', clamp);
  if (clamp > 50.0001) { console.log('FAIL: Skalierung nicht geklammert'); ok = false; }
  await page.evaluate(() => { selectLayer(S.layers[0].id); const inp = document.getElementById('inLw'); inp.value = String(S.layers[0].cw * 0.6); inp.dispatchEvent(new Event('input', { bubbles: true })); });   // zurück auf 0.6 für den Export

  // Export (Dateiname-Feld liegt im versteckten Container, Export via Menü-Funktion)
  fs.mkdirSync('/tmp/studio_test', { recursive: true });
  // QR-Ebene umbenennen + auf "Schneiden" setzen → Name + KCBasicCut im Export
  await page.evaluate(() => { $('inFname').value = 'KompoTest'; S.layers[0].mode = 'KCBasicCut'; S.layers[0].name = 'Schnittebene'; });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportLac())]);
  await dl.saveAs('/tmp/studio_test/k.lac');
  execSync('cd /tmp/studio_test && rm -rf out && mkdir out && unzip -oq k.lac -d out');
  const objs = JSON.parse(fs.readFileSync('/tmp/studio_test/out/2D/2dmodel.json', 'utf8')).canvas_list[0].obj_list;
  console.log('.lac Objekte:', objs.map(o => o.name + '(' + o.path_data.length + ')').join(', '));
  if (objs.length < 2 || objs.some(o => !o.path_data || o.path_data.length < 10)) { console.log('FAIL export'); ok = false; }
  if (!objs.some(o => o.name === 'Schnittebene')) { console.log('FAIL: Ebenenname nicht als Objektname exportiert'); ok = false; }
  const proc = JSON.parse(fs.readFileSync('/tmp/studio_test/out/Metadata2D/project_settings.json', 'utf8')).canvas_settings[0].object_settings.map(o => o.process_type);
  console.log('Prozess-Typen:', JSON.stringify(proc));
  if (!(proc.includes('KCBasicCut') && proc.includes('KCPenDraw'))) { console.log('FAIL: Plotter-Modus pro Objekt nicht im Export'); ok = false; }

  await page.screenshot({ path: '/tmp/studio_test/studio.png', clip: { x: 320, y: 0, width: 1180, height: 900 } });
  if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
  await page.close();
}

await browser.close();
console.log(ok ? '\n✅ STUDIO TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
