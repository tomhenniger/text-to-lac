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

// Studio-Tour (Key tour_studio, 8 Schritte) auf app/index.html
async function runTour(nextSel) {
  let steps = 0;
  while (await page.locator(`.tour-card ${nextSel}`).isVisible().catch(() => false)) {
    const label = await page.locator(`.tour-card ${nextSel}`).textContent();
    steps++;
    await page.click(`.tour-card ${nextSel}`);
    await page.waitForTimeout(250);
    if (label.includes('Fertig') || label.includes('Done') || steps > 12) break;
  }
  return steps;
}

await page.goto(root + '/app/index.html');
await page.waitForTimeout(700);
{
  const tourVisible = await page.locator('.tour-card').isVisible().catch(() => false);
  const steps = tourVisible ? await runTour('.tour-next') : 0;
  const tourGone = !(await page.locator('.tour-card').isVisible().catch(() => false));
  await page.click('#btnTour');
  await page.waitForTimeout(300);
  const restart = await page.locator('.tour-card').isVisible();
  await page.keyboard.press('Escape');
  const dark = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log(`studio: Tour-Autostart=${tourVisible}, ${steps} Schritte, beendet=${tourGone}, Neustart=${restart}, Theme=${dark}`);
  await page.fill('#inpText', 'Dark Mode Test');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/lac_test/ui_studio_dark.png' });
}

// Capture-Modal-Tour (Key tour_handschrift) + Vorlage-Link
{
  await page.goto(root + '/app/index.html?panel=capture');
  await page.waitForTimeout(800);
  const tourVisible = await page.locator('.tour-card').isVisible().catch(() => false);
  const steps = tourVisible ? await runTour('.tour-next') : 0;
  const tourGone = !(await page.locator('.tour-card').isVisible().catch(() => false));
  await page.click('#btnHwTour');
  await page.waitForTimeout(300);
  const restart = await page.locator('.tour-card').isVisible();
  await page.keyboard.press('Escape');
  const dark = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log(`capture: Tour-Autostart=${tourVisible}, ${steps} Schritte, beendet=${tourGone}, Neustart=${restart}, Theme=${dark}`);
  const link = await page.getAttribute('#btnVorlage', 'href');
  const target = await page.getAttribute('#btnVorlage', 'target');
  console.log('Vorlage-Link:', link, '| target:', target);
  await page.screenshot({ path: '/tmp/lac_test/ui_capture_dark.png' });
}

// Bild-Ebene im Dark Mode
await page.goto(root + '/app/index.html?layer=image');
await page.waitForTimeout(400);
await page.setInputFiles('#fileImg', '/tmp/lac_test/testbild.png');
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/lac_test/ui_bild_dark.png' });
await browser.close();
