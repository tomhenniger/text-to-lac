// Ebenen-Panel: anlegen, umbenennen, Sichtbarkeit, umsortieren, duplizieren,
// löschen; Export mit inpGroup=layer -> Objektzahl == sichtbare (nicht-leere) Ebenen.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
browser.contexts;
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
page.on('pageerror', e => console.log('EXC:', e.message));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ FEHLER: ') + m); if (!c) fails++; };
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });
await page.goto(appDir + '/index.html');
await page.waitForTimeout(300);

const ids = () => page.evaluate(() => window.__studio.S.layers.map(l => l.id));
const count = () => page.evaluate(() => window.__studio.S.layers.length);
const rows = () => page.locator('#layerList .layer-row');

// Boot: 1 Text-Ebene
ok(await count() === 1, 'Boot: genau eine Ebene');
ok(await page.evaluate(() => window.__studio.S.layers[0].type === 'text'), 'Boot: Text-Ebene');
ok(await rows().count() === 1, 'Panel zeigt 1 Zeile');

// + Text, + Bild
await page.click('#btnAddText');
await page.click('#btnAddImage');
ok(await count() === 3, 'Nach +Text/+Bild: 3 Ebenen');
ok(await page.evaluate(() => window.__studio.Layers.active().type === 'image'), 'Bild-Ebene aktiv');
ok(await rows().count() === 3, 'Panel zeigt 3 Zeilen');

// Umbenennen (Doppelklick auf oberste Zeile = letzte Array-Ebene).
// dispatchEvent statt .dblclick(), damit der Klick-Re-Render die Zeile nicht
// wegräumt, bevor der dblclick-Handler feuert.
await page.evaluate(() => {
  const row = document.querySelector('#layerList .layer-row');
  row.querySelector('.lname').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
});
await page.locator('#layerList .rename').fill('Umbenannt');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok(await page.evaluate(() => window.__studio.S.layers.some(l => l.name === 'Umbenannt')), 'Umbenennen wirkt');

// Sichtbarkeit: Auge der obersten Zeile umschalten
const visBefore = await page.evaluate(() => window.__studio.S.layers.map(l => l.visible));
await rows().nth(0).locator('button').nth(0).click();
await page.waitForTimeout(120);
const visAfter = await page.evaluate(() => window.__studio.S.layers.map(l => l.visible));
ok(JSON.stringify(visBefore) !== JSON.stringify(visAfter), 'Sichtbarkeit umschaltbar');
await rows().nth(0).locator('button').nth(0).click(); // wieder sichtbar
await page.waitForTimeout(120);

// Umsortieren: Pfeil hoch der zweiten angezeigten Zeile
const orderBefore = await ids();
await rows().nth(1).locator('button').nth(1).click();
await page.waitForTimeout(120);
const orderAfter = await ids();
ok(JSON.stringify(orderBefore) !== JSON.stringify(orderAfter), 'Umsortieren ändert Reihenfolge');

// Duplizieren
await page.click('#btnDupLayer');
await page.waitForTimeout(120);
ok(await count() === 4, 'Duplizieren: 4 Ebenen');

// Löschen
await page.click('#btnDelLayer');
await page.waitForTimeout(120);
ok(await count() === 3, 'Löschen: 3 Ebenen');

// ===== Export mit inpGroup=layer =====
// Sauberer Stand: neu laden -> 1 Text-Ebene, dann 2. Text-Ebene mit Inhalt
await page.goto(appDir + '/index.html');
await page.waitForTimeout(300);
await page.fill('#inpText', 'Erste Ebene');
await page.click('#btnAddText');
await page.fill('#inpText', 'Zweite Ebene');
await page.selectOption('#inpGroup', 'layer');
await page.waitForTimeout(200);

async function exportAndCount(file) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
  await dl.saveAs(file);
  const buf = fs.readFileSync(file, 'latin1');
  return (buf.match(/"type": "PathObject"/g) || []).length;
}
const visLayers = await page.evaluate(() => window.__studio.S.layers.filter(l => l.visible).length);
const objs = await exportAndCount('/tmp/lac_test/layers_2.lac');
ok(objs === visLayers && objs === 2, `Export layer-Gruppierung: ${objs} Objekte == ${visLayers} sichtbare Ebenen`);

// Eine Ebene ausblenden -> ein Objekt weniger
await rows().nth(0).locator('button').nth(0).click();
await page.waitForTimeout(150);
const objs1 = await exportAndCount('/tmp/lac_test/layers_1.lac');
ok(objs1 === 1, `Nach Ausblenden: ${objs1} Objekt`);

await browser.close();
console.log(fails === 0 ? 'LAYERS BESTANDEN' : `LAYERS: ${fails} PROBLEME`);
process.exit(fails ? 1 : 0);
