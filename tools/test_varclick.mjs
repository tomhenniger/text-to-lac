import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
browser.contexts; // Tour-Autostart in Tests unterdrücken
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));

// Handschrift ins Capture-Modal importieren, übernehmen, dann auf dem Canvas Varianten klicken
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
await page.click('#btnFit');
await page.waitForTimeout(300);

async function glyphInfo(i) {
  return page.evaluate(i => {
    const g = window.__studio.activeLayout().glyphs[i];
    const S = window.__studio.S;
    let nx = 1e9, ny = 1e9, xx = -1e9, xy = -1e9, pts = 0;
    for (const st of g.strokes) for (const [x, y] of st) {
      nx = Math.min(nx, x); ny = Math.min(ny, y); xx = Math.max(xx, x); xy = Math.max(xy, y); pts++;
    }
    return { cx: (nx+xx)/2, cy: (ny+xy)/2, pts,
             sx: ((nx+xx)/2) * S.view.scale + S.view.ox, sy: ((ny+xy)/2) * S.view.scale + S.view.oy };
  }, i);
}
const cvBox = await page.locator('#cv').boundingBox();
const before = await glyphInfo(1);
await page.mouse.click(cvBox.x + before.sx, cvBox.y + before.sy);
await page.waitForTimeout(200);
const after1 = await glyphInfo(1);
const state1 = await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  return { charVar: JSON.stringify(l.charVar), charOff: JSON.stringify(l.charOff), status: document.getElementById('stVar').textContent };
});
await page.mouse.click(cvBox.x + after1.sx, cvBox.y + after1.sy);
await page.waitForTimeout(200);
const state2 = await page.evaluate(() => JSON.stringify(window.__studio.Layers.active().charVar));
console.log('Vorher Punkte:', before.pts, '| nach Klick 1:', after1.pts);
console.log('charVar nach Klick 1:', state1.charVar, '| Status:', state1.status);
console.log('charVar nach Klick 2:', state2);
console.log('charOff (sollte leer sein):', state1.charOff);
const formChanged = before.pts !== after1.pts;
const posStable = Math.hypot(after1.cx - before.cx, after1.cy - before.cy) < 3;
console.log('Form geändert:', formChanged, '| Position stabil (<3mm):', posStable,
            '→', (state1.charVar !== '{}' && state1.charOff === '{}') ? 'BESTANDEN' : 'DURCHGEFALLEN');
await page.screenshot({ path: '/tmp/lac_test/varclick.png', clip: { x: 340, y: 0, width: 1160, height: 400 } });
await browser.close();
