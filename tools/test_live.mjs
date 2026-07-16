import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.goto('https://tomhenniger.github.io/text-to-lac/app/index.html');
await page.fill('#inpText', 'Live von GitHub Pages!');
await page.click('#btnFit');
await page.waitForTimeout(500);
const info = await page.evaluate(() => ({
  fonts: Object.keys(window.SL_FONTS).length,
  configs: !!window.LAC_CONFIGS,
  glyphs: window.__studio.activeLayout().glyphs.length,
}));
console.log('Fonts geladen:', info.fonts, '| Configs:', info.configs, '| Glyphen gerendert:', info.glyphs);
await page.screenshot({ path: '/tmp/lac_test/live.png', clip: { x: 340, y: 0, width: 1160, height: 450 } });
await browser.close();
