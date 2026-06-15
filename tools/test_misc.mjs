import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.goto('file://' + path.join(here, '..', 'app', 'misc.html'));
fs.mkdirSync('/tmp/misc_test', { recursive: true });
let ok = true;

// ---- QR ----
await page.selectOption('#inpTool', 'qr');
await page.fill('#inpQrText', 'https://handschrift.art');
await page.waitForTimeout(700);
const qr = await page.evaluate(() => ({ n: S.strokes.length, cw: +S.cw.toFixed(1), ch: +S.ch.toFixed(1), info: document.getElementById('stInfo').textContent }));
console.log('QR:', JSON.stringify(qr));
if (qr.n < 20) { console.log('FAIL: QR zu wenige Linien'); ok = false; }
if (Math.abs(qr.cw - qr.ch) > 0.5) { console.log('FAIL: QR nicht quadratisch'); ok = false; }
const [dlq] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await dlq.saveAs('/tmp/misc_test/qr.lac');

// ---- Spotify ---- (echtes Netz)
await page.selectOption('#inpTool', 'spotify');
await page.fill('#inpSpLink', 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
await page.click('#btnSpLoad');
await page.waitForTimeout(3500);
const sp = await page.evaluate(() => ({ n: S.strokes.length, cw: +S.cw.toFixed(1), ch: +S.ch.toFixed(1), info: document.getElementById('stInfo').textContent }));
console.log('Spotify:', JSON.stringify(sp));
if (sp.n < 50) { console.log('FAIL: Spotify zu wenige Linien (Netzwerk?)'); ok = false; }
if (!(sp.cw > sp.ch * 2)) { console.log('FAIL: Spotify-Code sollte breit sein (4:1-ish)'); ok = false; }
await page.screenshot({ path: '/tmp/misc_test/spotify.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });
const [dls] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await dls.saveAs('/tmp/misc_test/spotify.lac');

// Logo-Umschaltung: ohne Logo schmaler (weniger Breite)
const cwWithLogo = sp.cw;
await page.uncheck('#inpSpLogo');
await page.waitForTimeout(600);
const cwNoLogo = await page.evaluate(() => +S.cw.toFixed(1));
console.log('Breite mit/ohne Logo:', cwWithLogo, cwNoLogo);

await browser.close();

// .lac-Inhalt prüfen
for (const f of ['qr', 'spotify']) {
  execSync(`cd /tmp/misc_test && rm -rf ${f}_out && mkdir ${f}_out && unzip -oq ${f}.lac -d ${f}_out`);
  const model = JSON.parse(fs.readFileSync(`/tmp/misc_test/${f}_out/2D/2dmodel.json`, 'utf8'));
  const objs = model.canvas_list[0].obj_list;
  const hasPath = objs.length && objs[0].path_data.length > 50;
  console.log(`${f}.lac: ${objs.length} Objekt(e), Pfad-Daten ${hasPath ? 'OK' : 'LEER'}`);
  if (!hasPath) { console.log('FAIL: ' + f + ' .lac ohne Pfad'); ok = false; }
}
if (errs.length) { console.log('FAIL: JS-Fehler:', errs); ok = false; }
console.log(ok ? '\n✅ MISC TOOLS TEST PASSED' : '\n❌ TEST FAILED');
process.exit(ok ? 0 : 1);
