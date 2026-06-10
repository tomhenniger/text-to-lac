import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto('file://' + path.join(here, '..', 'app', 'bild.html'));
await page.waitForTimeout(800);
await page.click('.tour-card .tour-next');  // zu Schritt 2 (Bild laden)
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/lac_test/ui_tour.png' });
await browser.close();
