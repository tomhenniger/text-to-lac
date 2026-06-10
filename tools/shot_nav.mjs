import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-US' });
const page = await ctx.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.addInitScript(() => {
  for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k, "1");
  localStorage.setItem("ui_theme", "dark");
});
await page.goto('file://' + path.join(here, '..', 'app', 'handschrift.html'));
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/lac_test/nav_dark.png', clip: { x: 0, y: 0, width: 360, height: 280 } });
// Home-Link prüfen
const home = await page.getAttribute('.topnav a[title="Home"]', 'href');
console.log('Home-Link:', home);
await browser.close();
