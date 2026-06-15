import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const errs = [];

// 1) Text-Writer im Dark Mode -> Platte soll weiss sein (Default-Hintergrund)
const p1 = await browser.newPage({ viewport: { width: 1500, height: 950 } });
p1.on('pageerror', e => errs.push('index EXC: ' + e.message));
await p1.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k,"1"); localStorage.setItem("ui_theme","dark"); });
await p1.goto('file://' + path.join(here, '..', 'app', 'index.html'));
await p1.fill('#inpText', 'Hallo Welt');
await p1.waitForTimeout(700);
const t1 = await p1.evaluate(() => document.documentElement.getAttribute('data-theme'));
await p1.screenshot({ path: '/tmp/mc_test/text_dark.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });
console.log('Text-Writer Theme:', t1);
await p1.close();

// 2) Bild-Modus: Hintergrund auf hellblau aendern -> Platte folgt
const p2 = await browser.newPage({ viewport: { width: 1500, height: 950 } });
p2.on('pageerror', e => errs.push('bild EXC: ' + e.message));
await p2.addInitScript(() => { for (const k of ["text","handschrift","bild"]) localStorage.setItem("tour_"+k,"1"); localStorage.setItem("ui_theme","dark"); });
await p2.goto('file://' + path.join(here, '..', 'app', 'bild.html'));
await p2.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 200; c.height = 140;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,200,140);
  g.fillStyle = '#111'; g.fillRect(20,20,70,100); g.fillStyle = '#d52b2b'; g.fillRect(110,20,70,100);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  window.loadImage(new File([blob], 'bg_test.png', { type: 'image/png' }));
});
await p2.waitForTimeout(800);
await p2.evaluate(() => { const cb=document.getElementById('inpMC'); cb.checked=true; cb.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('btnMCExtract').click(); });
await p2.waitForTimeout(900);
// Hintergrund auf dunkles Grau setzen -> Border/Raster/Tinte sollten hell werden
await p2.evaluate(() => { const i=document.getElementById('inpBg'); i.value='#222831'; i.dispatchEvent(new Event('input',{bubbles:true})); });
await p2.waitForTimeout(400);
await p2.screenshot({ path: '/tmp/mc_test/bild_darkbg.png', clip: { x: 340, y: 0, width: 1160, height: 900 } });
console.log('Bild-Modus Hintergrund geaendert -> Screenshot');
await p2.close();

await browser.close();
console.log(errs.length ? ('FEHLER: ' + JSON.stringify(errs)) : 'keine JS-Fehler');
