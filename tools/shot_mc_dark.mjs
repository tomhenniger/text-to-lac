import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.addInitScript(() => {
  for (const k of ["text", "handschrift", "bild"]) localStorage.setItem("tour_" + k, "1");
  localStorage.setItem("ui_theme", "dark");               // Dark Mode erzwingen
});
await page.goto('file://' + path.join(here, '..', 'app', 'bild.html'));

await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 240; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 160);
  g.fillStyle = '#111'; g.fillRect(20, 20, 90, 120);
  g.fillStyle = '#d52b2b'; g.fillRect(120, 20, 100, 55);
  g.fillStyle = '#2f6fd0'; g.fillRect(120, 85, 100, 55);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  window.loadImage(new File([blob], 'dark_test.png', { type: 'image/png' }));
});
await page.waitForTimeout(900);
await page.selectOption('#inpStyle', 'fill');
await page.evaluate(() => {
  const cb = document.getElementById('inpMC'); cb.checked = true; cb.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('btnMCExtract').click();
});
await page.waitForTimeout(1200);
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log('Theme:', theme);
await page.screenshot({ path: '/tmp/mc_test/dark_mat.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });
console.log('Screenshot: /tmp/mc_test/dark_mat.png');
await browser.close();
