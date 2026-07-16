import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const ctxEn = await browser.newContext({ locale: 'en-US' });
const page = await ctxEn.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'index.html?panel=capture'));
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.reload();
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
// Strich zeichnen + per Enter speichern
const bb = await page.locator('#draw').boundingBox();
await page.mouse.move(bb.x + 300, bb.y + bb.height * 0.4);
await page.mouse.down();
await page.mouse.move(bb.x + 320, bb.y + bb.height * 0.7, { steps: 6 });
await page.mouse.up();
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const saved = await page.evaluate(() => {
  const f = Object.values(JSON.parse(localStorage.getItem('hw_fonts') || '{}'))[0];
  return f ? Object.keys(f.glyphsVar).filter(c => c !== ' ') : [];
});
console.log('Per Enter gespeichert:', JSON.stringify(saved));
await page.screenshot({ path: '/tmp/lac_test/save_ux_en.png' });
await browser.close();
