// node tools/transshots.mjs <url> shots/v7 — переходы night→day и dusk→storm, кадры на t=0,3,6,10 с (по прогрессу перехода)
import { chromium } from 'playwright-core'; import { mkdirSync } from 'node:fs';
const [url, out = 'shots/v7'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1672, height: 941 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push('' + e)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (const [from, to] of [['night', 'day'], ['dusk', 'storm']]) {
  await p.goto(`${url}?sky=${from}&rain=0.3`); await p.evaluate(() => localStorage.clear()); await p.goto(`${url}?sky=${from}&rain=0.3`);
  await p.waitForTimeout(4000); await p.evaluate(() => document.getElementById('overlay').classList.add('gone')); await p.mouse.move(836, 470); await p.waitForTimeout(800);
  await p.evaluate((to) => window.__nightcity.sky(to), to);
  for (const t of [0, 3, 6, 10]) {
    if (t) await p.waitForFunction((x) => window.__nightcity.transition().progress >= x, t / 10, { timeout: 120000, polling: 50 });
    await p.screenshot({ path: `${out}/${from}_to_${to}_t${t}.png` }); console.log(from, to, t, JSON.stringify(await p.evaluate(() => window.__nightcity.transition())));
  }
}
console.log('errors', errs); await b.close();
