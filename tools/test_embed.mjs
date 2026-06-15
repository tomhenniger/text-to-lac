import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const HARNESS = path.join(appDir, '_embed_harness.html');   // im App-Ordner → gleiche file://-Origin wie das iframe
let ok = true;

// Harness im App-Ordner; relative iframe-src (gleiche Origin → postMessage kommt an)
async function embedHarness(page, relUrl) {
  fs.writeFileSync(HARNESS, `<!DOCTYPE html><html><body><iframe id="f" style="width:420px;height:700px;border:0" src="${relUrl}"></iframe>
  <script>window.__msgs=[];window.addEventListener("message",e=>{ if(e.data&&e.data.source==="ttl-tool") window.__msgs.push(e.data); });
  window.__send=m=>document.getElementById("f").contentWindow.postMessage(Object.assign({source:"ttl-studio"},m),"*");</script></body></html>`);
  await page.goto('file://' + HARNESS);
}

// --- Embed: misc (3D-Tool vorselektiert) ---
{
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await embedHarness(page, 'misc.html?embed=1&tool=qr');
  await page.waitForFunction(() => window.__msgs.some(m => m.type === 'ready'), null, { timeout: 10000 });
  await page.waitForFunction(() => window.__msgs.some(m => m.type === 'strokes' && m.groups[0].polylines.length > 0), null, { timeout: 10000 });
  // Chrome versteckt?
  const hidden = await page.evaluate(() => { const d = document.getElementById('f').contentDocument; const nav = d.querySelector('.topnav'); return getComputedStyle(nav).display === 'none' && getComputedStyle(d.getElementById('main')).display === 'none'; });
  const ready = await page.evaluate(() => window.__msgs.find(m => m.type === 'ready'));
  const lastStrokes = await page.evaluate(() => [...window.__msgs].reverse().find(m => m.type === 'strokes'));
  console.log('misc embed: ready.tools=' + (ready.tools ? ready.tools.length : 0) + ' subtool=' + lastStrokes.subtool + ' polylines=' + lastStrokes.groups[0].polylines.length + ' chromeHidden=' + hidden);
  // selectTool → auf paper umschalten, neue Striche
  await page.evaluate(() => window.__send({ type: 'selectTool', tool: 'paper' }));
  await page.waitForFunction(() => { const s = [...window.__msgs].reverse().find(m => m.type === 'strokes'); return s && s.subtool === 'paper'; }, null, { timeout: 8000 });
  console.log('misc embed: selectTool(paper) ok');
  if (!hidden || !ready.tools || ready.tools.length < 5) { console.log('FAIL misc embed'); ok = false; }
  if (errs.length) { console.log('misc errs', errs); ok = false; }
  await page.close();
}

// --- Embed: text + bild posten Striche ---
for (const [tool, url] of [['text', 'index.html?embed=1'], ['bild', 'bild.html?embed=1']]) {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await embedHarness(page, url);
  await page.waitForFunction(() => window.__msgs.some(m => m.type === 'ready'), null, { timeout: 10000 });
  // text hat default-Text → Striche; bild ohne Bild → leere Striche, aber ready muss kommen
  const r = await page.evaluate((t) => { const s = [...window.__msgs].reverse().find(m => m.type === 'strokes'); return { ready: true, sub: s ? s.subtool : null, n: s ? s.groups[0].polylines.length : -1 }; }, tool);
  console.log(tool + ' embed: strokes polylines=' + r.n);
  if (tool === 'text' && !(r.n > 0)) { console.log('FAIL text embed (kein Text-Stroke)'); ok = false; }
  if (errs.length) { console.log(tool + ' errs', errs); ok = false; }
  await page.close();
}

// --- Regression: Normalmodus (ohne ?embed) unverändert: Chrome sichtbar, kein HS_EMBED ---
{
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + appDir + '/misc.html');
  await page.waitForTimeout(500);
  const normal = await page.evaluate(() => ({ embed: window.HS_EMBED, navVisible: getComputedStyle(document.querySelector('.topnav')).display !== 'none', mainVisible: getComputedStyle(document.getElementById('main')).display !== 'none' }));
  console.log('normal misc:', JSON.stringify(normal));
  if (normal.embed || !normal.navVisible || !normal.mainVisible) { console.log('FAIL: Normalmodus verändert!'); ok = false; }
  if (errs.length) { console.log('normal errs', errs); ok = false; }
  await page.close();
}

await browser.close();
try { fs.unlinkSync(HARNESS); } catch {}
console.log(ok ? '\n✅ EMBED TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
