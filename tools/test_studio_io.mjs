import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const HARNESS = path.join(appDir, '_io_harness.html');

// --- A) Export-Sektion im Embed-Modus ausgeblendet ---
{
  const page = await browser.newPage();
  fs.writeFileSync(HARNESS, `<!DOCTYPE html><html><body><iframe id="f" style="width:420px;height:700px" src="misc.html?embed=1&tool=qr"></iframe></body></html>`);
  await page.goto('file://' + HARNESS);
  await page.waitForTimeout(1500);
  const hid = await page.evaluate(() => {
    const d = document.getElementById('f').contentDocument;
    const ex = d.querySelector('.embed-hide');
    return ex ? getComputedStyle(ex).display : 'no-element';
  });
  console.log('embed export section display =', hid, '(erwartet none)');
  if (hid !== 'none') { console.log('FAIL: Export im Embed nicht versteckt'); ok = false; }
  await page.close();
}

// --- B) Save → Load Roundtrip ---
{
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(appDir, 'studio.html'));
  await page.waitForTimeout(300);
  await page.selectOption('#addSel', 'misc:qr');
  await page.waitForFunction(() => S.layers.length && S.layers[0].strokesCache.length > 0, { timeout: 20000 });
  await page.evaluate(() => { S.layers[0].transform = { x: 80, y: 55, scale: 0.7, rot: 0.3 }; redraw(); });
  const pre = await page.evaluate(() => ({ n: S.layers.length, cache: S.layers[0].strokesCache.length, x: S.layers[0].transform.x, sc: S.layers[0].transform.scale, label: S.layers[0].label }));
  console.log('vor Save:', JSON.stringify(pre));

  fs.mkdirSync('/tmp/studio_test', { recursive: true });
  const savePath = '/tmp/studio_test/layout.handschrift';
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnSave')]);
  await dl.saveAs(savePath);
  const saved = JSON.parse(fs.readFileSync(savePath, 'utf8'));
  console.log('Datei: format=' + saved.format + ' layers=' + saved.layers.length + ' hatTransform=' + !!saved.layers[0].transform + ' hatGroupsOderStrokes=' + (!!saved.layers[0].groups || !!saved.layers[0].strokes));
  if (saved.format !== 'handschrift-studio' || saved.layers.length !== 1) { console.log('FAIL save format'); ok = false; }

  // Layout zurücksetzen + laden
  await page.evaluate(() => { S.layers.forEach(L => L._frame && L._frame.remove()); S.layers = []; S.selId = null; renderList(); redraw(); });
  await page.setInputFiles('#fileLoad', savePath);
  await page.waitForTimeout(600);
  const post = await page.evaluate(() => ({ n: S.layers.length, cache: S.layers[0] ? S.layers[0].strokesCache.length : 0, x: S.layers[0] ? S.layers[0].transform.x : null, sc: S.layers[0] ? S.layers[0].transform.scale : null, label: S.layers[0] ? S.layers[0].label : null }));
  console.log('nach Load:', JSON.stringify(post));
  if (!(post.n === 1 && post.cache === pre.cache && post.x === 80 && Math.abs(post.sc - 0.7) < 1e-6)) { console.log('FAIL roundtrip'); ok = false; }

  // Geladenen Layer exportieren → .lac valide
  const groups = await page.evaluate(() => buildGroups().length);
  console.log('buildGroups nach Load:', groups);
  if (groups < 1) { console.log('FAIL export nach Load'); ok = false; }
  if (errs.length) { console.log('JS ERRORS', errs); ok = false; }
  await page.close();
}

await browser.close();
try { fs.unlinkSync(HARNESS); } catch {}
console.log(ok ? '\n✅ STUDIO IO TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
