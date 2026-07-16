import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'index.html?layer=image'));
await page.setInputFiles('#fileImg', '/tmp/lac_test/testbild.png');
await page.waitForTimeout(800);

// 1) Versuchen, das Bild weit außerhalb zu ziehen
await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  const W = +document.getElementById('inpMatW').value, H = +document.getElementById('inpMatH').value;
  l.x = -500; l.y = 900; window.ImageLayer.clampPos(l, W, H);
});
const pos = await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  const W = +document.getElementById('inpMatW').value, H = +document.getElementById('inpMatH').value;
  const iw = l.widthMM, ih = iw * l.src.aspect;
  return { x: l.x, y: l.y, drin: l.x >= 0 && l.y >= 0 && l.x + iw <= W && l.y + ih <= H };
});
console.log('Nach Klemmen: x=' + pos.x + ', y=' + pos.y.toFixed(1) + ', im Arbeitsfeld:', pos.drin);

// 2) Per Maus über den Rand ziehen
const bb = await page.locator('#cv').boundingBox();
const start = await page.evaluate(() => {
  const l = window.__studio.Layers.active(), S = window.__studio.S;
  return [(l.x + 20) * S.view.scale + S.view.ox, (l.y + 20) * S.view.scale + S.view.oy];
});
await page.mouse.move(bb.x + start[0], bb.y + start[1]);
await page.mouse.down();
await page.mouse.move(bb.x - 200, bb.y - 100, { steps: 10 });
await page.mouse.up();
const pos2 = await page.evaluate(() => { const l = window.__studio.Layers.active(); return { x: l.x, y: l.y }; });
console.log('Nach Maus-Zerren über den Rand: x=' + pos2.x.toFixed(1) + ', y=' + pos2.y.toFixed(1), '(≥0 erwartet)');

// 3) Bild entfernen
const sichtbar = await page.locator('#rowImgRemove').isVisible();
await page.click('#btnImgRemove');
await page.waitForTimeout(200);
const after = await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  return {
    gray: l.src === null, strokes: window.__studio.Layers.strokesOf(l).length,
    hint: document.getElementById('dropHint').textContent.slice(0, 25),
    btnWeg: document.getElementById('rowImgRemove').style.display === 'none',
  };
});
console.log('Entfernen-Button sichtbar:', sichtbar, '| nach Klick:', JSON.stringify(after));
await browser.close();
