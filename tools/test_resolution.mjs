// Kurvenauflösung: Punktzahl steigt monoton mit der Stufe (Q1..Q5); .lac
// path_data wird bei feinerer Auflösung länger. Für Text (mit Zittern) und
// eine Squiggle-Bild-Ebene.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
browser.contexts;
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
page.on('pageerror', e => console.log('EXC:', e.message));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ FEHLER: ') + m); if (!c) fails++; };
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto(appDir + '/index.html');
await page.waitForTimeout(300);

async function setQ(q) {
  await page.evaluate(v => {
    const r = document.getElementById('inpRes'); r.value = v;
    r.dispatchEvent(new Event('input'));
  }, q);
  await page.waitForTimeout(300);
}
const points = () => page.evaluate(() => {
  const l = window.__studio.Layers.active();
  return window.__studio.Layers.strokesOf(l).reduce((a, s) => a + s.length, 0);
});

// ===== Text mit Zittern =====
await page.fill('#inpText', 'Handschrift Auflösung Test — weiche Kurven');
await page.evaluate(() => { const c = document.getElementById('inpVarOn'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); } });
await page.waitForTimeout(200);
const pt = {};
for (const q of [1, 2, 3, 4, 5]) { await setQ(q); pt[q] = await points(); }
console.log('Text-Punkte je Stufe:', JSON.stringify(pt));
ok(pt[1] < pt[2] && pt[2] <= pt[3] && pt[3] < pt[4] && pt[4] < pt[5], 'Text: Punktzahl steigt monoton mit der Auflösung');

async function exportLen(q, file) {
  await setQ(q);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
  await dl.saveAs(file);
  const s = fs.readFileSync(file, 'latin1');
  const m = s.match(/"path_data": "([^"]*)"/g) || [];
  return m.reduce((a, x) => a + x.length, 0);
}
const l1 = await exportLen(1, '/tmp/lac_test/res_q1.lac');
const l3 = await exportLen(3, '/tmp/lac_test/res_q3.lac');
const l5 = await exportLen(5, '/tmp/lac_test/res_q5.lac');
console.log('path_data-Länge Q1/Q3/Q5:', l1, l3, l5);
ok(l1 < l3 && l3 < l5, '.lac path_data: Q1 < Q3 < Q5');

// ===== Squiggle-Bild-Ebene =====
await page.click('#btnAddImage');
await page.setInputFiles('#fileImg', '/tmp/lac_test/testbild.png');
await page.waitForTimeout(600);
await page.selectOption('#inpStyle', 'squiggle');
await page.waitForTimeout(500);
const ptImg = {};
for (const q of [1, 3, 5]) { await setQ(q); ptImg[q] = await points(); }
console.log('Squiggle-Punkte je Stufe:', JSON.stringify(ptImg));
ok(ptImg[1] < ptImg[3] && ptImg[3] < ptImg[5], 'Squiggle-Bild: Punktzahl steigt mit der Auflösung');

await browser.close();
console.log(fails === 0 ? 'RESOLUTION BESTANDEN' : `RESOLUTION: ${fails} PROBLEME`);
process.exit(fails ? 1 : 0);
