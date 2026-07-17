import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const app = 'file://' + path.join(appDir, 'studio.html');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let ok = true;
const fail = (m) => { console.log('FAIL: ' + m); ok = false; };
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// --- 1) Werkzeug-Palette: Discoverability (QR/Spotify per Klartext + Suche) ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CON: ' + m.text()); });
  await page.goto(app); await page.waitForTimeout(300);

  // Toolbar hat genau die 8 beschrifteten Buttons, data-mode-Attribute erhalten
  const tb = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#toolbar .toolbtn')];
    return { count: btns.length, labels: btns.map(b => b.querySelector('.tl')?.textContent),
      hasAdd: !!document.getElementById('btnAddTool'),
      modes: [...document.querySelectorAll('.toolbtn[data-mode]')].map(b => b.dataset.mode) };
  });
  console.log('toolbar:', JSON.stringify(tb));
  if (tb.count !== 8) fail('Toolbar hat nicht 8 Buttons (' + tb.count + ')');
  if (!tb.hasAdd) fail('#btnAddTool fehlt');
  if (!tb.modes.includes('edit')) fail('data-mode=edit nicht mehr vorhanden (Pen-Test-Abhängigkeit)');

  // Palette öffnen → QR + Spotify vorhanden (Zeile trägt das Werkzeug auf r._t, Label je nach Sprache)
  await page.click('#btnAddTool'); await page.waitForTimeout(120);
  const pal = await page.evaluate(() => {
    const open = document.getElementById('toolPalette').classList.contains('open');
    const rows = [...document.querySelectorAll('.tprow')].map(r => ({ label: r.querySelector('span')?.textContent, tool: r._t?.tool }));
    return { open, rows };
  });
  if (!pal.open) fail('Palette öffnet nicht');
  const hasTool = (t) => pal.rows.some(r => r.tool === t);
  if (!hasTool('qr')) fail('QR-Werkzeug fehlt in der Palette');
  if (!hasTool('spotify')) fail('Spotify-Werkzeug fehlt in der Palette');
  // jede Zeile hat ein sichtbares Klartext-Label (keine icon-only-Einträge)
  if (pal.rows.some(r => !r.label || !r.label.trim())) fail('Palette-Zeile ohne Klartext-Label');
  console.log('palette rows=' + pal.rows.length + ' hasQR=' + hasTool('qr') + ' hasSpotify=' + hasTool('spotify') + ' labels=' + JSON.stringify(pal.rows.map(r => r.label)));

  // Suche filtert (Klartext, DE „Spotify-Code" / EN „Spotify code")
  await page.fill('#tpSearch', 'spo'); await page.waitForTimeout(120);
  const vis = await page.evaluate(() => [...document.querySelectorAll('.tprow')].filter(r => r.offsetParent !== null).map(r => r._t?.tool));
  console.log('search "spo" → tools=' + JSON.stringify(vis));
  if (!(vis.length === 1 && vis[0] === 'spotify')) fail('Suche filtert nicht auf Spotify');
  await page.fill('#tpSearch', '');

  // Klick auf QR-Zeile legt eine QR-Ebene an, Palette schließt
  await page.evaluate(() => { const r = [...document.querySelectorAll('.tprow')].find(x => x._t?.tool === 'qr'); r.click(); });
  await page.waitForTimeout(200);
  const afterQr = await page.evaluate(() => ({ n: S.layers.length, tool: S.layers[0]?.tool, type: S.layers[0]?.type, open: document.getElementById('toolPalette').classList.contains('open') }));
  console.log('nach QR-Klick:', JSON.stringify(afterQr));
  if (!(afterQr.n === 1 && afterQr.tool === 'qr' && afterQr.type === 'misc')) fail('QR-Klick legt keine QR-Ebene an');
  if (afterQr.open) fail('Palette schließt nach dem Anlegen nicht');

  // Esc schließt Palette; data-mode-Button schaltet weiter um
  await page.click('#btnAddTool'); await page.waitForTimeout(80);
  await page.keyboard.press('Escape'); await page.waitForTimeout(80);
  const escClosed = await page.evaluate(() => !document.getElementById('toolPalette').classList.contains('open'));
  if (!escClosed) fail('Esc schließt die Palette nicht');
  await page.click('.toolbtn[data-mode=edit]'); await page.waitForTimeout(80);
  const modeOk = await page.evaluate(() => S.tool === 'edit' && document.querySelector('.toolbtn[data-mode=edit]').classList.contains('on'));
  if (!modeOk) fail('Modus-Button (edit) schaltet nicht mehr um');

  if (errs.length) fail('JS-Fehler: ' + JSON.stringify(errs));
  await page.close();
}

// --- 2) Zoom-Anzeige + Ebenen-Thumbnails ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errs = []; page.on('pageerror', e => errs.push('EXC: ' + e.message));
  await page.goto(app); await page.waitForTimeout(300);

  // Zoom-Anzeige zeigt Prozent und ändert sich
  const z0 = await page.evaluate(() => document.getElementById('stZoom').textContent);
  if (!/\d+\s*%/.test(z0)) fail('Zoom-Anzeige zeigt kein Prozent (' + z0 + ')');
  await page.evaluate(() => zoomBy(1.2)); await page.waitForTimeout(80);
  const z1 = await page.evaluate(() => document.getElementById('stZoom').textContent);
  if (z1 === z0) fail('Zoom-Anzeige ändert sich nicht nach zoomBy');
  await page.evaluate(() => zoom100()); await page.waitForTimeout(80);
  const z2 = await page.evaluate(() => document.getElementById('stZoom').textContent);
  if (!/^100\s*%$/.test(z2)) fail('zoom100 setzt nicht auf 100 % (' + z2 + ')');
  console.log('zoom: fit=' + z0 + ' zoomBy=' + z1 + ' 100=' + z2);

  // Zwei Ebenen mit unterschiedlichen Strichen → unterschiedliche Thumbnails
  await page.evaluate(() => addLayer('text')); await page.waitForTimeout(600);
  await page.evaluate(() => addLayer('misc', 'qr')); await page.waitForTimeout(1600);
  const th = await page.evaluate(() => {
    return [...document.querySelectorAll('.lrow')].map(r => {
      const c = r.querySelector('.lti canvas');
      let hash = null;
      if (c) { const g = c.getContext('2d'); const d = g.getImageData(0, 0, 60, 60).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; hash = h; }
      return { name: r.querySelector('.ln')?.textContent, hasCanvas: !!c, hash };
    });
  });
  console.log('thumbnails:', JSON.stringify(th));
  const canvases = th.filter(t => t.hasCanvas);
  if (canvases.length !== 2) fail('nicht beide Ebenen haben ein Canvas-Thumbnail');
  if (new Set(canvases.map(t => t.hash)).size !== 2) fail('Thumbnails sind nicht unterscheidbar (identische Hashes)');

  // Artboard-Kontrast: Platte deutlich heller als Arbeits-Desk (≥ 15 %)
  await page.evaluate(() => fitView()); await page.waitForTimeout(120);
  const pts = await page.evaluate(() => {
    const cv = document.getElementById('cv'), rect = cv.getBoundingClientRect();
    const px = S.matW / 2 * S.view.scale + S.view.ox, py = S.matH / 2 * S.view.scale + S.view.oy;
    return { ox: rect.left, oy: rect.top, plate: [px, py], bg: [40, rect.height / 2] };
  });
  const buf = await page.screenshot();
  const b64 = buf.toString('base64');
  const s = await page.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const dpr = window.devicePixelRatio;
    const rd = (x, y) => { const d = g.getImageData(Math.round((pts.ox + x) * dpr), Math.round((pts.oy + y) * dpr), 1, 1).data; return [d[0], d[1], d[2]]; };
    return { plate: rd(pts.plate[0], pts.plate[1]), bg: rd(pts.bg[0], pts.bg[1]) };
  }, { b64, pts });
  const gap = Math.abs(lum(...s.plate) - lum(...s.bg)) * 100;
  console.log('artboard-Kontrast plate=' + JSON.stringify(s.plate) + ' desk=' + JSON.stringify(s.bg) + ' gap=' + gap.toFixed(1) + '%');
  if (gap < 15) fail('Platte hebt sich nicht genug vom Arbeits-Desk ab (' + gap.toFixed(1) + '%)');

  if (errs.length) fail('JS-Fehler: ' + JSON.stringify(errs));
  await page.close();
}

await browser.close();
console.log(ok ? '\n✅ STUDIO TOOLBAR TEST PASSED' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
