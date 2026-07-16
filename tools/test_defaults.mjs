import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-US' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'index.html'));
await page.waitForTimeout(400);
console.log('Tab-Titel (EN):', await page.title());
console.log('Beispieltext:', JSON.stringify((await page.inputValue('#inpText')).split('\n')[0]));
console.log('Dateiname:', await page.inputValue('#inpFname'));
// Eigener Text darf beim Sprachwechsel nicht überschrieben werden
await page.fill('#inpText', 'Mein eigener Inhalt');
await page.click('#btnLang');  // -> DE
await page.waitForTimeout(300);
console.log('Nach DE-Wechsel, eigener Text erhalten:', JSON.stringify(await page.inputValue('#inpText')));
console.log('Tab-Titel (DE):', await page.title());
// Zurück auf EN mit Default-Text: muss wieder übersetzen
await page.fill('#inpText', 'Hallo Welt!\nDies ist ein Test —\ngeschrieben mit dem Stift.');
await page.click('#btnLang');  // -> EN
await page.waitForTimeout(300);
console.log('Default zurückgetauscht:', JSON.stringify((await page.inputValue('#inpText')).split('\n')[0]));
await browser.close();
