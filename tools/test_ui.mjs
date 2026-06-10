import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = 'file://' + path.join(here, '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));

// Landing: Dark-Mode-Toggle
await page.goto(root + '/index.html');
await page.click('#btnTheme');
const t = await page.evaluate(() => document.documentElement.dataset.theme);
console.log('Landing Theme nach Toggle:', t);
await page.screenshot({ path: '/tmp/lac_test/ui_landing_dark.png' });

for (const [name, file] of [['text', 'app/index.html'], ['handschrift', 'app/handschrift.html'], ['bild', 'app/bild.html']]) {
  await page.goto(root + '/' + file);
  await page.waitForTimeout(700);
  const tourVisible = await page.locator('.tour-card').isVisible().catch(() => false);
  let steps = 0;
  if (tourVisible) {
    // komplett durchklicken
    while (await page.locator('.tour-card .tour-next').isVisible().catch(() => false)) {
      const label = await page.locator('.tour-card .tour-next').textContent();
      steps++;
      await page.click('.tour-card .tour-next');
      await page.waitForTimeout(250);
      if (label.includes('Fertig') || steps > 12) break;
    }
  }
  const tourGone = !(await page.locator('.tour-card').isVisible().catch(() => false));
  // Neustart über ❓
  await page.click('#btnTour');
  await page.waitForTimeout(300);
  const restart = await page.locator('.tour-card').isVisible();
  await page.keyboard.press('Escape');
  const dark = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log(`${name}: Tour-Autostart=${tourVisible}, ${steps} Schritte, beendet=${tourGone}, Neustart=${restart}, Theme=${dark}`);
  if (name === 'bild') await page.setInputFiles('#fileImg', '/tmp/lac_test/testbild.png');
  if (name === 'text') await page.fill('#inpText', 'Dark Mode Test');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/lac_test/ui_${name}_dark.png` });
}
// Vorlage-Link prüfen
await page.goto(root + '/app/handschrift.html');
const link = await page.getAttribute('#btnVorlage', 'href');
const target = await page.getAttribute('#btnVorlage', 'target');
console.log('Vorlage-Link:', link, '| target:', target);
await browser.close();
