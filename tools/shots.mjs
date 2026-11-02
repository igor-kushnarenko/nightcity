// Скриншоты пресетов: npx vite preview --port 4190 & node tools/shots.mjs http://localhost:4190/nightcity/ shots/v1
import { chromium } from 'playwright-core'; import { mkdirSync } from 'node:fs';
const url = process.argv[2] || 'http://localhost:4190/nightcity/'; const out = process.argv[3] || 'shots/v1'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = []; const ctx = await b.newContext({ viewport: { width: 1672, height: 941 } }); const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push('' + e)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (const [n, q, mv] of [['dusk', '?sky=dusk', [836, 470]], ['night', '?sky=night', [836, 470]], ['day', '?sky=day&rain=0', [836, 470]], ['storm', '?sky=storm&rain=1', [836, 470]],
  ['parallax_tl', '?sky=night', [0, 0]], ['parallax_br', '?sky=night', [1671, 940]]]) {
  await p.goto(url + q); await p.evaluate(() => localStorage.clear()); await p.goto(url + q); await p.waitForTimeout(4000);
  await p.evaluate(() => document.getElementById('overlay').classList.add('gone')); await p.mouse.move(mv[0], mv[1], { steps: 5 }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${n}.png` }); console.log(n, JSON.stringify(await p.evaluate(() => window.__nightcity.state().offsets)));
}
await p.goto(url + '?sky=night'); await p.waitForTimeout(3000); await p.hover('#mbtn'); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/menu.png` });
console.log('errors:', errs); await b.close();
