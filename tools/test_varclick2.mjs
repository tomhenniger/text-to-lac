import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(appDir + '/handschrift.html');
await page.evaluate(() => localStorage.clear());
await page.setInputFiles('#fileImport', '/Users/tomhenniger/Downloads/toms_handschrift.handschrift.json');
await page.waitForTimeout(300);
await Promise.all([page.waitForNavigation(), page.click('#btnUse')]);
await page.fill('#inpText', 'Tom');
await page.waitForTimeout(300);
const shapes = await page.evaluate(() => {
  const f = currentFont();
  const out = [];
  for (let k = 0; k < 3; k++) {
    S.charVar["0:1"] = k;
    relayout();
    const g = cachedLayout.glyphs[1];
    out.push({ variante: k, striche: g.strokes.length,
               punkte: g.strokes.reduce((a, s) => a + s.length, 0),
               erster: g.strokes[0][0].map(v => Math.round(v * 10) / 10) });
  }
  return { n: f.glyphsVar['o'].length, advs: f.glyphsVar['o'].map(v => v.adv), out };
});
console.log("Varianten von 'o' im Font:", shapes.n, "| advs:", shapes.advs);
for (const s of shapes.out) console.log(s);
await browser.close();
