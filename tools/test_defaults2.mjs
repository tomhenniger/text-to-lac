import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-US' });
const page = await ctx.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });

// Font-Dropdown auf Englisch
await page.goto(appDir + '/index.html');
await page.waitForTimeout(400);
const opts = await page.evaluate(() => [...document.getElementById('inpFont').options].slice(0, 4).map(o => o.textContent));
console.log('Fonts (EN):', opts.join(' | '));
// Export-Objektname
await page.selectOption('#inpGroup', 'line');
const dl = page.waitForEvent('download');
await page.click('#btnExport');
await (await dl).saveAs('/tmp/lac_test/en_export.lac');

// Schriftname-Default im Capture-Modal (leer -> wird auf Sprache getauscht)
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.goto(appDir + '/index.html?panel=capture');
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
console.log('Schriftname (EN):', await page.inputValue('#inpName'));
// Sprache -> DE (Modal deckt #btnLang ab, deshalb programmatisch)
await page.evaluate(() => document.getElementById('btnLang').click()); // -> DE
await page.waitForTimeout(200);
console.log('Schriftname (DE):', await page.inputValue('#inpName'));
// Mit erfasster Glyphe: darf NICHT mehr tauschen
const bb = await page.locator('#draw').boundingBox();
await page.mouse.move(bb.x + 300, bb.y + 300);
await page.mouse.down();
await page.mouse.move(bb.x + 350, bb.y + 400, { steps: 4 });
await page.mouse.up();
await page.keyboard.press('Enter');
await page.evaluate(() => document.getElementById('btnLang').click()); // -> EN, aber Schrift hat Inhalt
await page.waitForTimeout(200);
console.log('Schriftname (EN, mit Inhalt — bleibt deutsch):', await page.inputValue('#inpName'));
await browser.close();
