import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const errs = [];
page.on('pageerror', e => errs.push('EXC: ' + e.message));
page.on('console', m => {   // Resource-Load-Fehler (file://) ignorieren, nur echte JS-Konsolenfehler zählen
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text());
});
await page.addInitScript(() => { for (const k of ["text", "handschrift", "bild"]) localStorage.setItem("tour_" + k, "1"); });
await page.goto('file://' + path.join(here, '..', 'app', 'bild.html'));

// farbiges Line-Art-Bild in der Seite erzeugen und laden (schwarz/rot/blau auf weiß)
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 240; c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 240);
  g.lineWidth = 6; g.lineCap = 'round';
  g.strokeStyle = '#000000'; g.beginPath(); g.moveTo(40, 30); g.lineTo(40, 210); g.stroke();   // schwarz vertikal
  g.strokeStyle = '#e23b3b'; g.beginPath(); g.moveTo(30, 120); g.lineTo(210, 120); g.stroke();  // rot horizontal
  g.strokeStyle = '#2f6fd0'; g.beginPath(); g.moveTo(60, 200); g.lineTo(200, 50); g.stroke();   // blau diagonal
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'multicolor_test.png', { type: 'image/png' });
  window.loadImage(file);
});
await page.waitForTimeout(900);

await page.selectOption('#inpStyle', 'lineart');
await page.evaluate(() => {
  const cb = document.getElementById('inpMC');
  cb.checked = true;
  cb.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(1000);

const groups = await page.evaluate(() => S.groups.map(g => ({ name: g.name, color: g.color, strokes: g.strokes.length })));
console.log('Gruppen:', JSON.stringify(groups, null, 2));
const legend = await page.evaluate(() => document.getElementById('mcLegend').textContent.trim());
console.log('Legende:', legend);

// Export + .lac-Inhalt prüfen
fs.mkdirSync('/tmp/mc_test', { recursive: true });
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await dl.saveAs('/tmp/mc_test/multicolor.lac');
console.log('Export gespeichert.');

await browser.close();

// .lac (ZIP) entpacken und 2dmodel.json prüfen
const { execSync } = await import('child_process');
execSync('cd /tmp/mc_test && rm -rf out && mkdir out && unzip -oq multicolor.lac -d out');
const model = JSON.parse(fs.readFileSync('/tmp/mc_test/out/2D/2dmodel.json', 'utf8'));
const objs = model.canvas_list[0].obj_list;
console.log('Objekte in .lac:', objs.map(o => ({ name: o.name, color: o.color, hasPath: o.path_data.length > 0 })));

// Bewertung
let ok = true;
if (groups.length !== 3) { console.log('FAIL: erwartet 3 Gruppen, bekam', groups.length); ok = false; }
if (groups.some(g => g.strokes === 0)) { console.log('FAIL: leere Gruppe'); ok = false; }
const colors = new Set(objs.map(o => o.color));
if (colors.size !== 3) { console.log('FAIL: erwartet 3 verschiedene Objektfarben, bekam', [...colors]); ok = false; }
if (errs.length) { console.log('FAIL: JS-Fehler:', errs); ok = false; }
console.log(ok ? '\n✅ MULTICOLOR TEST PASSED' : '\n❌ TEST FAILED');
process.exit(ok ? 0 : 1);
