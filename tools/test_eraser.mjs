import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'index.html?panel=capture'));
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
const bb = await page.locator('#draw').boundingBox();
// Langen horizontalen Strich zeichnen
await page.mouse.move(bb.x + 150, bb.y + bb.height * 0.55);
await page.mouse.down();
await page.mouse.move(bb.x + 600, bb.y + bb.height * 0.55, { steps: 20 });
await page.mouse.up();
const before = await page.evaluate(() => window.Capture._debug.strokeCount());
// Mit Taste E zum Radiergummi, Mitte wegradieren
await page.keyboard.press('e');
const toolNow = await page.evaluate(() => window.Capture._debug.tool());
await page.mouse.move(bb.x + 370, bb.y + bb.height * 0.55);
await page.mouse.down();
await page.mouse.move(bb.x + 390, bb.y + bb.height * 0.55, { steps: 4 });
await page.mouse.up();
const after = await page.evaluate(() => ({ n: window.Capture._debug.strokeCount(), tool: window.Capture._debug.tool() }));
await page.screenshot({ path: '/tmp/lac_test/eraser.png', clip: { x: 340, y: 0, width: 1160, height: 700 } });
console.log(`Striche vorher: ${before} | Werkzeug nach E: ${toolNow} | nach Radieren: ${after.n} Striche (2 erwartet — geteilt)`);
await browser.close();
