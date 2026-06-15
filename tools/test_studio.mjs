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

  const layers = await page.evaluate(() => S.layers.map(L => ({ type: L.type, tool: L.tool, n: L.strokesCache.length, cw: +L.cw.toFixed(1), ch: +L.ch.toFixed(1) })));
  console.log('Layer:', JSON.stringify(layers));

  // Transform: ersten Layer (QR) verschieben + skalieren + drehen via Inputs
  await page.evaluate(() => { selectLayer(S.layers[0].id); });
  await page.fill('#inLx', '60'); await page.dispatchEvent('#inLx', 'input');
  await page.fill('#inLs', '0.6'); await page.dispatchEvent('#inLs', 'input');
  await page.fill('#inLr', '30'); await page.dispatchEvent('#inLr', 'input');
  const tf = await page.evaluate(() => S.layers[0].transform);
  console.log('QR transform:', JSON.stringify(tf));
  if (!(tf.x === 60 && Math.abs(tf.scale - 0.6) < 1e-6 && Math.abs(tf.rot - Math.PI / 6) < 1e-3)) { console.log('FAIL transform'); ok = false; }

  // Export (Dateiname-Feld liegt im versteckten Container, Export via Menü-Funktion)
  fs.mkdirSync('/tmp/studio_test', { recursive: true });
  await page.evaluate(() => { $('inFname').value = 'KompoTest'; });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportLac())]);
  await dl.saveAs('/tmp/studio_test/k.lac');
  execSync('cd /tmp/studio_test && rm -rf out && mkdir out && unzip -oq k.lac -d out');
  const objs = JSON.parse(fs.readFileSync('/tmp/studio_test/out/2D/2dmodel.json', 'utf8')).canvas_list[0].obj_list;
  console.log('.lac Objekte:', objs.map(o => o.name + '(' + o.path_data.length + ')').join(', '));
  if (objs.length < 2 || objs.some(o => !o.path_data || o.path_data.length < 10)) { console.log('FAIL export'); ok = false; }

  await page.screenshot({ path: '/tmp/studio_test/studio.png', clip: { x: 320, y: 0, width: 1180, height: 900 } });
  if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
  await page.close();
}

await browser.close();
console.log(ok ? '\n✅ STUDIO TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
