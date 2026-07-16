import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = 'file://' + path.join(here, '..');
const browser = await chromium.launch();

// 1) Englischer Browser → englische UI + englische Studio-Tour
const en = await browser.newContext({ locale: 'en-US' });
const p1 = await en.newPage({ viewport: { width: 1500, height: 950 } });
p1.on('pageerror', e => console.log('EXC:', e.message));
await p1.goto(root + '/app/index.html');
await p1.waitForTimeout(700);
const tourTitle = await p1.locator('.tour-card h3').textContent().catch(() => 'KEINE TOUR');
const fontLabel = await p1.evaluate(() => document.querySelector('label').textContent);
console.log('EN-Browser → Tour:', JSON.stringify(tourTitle), '| 1. Label:', JSON.stringify(fontLabel));
await p1.keyboard.press('Escape');
const btnExport = await p1.locator('#btnExport').textContent();
const stLen = await p1.evaluate(() => document.getElementById('stLen').textContent);
console.log('Export-Button:', JSON.stringify(btnExport), '| Status:', JSON.stringify(stLen));
await p1.screenshot({ path: '/tmp/lac_test/lang_en.png' });
// Umschalten auf Deutsch
await p1.click('#btnLang');
await p1.waitForTimeout(300);
console.log('Nach DE-Toggle:', JSON.stringify(await p1.locator('#btnExport').textContent()));
// Landing (DE-Wahl gespeichert): CTA muss deutsch sein
await p1.goto(root + '/index.html');
console.log('Landing CTA (nach DE-Wahl, gespeichert):', JSON.stringify(await p1.locator('.cta').textContent()));
await en.close();

// 2) Deutscher Browser → deutsche UI bleibt (Studio mit Bild-Ebene)
const de = await browser.newContext({ locale: 'de-DE' });
const p2 = await de.newPage({ viewport: { width: 1500, height: 950 } });
p2.on('pageerror', e => console.log('EXC:', e.message));
await p2.goto(root + '/app/index.html?layer=image');
await p2.waitForTimeout(700);
console.log('DE-Browser → Tour:', JSON.stringify(await p2.locator('.tour-card h3').textContent().catch(() => 'KEINE')));
await p2.keyboard.press('Escape');
console.log('DE-Browser → Stil-Option:', JSON.stringify(await p2.locator('#inpStyle option').first().textContent()));
await de.close();
await browser.close();
