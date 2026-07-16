import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto(appDir + '/index.html?panel=capture');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
await page.setInputFiles('#fileHwImport', '/Users/tomhenniger/Downloads/toms_handschrift.handschrift.json');
await page.waitForTimeout(300);
await page.click('#btnHwUse');
await page.waitForFunction(() => document.getElementById('captureModal').hidden);
await page.fill('#inpText', 'Tom');
await page.waitForTimeout(300);
const shapes = await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  const f = window.TextLayer.fontById(l.fontId);
  const out = [];
  for (let k = 0; k < 3; k++) {
    l.charVar["0:1"] = { v: k, ch: 'o' };
    window.__studio.Layers.invalidate(l.id);
    window.__studio.relayout();
    const g = window.__studio.activeLayout().glyphs[1];
    out.push({ variante: k, striche: g.strokes.length,
               punkte: g.strokes.reduce((a, s) => a + s.length, 0),
               erster: g.strokes[0][0].map(v => Math.round(v * 10) / 10) });
  }
  return { n: f.glyphsVar['o'].length, advs: f.glyphsVar['o'].map(v => v.adv), out };
});
console.log("Varianten von 'o' im Font:", shapes.n, "| advs:", shapes.advs);
for (const s of shapes.out) console.log(s);
await browser.close();
