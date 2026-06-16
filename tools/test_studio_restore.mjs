import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
const studioUrl = 'file://' + path.join(appDir, 'studio.html');
await page.goto(studioUrl);
await page.evaluate(() => { try { localStorage.removeItem('ttl_studio_layout'); } catch {} });
await page.waitForTimeout(300);

const loadSvg = (svg, idx = -1) => page.evaluate(({ svg, idx }) => {
  const L = S.layers[idx < 0 ? S.layers.length - 1 : idx], fr = L._frame, win = fr.contentWindow, doc = fr.contentDocument;
  const inp = doc.getElementById('inpSvgFile');
  const file = new win.File([svg], 't.svg', { type: 'image/svg+xml' });
  const dt = new win.DataTransfer(); dt.items.add(file); inp.files = dt.files;
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
}, { svg, idx });

// --- SVG-Ebene + QR-Ebene anlegen und füllen ---
await page.evaluate(() => addLayer('misc', 'svg'));
await page.waitForTimeout(1000);
await loadSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="55" stroke="#000" fill="none"/><circle cx="50" cy="45" r="25" stroke="#000" fill="none"/></svg>');
await page.waitForTimeout(1000);
await page.evaluate(() => addLayer('misc', 'qr'));
await page.waitForFunction(() => S.layers.length === 2 && S.layers[1].strokesCache.length > 0, null, { timeout: 20000 });
const pre = await page.evaluate(() => ({ svg: S.layers[0].strokesCache.length, qr: S.layers[1].strokesCache.length }));
console.log('vor Reload:', JSON.stringify(pre));

// --- Autosave + Reload ---
await page.evaluate(() => flushAutosave());
await page.waitForTimeout(400);
await page.reload();
await page.waitForTimeout(900);

// 1) SVG-Ebene auswählen → iframe wird neu erzeugt (Datei verloren), Striche dürfen NICHT verschwinden
const svgSel = await page.evaluate(async () => { selectLayer(S.layers[0].id); await new Promise(r => setTimeout(r, 1500)); return S.layers[0].strokesCache.length; });
console.log('SVG-Striche nach Auswahl (Datei verloren):', svgSel);
if (!(svgSel === pre.svg && svgSel > 0)) { console.log('FAIL: wiederhergestellte SVG-Striche beim Auswählen verloren'); ok = false; }

// 1b) Review-Edge-Case: in die wiederhergestellte SVG-Ebene eine Datei OHNE zeichenbare Pfade laden →
//     „Quelle geladen, aber leer" muss den (veralteten) Cache LÖSCHEN (nicht ewig festhalten)
await loadSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="50">nur Text</text></svg>', 0);
await page.waitForTimeout(1200);
const emptied = await page.evaluate(() => ({ n: S.layers[0].strokesCache.length, restored: !!S.layers[0]._restored }));
console.log('SVG ohne zeichenbare Pfade (Quelle geladen, leer):', JSON.stringify(emptied));
if (!(emptied.n === 0 && emptied.restored === false)) { console.log('FAIL: leeres Ladeergebnis räumt den Cache nicht (hasSource greift nicht)'); ok = false; }

// 2) Parametrische Ebene (QR) auswählen → iframe baut aus Parametern neu auf → Striche bleiben/aktualisieren (kein Freeze)
const qrSel = await page.evaluate(async () => { selectLayer(S.layers[1].id); await new Promise(r => setTimeout(r, 1800)); return { n: S.layers[1].strokesCache.length, restored: !!S.layers[1]._restored }; });
console.log('QR nach Auswahl (Rebuild aus Parametern):', JSON.stringify(qrSel));
if (!(qrSel.n > 0 && qrSel.restored === false)) { console.log('FAIL: QR rebuildet nicht / bleibt eingefroren'); ok = false; }

// 3) Neue Datei in die wiederhergestellte SVG-Ebene laden → neue Striche werden übernommen (Flag löst sich)
await page.evaluate(() => selectLayer(S.layers[0].id));
await page.waitForTimeout(800);
await loadSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M5 5 L95 5 L95 95 L5 95 Z M20 20 L80 80 M30 10 L60 40" stroke="#000" fill="none"/></svg>', 0);
await page.waitForTimeout(1200);
const reload2 = await page.evaluate(() => ({ n: S.layers[0].strokesCache.length, restored: !!S.layers[0]._restored }));
console.log('SVG nach erneutem Datei-Laden:', JSON.stringify(reload2));
if (!(reload2.n > 0 && reload2.restored === false)) { console.log('FAIL: neue Datei wird nach Restore nicht übernommen'); ok = false; }

if (errs.length) { console.log('JS ERRORS:', JSON.stringify(errs)); ok = false; }
await browser.close();
console.log(ok ? '\n✅ STUDIO RESTORE TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
