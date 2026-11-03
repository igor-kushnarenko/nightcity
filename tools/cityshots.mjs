// Скриншоты видов города: npx vite preview --port 4190 & node tools/cityshots.mjs http://localhost:4190/nightcity/ shots/v10
import { chromium } from 'playwright-core'; import { mkdirSync } from 'node:fs'; import { SKY_PRESETS as SKIES } from '../src/settings.js';
const url = process.argv[2] || 'http://localhost:4190/nightcity/'; const out = process.argv[3] || 'shots/v10'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = []; const ctx = await b.newContext({ viewport: { width: 1672, height: 941 } }); const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push('' + e)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const shot = async (n, q) => { await p.goto(url + q); await p.waitForTimeout(4000); await p.evaluate(() => document.getElementById('overlay').classList.add('gone')); await p.mouse.move(1600, 100); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${n}.png` }); console.log(n, JSON.stringify(await p.evaluate(() => window.__nightcity.state()).then((s) => [s.city, s.cityShown, s.parallaxOn]))); };
await p.goto(url); await p.evaluate(() => localStorage.clear());
if (!process.env.MENU_ONLY) for (const s of SKIES) { await shot(`panorama2_${s}`, `?sky=${s}&rain=0.3`); await shot(`panorama2_${s}_lamps`, `?sky=${s}&rain=0.3&lamps=all`); await shot(`panorama_${s}`, `?sky=${s}&rain=0.3&city=panorama`); }
await p.goto(url + '?sky=night&city=panorama2'); await p.waitForTimeout(3000); await p.evaluate(() => document.getElementById('overlay').classList.add('gone'));
await p.evaluate(() => document.getElementById('hud').classList.remove('closed')); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/menu.png` });
await p.evaluate(() => document.getElementById('citynext').click()); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/switch_mid.png` }); await p.waitForTimeout(1500);
console.log('after ›', JSON.stringify(await p.evaluate(() => [window.__nightcity.state().city, document.getElementById('cityname').textContent, JSON.parse(localStorage.getItem('nightcity.settings.v1')).city])));
await p.screenshot({ path: `${out}/switch_done.png` }); console.log('errors:', errs); await b.close();
