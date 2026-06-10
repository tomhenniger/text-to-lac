import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'bild.html'));
await page.setInputFiles('#fileImg', '/tmp/lac_test/testbild.png');
await page.waitForTimeout(800);

// 1) Versuchen, das Bild weit außerhalb zu ziehen
await page.evaluate(() => { S.imgX = -500; S.imgY = 900; clampImgPos(); });
const pos = await page.evaluate(() => {
  const W = +document.getElementById('inpMatW').value, H = +document.getElementById('inpMatH').value;
  const iw = +document.getElementById('inpImgW').value, ih = iw * S.aspect;
  return { x: S.imgX, y: S.imgY, drin: S.imgX >= 0 && S.imgY >= 0 && S.imgX + iw <= W && S.imgY + ih <= H };
});
console.log('Nach Klemmen: x=' + pos.x + ', y=' + pos.y.toFixed(1) + ', im Arbeitsfeld:', pos.drin);

// 2) Per Maus über den Rand ziehen
const bb = await page.locator('#cv').boundingBox();
const start = await page.evaluate(() => [(S.imgX + 20) * S.view.scale + S.view.ox, (S.imgY + 20) * S.view.scale + S.view.oy]);
await page.mouse.move(bb.x + start[0], bb.y + start[1]);
await page.mouse.down();
await page.mouse.move(bb.x - 200, bb.y - 100, { steps: 10 });
await page.mouse.up();
const pos2 = await page.evaluate(() => ({ x: S.imgX, y: S.imgY }));
console.log('Nach Maus-Zerren über den Rand: x=' + pos2.x.toFixed(1) + ', y=' + pos2.y.toFixed(1), '(≥0 erwartet)');

// 3) Bild entfernen
const sichtbar = await page.locator('#rowImgRemove').isVisible();
await page.click('#btnImgRemove');
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({
  gray: S.gray === null, strokes: S.strokes.length,
  hint: document.getElementById('dropHint').textContent.slice(0, 25),
  btnWeg: document.getElementById('rowImgRemove').style.display === 'none',
}));
console.log('Entfernen-Button sichtbar:', sichtbar, '| nach Klick:', JSON.stringify(after));
await browser.close();
