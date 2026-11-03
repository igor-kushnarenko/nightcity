// node tools/radioshots.mjs <url> shots/v8 — радио: off / on (ночь), кроп радио, меню; клик по радио и клавиша R
import { chromium } from 'playwright-core'; import { mkdirSync } from 'node:fs';
const [url, out = 'shots/v8'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: 1672, height: 941 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push('' + e)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const clip = { x: 1150, y: 600, width: 360, height: 230 };
await p.goto(`${url}?sky=night&rain=0.3&radio=0`); await p.waitForTimeout(4500); await p.evaluate(() => document.getElementById('overlay').classList.add('gone'));
await p.mouse.move(836, 470); await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/radio_off.png` }); await p.screenshot({ path: `${out}/radio_off_crop.png`, clip });
await p.mouse.click(1340, 740); await p.mouse.move(836, 470); await p.waitForTimeout(1500);
const s1 = await p.evaluate(() => window.__nightcity.radio()); await p.screenshot({ path: `${out}/radio_on.png` }); await p.screenshot({ path: `${out}/radio_on_crop.png`, clip });
await p.mouse.move(1650, 915); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/radio_menu.png` });
await p.mouse.move(836, 470); await p.waitForTimeout(6000); await p.keyboard.press('r'); await p.waitForTimeout(800);
const s2 = await p.evaluate(() => ({ r: window.__nightcity.radio(), saved: JSON.parse(localStorage.getItem('nightcity.settings.v1')).radio }));
await p.keyboard.press('l'); await p.keyboard.press('2'); await p.waitForTimeout(300); const s3 = await p.evaluate(() => window.__nightcity.state());
console.log(JSON.stringify({ afterClick: s1, afterR: s2, lampL: s3.lamps.left, sky: s3.sky })); console.log('errors', errs); await b.close();
