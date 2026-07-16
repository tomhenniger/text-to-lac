import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
browser.contexts; // Tour-Autostart in Tests unterdrücken
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'index.html'));
await page.fill('#inpText', 'Tom');
await page.click('#btnFit');
await page.waitForTimeout(300);

// Mitte des zweiten Buchstabens ('o') in Bildschirm-px ermitteln
const target = await page.evaluate(() => {
  const g = window.__studio.activeLayout().glyphs[1];
  const S = window.__studio.S;
  let nx = 1e9, ny = 1e9, xx = -1e9, xy = -1e9;
  for (const st of g.strokes) for (const [x, y] of st) {
    nx = Math.min(nx, x); ny = Math.min(ny, y); xx = Math.max(xx, x); xy = Math.max(xy, y);
  }
  const cx = (nx + xx) / 2, cy = (ny + xy) / 2;
  return { x: cx * S.view.scale + S.view.ox, y: cy * S.view.scale + S.view.oy, cx, cy };
});
const cvBox = await page.locator('#cv').boundingBox();
const before = await page.evaluate(() => JSON.stringify(window.__studio.activeLayout().glyphs.map(g => g.strokes[0][0])));
await page.mouse.move(cvBox.x + target.x, cvBox.y + target.y);
await page.mouse.down();
await page.mouse.move(cvBox.x + target.x + 60, cvBox.y + target.y - 40, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(200);
const result = await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  return { charOff: JSON.stringify(l.charOff), lineOff: JSON.stringify(l.lineOff), textX: l.x };
});
const after = await page.evaluate(() => JSON.stringify(window.__studio.activeLayout().glyphs.map(g => g.strokes[0][0])));
console.log('charOff:', result.charOff, '| lineOff:', result.lineOff);
const b = JSON.parse(before), a = JSON.parse(after);
const moved = b.map((p, i) => Math.hypot(a[i][0] - p[0], a[i][1] - p[1]).toFixed(1));
console.log('Bewegung pro Buchstabe (mm):', moved.join(', '), '→',
  (moved[1] > 5 && moved[0] < 0.1 && moved[2] < 0.1) ? 'BESTANDEN' : 'DURCHGEFALLEN');
await page.screenshot({ path: '/tmp/lac_test/chardrag.png', clip: { x: 340, y: 0, width: 1160, height: 500 } });
await browser.close();
