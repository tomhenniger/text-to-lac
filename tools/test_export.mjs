// End-to-End-Test: lädt die App headless, macht Screenshot, exportiert .lac
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appUrl = 'file://' + path.join(here, '..', 'app', 'index.html');
const outDir = '/tmp/lac_test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
page.on('pageerror', e => console.log('PAGE EXCEPTION:', e.message));

await page.goto(appUrl);
await page.fill('#inpText', 'Süße Grüße aus Köln!\nÄpfel, Öl & Übermut —\nder Stift schreibt selbst. ß');
await page.selectOption('#inpFont', 'EMSAllure');
await page.fill('#inpFname', 'testexport');
await page.click('#btnFit');
await page.waitForTimeout(300);
await page.screenshot({ path: outDir + '/preview.png' });

// Export pro Zeile testen
await page.selectOption('#inpGroup', 'line');
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#btnExport'),
]);
await download.saveAs(outDir + '/testexport.lac');
console.log('Export gespeichert:', outDir + '/testexport.lac');

await browser.close();
