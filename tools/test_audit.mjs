import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = 'file://' + path.join(here, '..');
const browser = await chromium.launch();
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FEHLER: ') + msg); if (!cond) fails++; };

const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let lastDialog = '';
page.on('dialog', d => { lastDialog = d.message(); d.accept().catch(() => {}); });
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });

// ===== 1) Text-Ebene: Override-Stabilität bei Textänderung =====
console.log('— Text-Ebene —');
await page.goto(root + '/app/index.html?panel=capture');
await page.evaluate(() => localStorage.removeItem('hw_fonts'));
await page.reload();
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
// Handschrift importieren -> übernehmen (setzt Font der aktiven Text-Ebene) -> Modal zu
await page.setInputFiles('#fileHwImport', '/Users/tomhenniger/Downloads/toms_handschrift.handschrift.json');
await page.waitForTimeout(300);
await page.click('#btnHwUse');
await page.waitForFunction(() => document.getElementById('captureModal').hidden);
await page.fill('#inpText', 'abc');
await page.waitForTimeout(300);
// Variante des 'b' (0:1) manuell setzen + verschieben
await page.evaluate(() => {
  const l = window.__studio.Layers.active();
  l.charVar["0:1"] = { v: 2, ch: "b" };
  l.charOff["0:1"] = { dx: 5, dy: -3, ch: "b" };
  window.__studio.Layers.invalidate(l.id);
  window.__studio.relayout();
});
const before = await page.evaluate(() => window.__studio.activeLayout().glyphs[1].strokes[0][0]);
// Text hinten erweitern -> b bleibt an Position 0:1 -> Override bleibt
await page.fill('#inpText', 'abcd');
await page.waitForTimeout(250);
const afterAppend = await page.evaluate(() => window.__studio.activeLayout().glyphs[1].strokes[0][0]);
ok(Math.abs(afterAppend[0] - before[0]) < 0.01, 'Anhängen am Ende: Buchstaben-Anpassung bleibt erhalten');
// Zeichen vorne einfügen -> an 0:1 steht jetzt 'a' -> Override (ch:'b') wird ignoriert
await page.fill('#inpText', 'xabcd');
await page.waitForTimeout(250);
const stale = await page.evaluate(() => {
  const lay = window.__studio.activeLayout();
  const g = lay.glyphs[1]; // 'a' an Position 0:1
  return { char: g.char, hatOffset: Math.abs(g.strokes[0][0][1] - lay.glyphs[0].strokes[0][0][1]) > 20 };
});
ok(stale.char === 'a' && !stale.hatOffset, 'Einfügen vorne: Anpassung springt NICHT auf fremdes Zeichen');

// Leertext-Export
await page.fill('#inpText', '   ');
await page.waitForTimeout(250);
await page.click('#btnExport').catch(() => {});
ok(true, 'Leertext-Export: sauberer Hinweis statt Crash');
// Nur fehlende Zeichen
await page.fill('#inpText', '∑∆∏');
await page.waitForTimeout(250);
const warn = await page.evaluate(() => document.getElementById('warnBox').style.display);
ok(warn === 'block', 'Fehlende Glyphen: Warnung sichtbar');
// Export mit flipY + Umlaut-Dateiname
await page.fill('#inpText', 'Grüße');
await page.fill('#inpFname', 'Grüße & Co');
await page.check('#inpFlipY');
await page.waitForTimeout(250);
const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
await dl1.saveAs('/tmp/lac_test/audit_flip.lac');
ok(true, 'Export mit flipY + Sonderzeichen-Dateiname');
await page.uncheck('#inpFlipY');

// ===== 2) Handschrift-Erfassung (Modal): Randfälle =====
console.log('— Handschrift-Erfassung —');
await page.goto(root + '/app/index.html?panel=capture');
await page.waitForFunction(() => !document.getElementById('captureModal').hidden && window.Capture);
// Name nur aus Sonderzeichen -> slug-Fallback
await page.fill('#inpName', '!!! ???');
await page.evaluate(() => document.getElementById('inpName').dispatchEvent(new Event('change')));
const fid = await page.evaluate(() => window.Capture._debug.fontId());
ok(fid === 'hw_schrift', 'Sonderzeichen-Name: slug-Fallback greift (' + fid + ')');
// Zeichensatz leeren -> kein Crash
await page.fill('#inpCharset', '');
await page.waitForTimeout(200);
// Speichern ohne Zeichnung -> Hinweis
await page.keyboard.press('Enter');
ok(true, 'Speichern ohne Zeichnung: Hinweis statt Crash');
await page.fill('#inpCharset', 'ab');
// Radieren ohne Striche -> kein Crash
await page.keyboard.press('e');
const bb = await page.locator('#draw').boundingBox();
await page.mouse.move(bb.x + 200, bb.y + 200);
await page.mouse.down(); await page.mouse.move(bb.x + 250, bb.y + 250); await page.mouse.up();
ok(true, 'Radieren auf leerem Canvas: kein Crash');
// Kaputtes JSON importieren -> saubere Meldung
await page.evaluate(() => {
  const f = new File(['{kaputt'], 'x.json', { type: 'application/json' });
  const dt = new DataTransfer(); dt.items.add(f);
  const inp = document.getElementById('fileHwImport');
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
});
await page.waitForTimeout(300);
ok(true, 'Kaputtes JSON: saubere Fehlermeldung');

// ===== 3) Bild-Ebene: Randfälle =====
console.log('— Bild-Ebene —');
await page.goto(root + '/app/index.html?layer=image');
await page.waitForTimeout(300);
const imgStrokes = () => page.evaluate(() => {
  const l = window.__studio.Layers.active();
  return window.__studio.Layers.strokesOf(l).length;
});
// Komplett weißes Bild -> 0 Striche auf der Bild-Ebene
await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 100; c.height = 80;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 80);
  c.toBlob(b => {
    const dt = new DataTransfer(); dt.items.add(new File([b], 'weiss.png', { type: 'image/png' }));
    const inp = document.getElementById('fileImg');
    inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  });
});
await page.waitForTimeout(1200);
const whiteStrokes = await imgStrokes();
ok(whiteStrokes === 0, 'Weißes Bild: 0 Striche auf der Bild-Ebene (' + whiteStrokes + ')');
// Alle Stile auf 1x1-Mini-Bild -> kein Crash
await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 2; c.height = 2;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 2, 2);
  c.toBlob(b => {
    const dt = new DataTransfer(); dt.items.add(new File([b], 'mini.png', { type: 'image/png' }));
    const inp = document.getElementById('fileImg');
    inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  });
});
await page.waitForTimeout(600);
for (const style of ['hatch', 'cross', 'squiggle', 'spiral', 'ascii', 'contour']) {
  await page.selectOption('#inpStyle', style);
  await page.waitForTimeout(500);
}
ok(true, 'Alle 6 Stile auf 2×2-Minibild: kein Crash');
// ASCII mit Nur-Leerzeichen-Rampe -> Fallback
await page.selectOption('#inpStyle', 'ascii');
await page.fill('#inpARamp', ' ');
await page.dispatchEvent('#inpARamp', 'input');
await page.waitForTimeout(600);
const rampStrokes = await imgStrokes();
ok(rampStrokes > 0, 'Leere ASCII-Rampe: Fallback greift (' + rampStrokes + ' Striche)');

// ===== Abschluss =====
console.log('— JS-Fehler über alle Tests: ' + (errors.length ? errors.join(' | ') : 'keine') + ' —');
if (errors.length) fails += errors.length;
await browser.close();
console.log(fails === 0 ? 'AUDIT BESTANDEN' : `AUDIT: ${fails} PROBLEME`);
process.exit(fails ? 1 : 0);
