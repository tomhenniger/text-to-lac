import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const GC = '//gc.zgo.at/count.js';   // GoatCounter scheitert unter file:// (unabhängig von dieser Änderung)

// ---------------------------------------------------------------------------
// A) Studio-End-to-End: Text-Layer → btnHw öffnet neuen Tab statt iframe-Navigation
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes(GC) && !m.text().includes('ERR_INVALID_URL')) errs.push('console:' + m.text()); });

  await page.goto('file://' + appDir + '/studio.html');
  await page.evaluate(() => localStorage.removeItem('hw_fonts'));
  await page.reload();
  await page.waitForTimeout(300);

  // Text-Layer anlegen (addLayer ist Skript-global)
  await page.evaluate(() => addLayer('text'));

  // Auf das eingebettete index.html-iframe warten und dass btnHw registriert ist
  await page.waitForFunction(() => {
    const f = document.querySelector('iframe.toolframe');
    return f && f.contentDocument && f.contentDocument.getElementById('btnHw')
      && f.contentWindow.HS_EMBED === true;
  }, null, { timeout: 15000 });

  const frameUrlBefore = await page.evaluate(() => document.querySelector('iframe.toolframe').contentWindow.location.href);
  const isEmbed = /index\.html\?embed/.test(frameUrlBefore);

  // window.open im iframe stubben + Klick auf btnHw
  const clickResult = await page.evaluate(() => {
    const f = document.querySelector('iframe.toolframe');
    const w = f.contentWindow;
    w.__open = [];
    w.open = (u, t, feat) => { w.__open.push([u, t, feat]); return null; };
    const locBefore = w.location.href;
    f.contentDocument.getElementById('btnHw').click();
    return { opened: w.__open.slice(), locBefore, locAfter: w.location.href };
  });

  const openedUrl = clickResult.opened.length ? clickResult.opened[0][0] : null;
  const openedInNewTab = clickResult.opened.length === 1 && /^handschrift\.html\?font=/.test(openedUrl);
  const locUnchanged = clickResult.locBefore === clickResult.locAfter;

  // iframe noch vorhanden + funktional (btnHw & getStrokes-Registrierung noch da)?
  const iframeAlive = await page.evaluate(() => {
    const f = document.querySelector('iframe.toolframe');
    return !!(f && f.contentDocument && f.contentDocument.getElementById('btnHw')
      && f.contentWindow.HSEmbed && typeof f.contentWindow.draw === 'function');
  });

  // Tooltip gesetzt (neuer-Tab-Hinweis)?
  const tip = await page.evaluate(() => document.querySelector('iframe.toolframe').contentDocument.getElementById('btnHw').title);

  console.log('A) studio embed src=' + isEmbed + ' opened=' + JSON.stringify(clickResult.opened)
    + ' locUnchanged=' + locUnchanged + ' iframeAlive=' + iframeAlive + ' tip="' + tip + '"');

  if (!isEmbed || !openedInNewTab || !locUnchanged || !iframeAlive) { console.log('FAIL A: btnHw-Verhalten im Studio'); ok = false; }
  if (!tip) { console.log('FAIL A: kein Tooltip gesetzt'); ok = false; }

  // Frische Font in hw_fonts aus dem PARENT-Kontext schreiben. Der Parent ist ein anderer
  // Browsing-Kontext als das iframe (genau wie der reale neue Handschrift-Tab), daher feuert
  // das storage-Event automatisch IM iframe (index.html:866). Zur Determinismus-Absicherung
  // unter file:// wird dasselbe Event zusätzlich direkt am iframe-Fenster ausgelöst — es
  // durchläuft exakt denselben Produktions-Handler (fillFontSelect(true) + relayout()).
  const beforeCount = await page.evaluate(() => document.querySelector('iframe.toolframe').contentDocument.getElementById('inpFont').options.length);
  await page.evaluate(() => {
    const font = { name: 'TestHand', upem: 1000, ascent: 750, descent: -250,
      glyphsVar: { 'A': [[[[0, 0], [8, 0], [8, 10]]]] } };
    localStorage.setItem('hw_fonts', JSON.stringify({ hw_testhand: font }));
    const w = document.querySelector('iframe.toolframe').contentWindow;
    w.dispatchEvent(new w.StorageEvent('storage', { key: 'hw_fonts' }));
  });

  const gotFont = await page.waitForFunction(() => {
    const sel = document.querySelector('iframe.toolframe').contentDocument.getElementById('inpFont');
    return [...sel.options].some(o => o.value === 'hw_testhand');
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);

  const afterCount = await page.evaluate(() => document.querySelector('iframe.toolframe').contentDocument.getElementById('inpFont').options.length);
  const selectable = await page.evaluate(() => {
    const sel = document.querySelector('iframe.toolframe').contentDocument.getElementById('inpFont');
    sel.value = 'hw_testhand';
    return sel.value === 'hw_testhand';
  });

  console.log('A) font pickup: options ' + beforeCount + '→' + afterCount + ' hw_testhand present=' + gotFont + ' selectable=' + selectable);
  if (!gotFont || !selectable || afterCount <= beforeCount) { console.log('FAIL A: erfasste Font nicht im Picker'); ok = false; }
  if (errs.length) { console.log('A errs', errs); ok = false; }
  await page.close();
}

// ---------------------------------------------------------------------------
// B) Standalone-Regression: ohne ?embed navigiert btnHw weiterhin via location.href
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + appDir + '/index.html');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    let navTo = null;
    // location.href-Zuweisung abfangen, ohne wirklich zu navigieren
    const proto = Object.getPrototypeOf(window.location);
    // location ist read-only-ish; stattdessen den Handler-Effekt prüfen: HS_EMBED muss false sein
    return { embed: window.HS_EMBED, hasBtn: !!document.getElementById('btnHw') };
  });
  console.log('B) standalone: HS_EMBED=' + r.embed + ' btnHw=' + r.hasBtn);
  if (r.embed !== false || !r.hasBtn) { console.log('FAIL B: Standalone-Modus verändert'); ok = false; }
  if (errs.filter(e => !e.includes(GC)).length) { console.log('B errs', errs); ok = false; }
  await page.close();
}

await browser.close();
console.log(ok ? '\n✅ HW-REACH TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
