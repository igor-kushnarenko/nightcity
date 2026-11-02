// node tools/lampshots.mjs <url> shots/v4 — лампы: off / left / right / both (ночь)
import { chromium } from 'playwright-core'; import { mkdirSync } from 'node:fs';
const [url, out = 'shots/v5'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1672, height: 941 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push('' + e)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (const [n, l, extra = ''] of [['off', 'none'], ['left', 'left'], ['right', 'right'], ['both', 'all'], ['both_low', 'all', '&q=low']]) {
  await p.goto(`${url}?sky=night&rain=0.3&lamps=${l}${extra}`); await p.waitForTimeout(4500); await p.evaluate(() => document.getElementById('overlay').classList.add('gone'));
  await p.mouse.move(836, 470); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${n}.png` });
}
console.log('errors', errs); await b.close();
