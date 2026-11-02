// node tools/menushot.mjs <url> <out.png> — скриншот раскрытого меню (наведение на ☰)
import { chromium } from 'playwright-core';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push('' + e));
await p.goto(url); await p.waitForTimeout(4000); await p.mouse.click(960, 540); await p.waitForTimeout(1500);
const bb = await p.locator('#menubtn').boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 4 }); await p.waitForTimeout(1000); await p.screenshot({ path: out }); console.log(out, 'errors:', errs); await b.close();
