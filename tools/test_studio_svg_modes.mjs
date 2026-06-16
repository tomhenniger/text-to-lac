import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; page.on('pageerror', e => errs.push('EXC(main): ' + e.message));
await page.goto('file://' + path.join(appDir, 'studio.html'));
await page.evaluate(() => { try { localStorage.removeItem('ttl_studio_layout'); } catch {} });
await page.waitForTimeout(300);

// SVG-Ebene anlegen + gefüllte „Signatur" ins Embed laden
await page.evaluate(() => addLayer('misc', 'svg'));
await page.waitForTimeout(1000);
const sig = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><path d="M20 20 h14 v80 h-14 z" fill="#000"/><path d="M70 20 h14 v80 h-14 z" fill="#000"/><path d="M34 54 h36 v12 h-36 z" fill="#000"/><path d="M110 30 q60 -20 110 30 q-60 50 -110 8 q40 -20 70 -16 q-40 -6 -70 -22 z" fill="#000"/></svg>';
await page.evaluate((svg) => {
  const L = S.layers[S.layers.length - 1], fr = L._frame, win = fr.contentWindow, doc = fr.contentDocument;
  const inp = doc.getElementById('inpSvgFile');
  const file = new win.File([svg], 'sig.svg', { type: 'image/svg+xml' });
  const dt = new win.DataTransfer(); dt.items.add(file); inp.files = dt.files;
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
}, sig);
// auf Rasterung im iframe warten
await page.waitForFunction(() => { const L = S.layers[S.layers.length - 1], d = L._frame.contentWindow.__svgData; return d && d.gray; }, null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);
const outline = await page.evaluate(() => { const L = S.layers[0]; return { n: L.strokesCache.length, pts: L.strokesCache.reduce((a, s) => a + s.length, 0) }; });

// Im Embed auf „Mittellinie" umschalten → Striche müssen im Studio-Layer ankommen
await page.evaluate(() => { const fr = S.layers[0]._frame, doc = fr.contentDocument; const sel = doc.getElementById('inpSvgMode'); sel.value = 'centerline'; sel.dispatchEvent(new fr.contentWindow.Event('input', { bubbles: true })); });
await page.waitForTimeout(900);
const centerline = await page.evaluate(() => { const L = S.layers[0]; return { n: L.strokesCache.length, pts: L.strokesCache.reduce((a, s) => a + s.length, 0), cw: +L.cw.toFixed(1) }; });

console.log('Studio outline   :', JSON.stringify(outline));
console.log('Studio centerline:', JSON.stringify(centerline));
if (!(outline.n >= 1 && outline.pts > 0)) { console.log('FAIL: Umriss kommt nicht im Studio an'); ok = false; }
if (!(centerline.n >= 1 && centerline.pts > 0 && centerline.cw > 0)) { console.log('FAIL: Mittellinie kommt nicht im Studio-Layer an'); ok = false; }
if (!(centerline.pts < outline.pts)) { console.log('FAIL: Mittellinie sollte weniger Punkte als Umriss haben'); ok = false; }

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ STUDIO SVG-MODI TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
