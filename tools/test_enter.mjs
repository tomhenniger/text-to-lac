import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'handschrift.html'));
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.reload();
await page.waitForTimeout(300);
const bb = await page.locator('#draw').boundingBox();
async function stroke(dx) {
  await page.mouse.move(bb.x + 300 + dx, bb.y + bb.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(bb.x + 320 + dx, bb.y + bb.height * 0.7, { steps: 5 });
  await page.mouse.up();
}
// Enter: speichern, beim Zeichen bleiben
await stroke(0);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
console.log('Nach ⏎:        Zeichen =', await page.evaluate(() => curChar), '| a-Varianten =', await page.evaluate(() => variants('a').length));
// noch eine Variante, dann Shift+Enter: speichern + springen
await stroke(40);
await page.keyboard.press('Shift+Enter');
await page.waitForTimeout(200);
console.log('Nach ⇧⏎:      Zeichen =', await page.evaluate(() => curChar), '| a-Varianten =', await page.evaluate(() => variants('a').length));
// Button "✓ + nächstes Zeichen"
await stroke(0);
await page.click('#btnSaveNext');
await page.waitForTimeout(200);
console.log('Nach Button ✓+: Zeichen =', await page.evaluate(() => curChar), '| b-Varianten =', await page.evaluate(() => variants('b').length));
await browser.close();
