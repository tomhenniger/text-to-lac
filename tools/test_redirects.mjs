// Weiterleitungs-Stubs: handschrift.html -> index.html?panel=capture (Params
// erhalten, Modal offen); bild.html -> index.html?layer=image (Bild-Ebene).
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = 'file://' + path.join(here, '..', 'app');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', e => console.log('EXC:', e.message));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ FEHLER: ') + m); if (!c) fails++; };
await page.addInitScript(() => { for (const k of ["studio","handschrift"]) localStorage.setItem("tour_"+k, "1"); });

// ===== handschrift.html?font=hw_meine -> Capture-Modal, font-Param erhalten =====
await page.goto(appDir + '/handschrift.html?font=hw_meine');
await page.waitForFunction(() => !!window.__studio && !!window.Capture);
await page.waitForTimeout(300);
const url1 = page.url();
console.log('handschrift-Stub -> URL:', url1.split('/app/')[1]);
ok(url1.includes('panel=capture'), 'handschrift-Stub setzt panel=capture');
ok(url1.includes('font=hw_meine'), 'handschrift-Stub erhält font-Param');
ok(!url1.includes('handschrift.html'), 'handschrift-Stub leitet auf index.html weiter');
const modalOpen = await page.evaluate(() => !document.getElementById('captureModal').hidden);
ok(modalOpen, 'Capture-Modal ist offen');

// ===== bild.html -> Bild-Ebene =====
await page.goto(appDir + '/bild.html');
await page.waitForFunction(() => !!window.__studio);
await page.waitForTimeout(300);
const url2 = page.url();
console.log('bild-Stub -> URL:', url2.split('/app/')[1]);
ok(url2.includes('layer=image'), 'bild-Stub setzt layer=image');
ok(!url2.includes('bild.html'), 'bild-Stub leitet auf index.html weiter');
const active = await page.evaluate(() => window.__studio.Layers.active().type);
ok(active === 'image', 'aktive Ebene ist eine Bild-Ebene (' + active + ')');

// ===== Param-Erhalt zusammen (bild.html?foo=bar) =====
await page.goto(appDir + '/bild.html?foo=bar');
await page.waitForFunction(() => !!window.__studio);
const url3 = page.url();
ok(url3.includes('foo=bar') && url3.includes('layer=image'), 'bild-Stub erhält bestehende Query-Params');

await browser.close();
console.log(fails === 0 ? 'REDIRECTS BESTANDEN' : `REDIRECTS: ${fails} PROBLEME`);
process.exit(fails ? 1 : 0);
