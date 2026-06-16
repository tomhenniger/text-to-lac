import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const studioUrl = 'file://' + path.join(appDir, 'studio.html');

// --- 1) Autospeichern + Wiederherstellen über Reload (localStorage) ---
{
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(studioUrl);
  await page.evaluate(() => { try { localStorage.removeItem('ttl_studio_layout'); } catch {} });
  await page.evaluate(() => addLayer('misc', 'qr'));
  await page.waitForFunction(() => S.layers.length && S.layers[0].strokesCache.length > 0, null, { timeout: 20000 });
  await page.evaluate(() => { const L = S.layers[0]; L.name = 'Persistiert'; L.transform.x = 99; L.mode = 'KCBasicCut'; renderList(); markDirty(); });
  await page.waitForTimeout(900);   // Autosave-Drossel = 600ms
  const saved = await page.evaluate(() => !!localStorage.getItem('ttl_studio_layout'));
  await page.reload();
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({ n: S.layers.length, name: S.layers[0] ? S.layers[0].name : null, x: S.layers[0] ? S.layers[0].transform.x : null, mode: S.layers[0] ? S.layers[0].mode : null, cache: S.layers[0] ? S.layers[0].strokesCache.length : 0 }));
  console.log('autosave restore:', JSON.stringify({ saved, ...r }));
  if (!(saved && r.n === 1 && r.name === 'Persistiert' && r.x === 99 && r.mode === 'KCBasicCut' && r.cache > 0)) { console.log('FAIL: Layout nicht wiederhergestellt'); ok = false; }
  await page.close();
}

// --- 2) Bereichswarnung (Zeichnen vs. Schneiden) ---
{
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(studioUrl);
  await page.evaluate(() => { try { localStorage.removeItem('ttl_studio_layout'); } catch {} });
  await page.evaluate(() => addLayer('misc', 'qr'));
  await page.waitForFunction(() => S.layers.length && S.layers[0].strokesCache.length > 0, null, { timeout: 20000 });
  // QR 120×120 bei y=150 → maxY=270 (>255 Zeichnen, <285 Schneiden)
  const warnDraw = await page.evaluate(() => { const L = S.layers[0]; L.transform = { x: 0, y: 150, scale: 1, rot: 0 }; L.mode = 'KCPenDraw'; selectLayer(L.id); redraw(); return $('warnInfo').textContent; });
  const warnCut = await page.evaluate(() => { S.layers[0].mode = 'KCBasicCut'; redraw(); return $('warnInfo').textContent; });
  const inside = await page.evaluate(() => { S.layers[0].transform.y = 10; redraw(); return $('warnInfo').textContent; });
  console.log('warn draw:', JSON.stringify(warnDraw), '| cut:', JSON.stringify(warnCut), '| inside:', JSON.stringify(inside));
  if (!(warnDraw && /\d/.test(warnDraw))) { console.log('FAIL: keine Warnung außerhalb Zeichenbereich'); ok = false; }
  if (warnCut !== '') { console.log('FAIL: Schneiden sollte bei y=150 (maxY 270<285) keine Warnung geben'); ok = false; }
  if (inside !== '') { console.log('FAIL: innerhalb sollte keine Warnung geben'); ok = false; }
  await page.close();
}

// --- 3) Tool-Dropdown im Embed ausgeblendet (Toolbar ersetzt es) ---
{
  const page = await browser.newPage({ viewport: { width: 420, height: 700 } });
  await page.goto('file://' + path.join(appDir, 'misc.html') + '?embed=1&tool=qr');
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({ toolDisp: getComputedStyle(document.getElementById('inpTool')).display, optsVisible: !!document.querySelector('.toolopts[data-tool=qr]') && getComputedStyle(document.querySelector('.toolopts[data-tool=qr]')).display !== 'none' }));
  console.log('embed tool dropdown:', JSON.stringify(st));
  if (!(st.toolDisp === 'none' && st.optsVisible)) { console.log('FAIL: Tool-Dropdown nicht versteckt / Optionen weg'); ok = false; }
  await page.close();
}

await browser.close();
console.log(ok ? '\n✅ AUTOSAVE + GUIDES + EMBED-DROPDOWN TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
