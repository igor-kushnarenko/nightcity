// Серия кадров для проверки мерцания: node tools/seqshots.mjs <url> shots/v3
import { chromium } from 'playwright-core'; import { mkdirSync } from 'node:fs';
const [url, out = 'shots/v3'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1672, height: 941 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push('' + e));
await p.goto(url + '?sky=night&nofx=rain,clouds'); await p.waitForTimeout(4000); await p.evaluate(() => document.getElementById('overlay').classList.add('gone'));
await p.mouse.move(700, 400); await p.waitForTimeout(2000);
for (let i = 0; i < 8; i++) { await p.screenshot({ path: `${out}/seq_${i}.png`, clip: { x: 980, y: 150, width: 420, height: 520 } }); await p.waitForTimeout(700); }
await p.screenshot({ path: `${out}/full_night.png` }); console.log('errors', errs); await b.close();
