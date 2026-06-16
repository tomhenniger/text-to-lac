import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
await page.goto('file://' + path.join(here, '..', 'app', 'misc.html'));
fs.mkdirSync('/tmp/misc_all', { recursive: true });

const read = () => page.evaluate(() => ({ n: S.strokes.length, cw: +S.cw.toFixed(1), ch: +S.ch.toFixed(1), info: document.getElementById('stInfo').textContent }));
const sel = async v => { await page.selectOption('#inpTool', v); await page.waitForTimeout(700); };
const shot = async v => { await page.screenshot({ path: `/tmp/misc_all/${v}.png`, clip: { x: 340, y: 0, width: 1160, height: 900 } }); };
const results = {};

// --- file injector (runs in page): build a File, set on input, dispatch change ---
async function injectFile(inputId, kind) {
  await page.evaluate(async ({ inputId, kind }) => {
    let file;
    if (kind === 'svg') {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="55" rx="8" fill="none" stroke="#000"/><circle cx="50" cy="45" r="25" fill="none" stroke="#000"/><path d="M12 85 C 35 65, 65 65, 88 85" fill="none" stroke="#000"/><line x1="10" y1="92" x2="90" y2="92"/></svg>';
      file = new File([svg], 't.svg', { type: 'image/svg+xml' });
    } else if (kind === 'png') {
      const c = document.createElement('canvas'); c.width = 120; c.height = 120;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 120);
      g.fillStyle = '#000'; g.beginPath(); g.arc(60, 60, 40, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 48, 8, 0, 7); g.fill();
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      file = new File([blob], 't.png', { type: 'image/png' });
    } else if (kind === 'wav') {
      const sr = 16000, dur = 0.4, n = Math.floor(sr * dur);
      const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
      ws(36, 'data'); dv.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) { const v = Math.sin(i / sr * 2 * Math.PI * 220) * Math.sin(i / n * Math.PI) * 0.8; dv.setInt16(44 + i * 2, v * 32767, true); }
      file = new File([buf], 't.wav', { type: 'audio/wav' });
    }
    const inp = document.getElementById(inputId);
    const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, { inputId, kind });
}

// 1) QR presets (WiFi)
await sel('qr');
await page.evaluate(() => { const t = document.getElementById('inpQrType'); t.value = 'wifi'; t.dispatchEvent(new Event('input', { bubbles: true })); });
await page.fill('#inpQrWifiSsid', 'MeinWLAN'); await page.fill('#inpQrWifiPass', 'geheim123');
await page.waitForTimeout(600); results['qr-wifi'] = await read();

// 2) plain generators
for (const v of ['paper', 'pentest', 'spacefill', 'spiro', 'maze', 'fxplot']) {
  await sel(v); results[v] = await read(); await shot(v);
}

// 2b) shapes (parametrisch): Stern mit Füllung
await sel('shapes');
await page.evaluate(() => { const s = document.getElementById('inpShape'); s.value = 'star'; s.dispatchEvent(new Event('input', { bubbles: true })); const f = document.getElementById('inpShapeFill'); f.checked = true; f.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(300); results['shapes'] = await read(); await shot('shapes');
// Linie (achsenparallel) darf NICHT cw=0/ch=0 liefern (sonst im Studio nicht editierbar)
const lineBox = await page.evaluate(() => { const s = document.getElementById('inpShape'); s.value = 'line'; s.dispatchEvent(new Event('input', { bubbles: true })); return { cw: S.cw, ch: S.ch, n: S.strokes.length }; });
const lineOk = lineBox.cw > 0 && lineBox.ch > 0 && lineBox.n >= 1;
console.log('shapes line bbox:', JSON.stringify(lineBox), lineOk ? 'OK' : 'FAIL');

// 3) file tools
await sel('svg'); await injectFile('inpSvgFile', 'svg'); await page.waitForTimeout(900); results['svg'] = await read(); await shot('svg');
await sel('tsp'); await injectFile('inpTspFile', 'png'); await page.waitForTimeout(2500); results['tsp'] = await read(); await shot('tsp');
await sel('wave'); await injectFile('inpWaveFile', 'wav'); await page.waitForTimeout(1500); results['wave'] = await read(); await shot('wave');

// 4) export .lac for a representative set
await sel('maze');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await dl.saveAs('/tmp/misc_all/maze.lac');

await browser.close();

console.log('=== results ===');
let ok = true;
if (!lineOk) { console.log('FAIL: Linien-Form hat 0-Dimension (im Studio nicht editierbar)'); ok = false; }
for (const [k, r] of Object.entries(results)) {
  const good = r.n > 0 && r.cw > 0;
  console.log(`${good ? 'OK ' : 'FAIL'} ${k.padEnd(12)} strokes=${String(r.n).padStart(6)} cw=${r.cw} ch=${r.ch} | ${r.info}`);
  if (!good) ok = false;
}
// validate maze .lac
try {
  const { execSync } = await import('child_process');
  execSync('cd /tmp/misc_all && rm -rf out && mkdir out && unzip -oq maze.lac -d out');
  const model = JSON.parse(fs.readFileSync('/tmp/misc_all/out/2D/2dmodel.json', 'utf8'));
  const objs = model.canvas_list[0].obj_list;
  console.log('maze.lac objects:', objs.length, 'path len:', objs[0]?.path_data?.length || 0);
  if (!objs.length || !objs[0].path_data) ok = false;
} catch (e) { console.log('lac validate err', e.message); ok = false; }
if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs, null, 1)); ok = false; }
console.log(ok ? '\n✅ ALL MISC TOOLS PASSED' : '\n❌ FAILURES ABOVE');
process.exit(ok ? 0 : 1);
