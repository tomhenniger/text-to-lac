import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-US' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k, "1"); });

// Font-Dropdown auf Englisch
await page.goto('file://' + path.join(here, '..', 'app', 'index.html'));
await page.waitForTimeout(400);
const opts = await page.evaluate(() => [...document.getElementById('inpFont').options].slice(0, 4).map(o => o.textContent));
console.log('Fonts (EN):', opts.join(' | '));
// Export-Objektname
await page.selectOption('#inpGroup', 'line');
const dl = page.waitForEvent('download');
await page.click('#btnExport');
await (await dl).saveAs('/tmp/lac_test/en_export.lac');

// Schriftname-Default (leer -> wird getauscht)
await page.goto('file://' + path.join(here, '..', 'app', 'handschrift.html'));
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.reload();
await page.waitForTimeout(300);
console.log('Schriftname (EN, leer):', await page.inputValue('#inpName'));
// Mit erfasster Glyphe: darf NICHT mehr tauschen
await page.click('#btnLang'); // -> DE
await page.waitForTimeout(200);
console.log('Schriftname (DE zurück):', await page.inputValue('#inpName'));
const bb = await page.locator('#draw').boundingBox();
await page.mouse.move(bb.x + 300, bb.y + 300);
await page.mouse.down();
await page.mouse.move(bb.x + 350, bb.y + 400, { steps: 4 });
await page.mouse.up();
await page.keyboard.press('Enter');
await page.click('#btnLang'); // -> EN, aber Schrift hat Inhalt
await page.waitForTimeout(200);
console.log('Schriftname (EN, mit Inhalt — bleibt deutsch):', await page.inputValue('#inpName'));
await browser.close();
