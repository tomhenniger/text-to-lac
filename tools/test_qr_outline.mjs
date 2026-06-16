import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
await page.goto('file://' + path.join(here, '..', 'app', 'misc.html'));
let ok = true;

await page.selectOption('#inpTool', 'qr');
await page.waitForTimeout(200);
await page.fill('#inpQrText', 'https://handschrift.art');
await page.evaluate(() => { $('inpQrOutline').checked = true; window.__miscRecompute(); });
await page.waitForTimeout(500);

const r = await page.evaluate(() => {
  const seg = (a, b) => Math.min(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));   // 0 wenn achsenparallel
  let maxSkew = 0, loops = 0, fillBB = [Infinity, Infinity, -Infinity, -Infinity], outBB = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (bb, p) => { bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.min(bb[1], p[1]); bb[2] = Math.max(bb[2], p[0]); bb[3] = Math.max(bb[3], p[1]); };
  for (const st of S.strokes) {
    const closed = st.length > 2 && st[0][0] === st[st.length - 1][0] && st[0][1] === st[st.length - 1][1];
    if (closed) loops++;
    const bb = closed ? outBB : fillBB;
    for (let i = 0; i < st.length; i++) { grow(bb, st[i]); if (i) maxSkew = Math.max(maxSkew, seg(st[i - 1], st[i])); }
  }
  return { n: S.strokes.length, loops, maxSkew, fillBB, outBB, cw: S.cw };
});
console.log('qr outline:', JSON.stringify({ n: r.n, loops: r.loops, maxSkew: +r.maxSkew.toFixed(4) }));
console.log('fillBB:', r.fillBB.map(v => +v.toFixed(2)), 'outBB:', r.outBB.map(v => +v.toFixed(2)));

// (1) Crispe Kanten: jedes Segment achsenparallel → maxSkew praktisch 0 (kein diagonales Wobbeln)
if (!(r.maxSkew < 1e-6)) { console.log('FAIL: Konturen nicht achsenparallel (wobbelt)'); ok = false; }
// (2) mindestens eine geschlossene Kontur-Schleife
if (!(r.loops >= 3)) { console.log('FAIL: keine Kontur-Schleifen'); ok = false; }
// (3) Registrierung: die Kontur umrahmt die Füllung auf allen Seiten (kein Versatz)
const [fx0, fy0, fx1, fy1] = r.fillBB, [ox0, oy0, ox1, oy1] = r.outBB, tol = 0.02;
if (!(ox0 <= fx0 + tol && oy0 <= fy0 + tol && ox1 >= fx1 - tol && oy1 >= fy1 - tol)) { console.log('FAIL: Kontur umrahmt die Füllung nicht'); ok = false; }

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ QR-OUTLINE TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
