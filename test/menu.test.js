import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { SKY_PRESETS } from '../src/settings.js';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('меню как в rainroom: круглая кнопка + hud', () => { assert.match(html, /id="menubtn"/); assert.match(html, /id="hud" class="glass closed"/); });
test('все пункты настроек есть в меню', () => {
  for (const s of SKY_PRESETS) assert.match(html, new RegExp(`data-sky="${s}"`));
  for (const id of ['cloudsbtn', 'cloudSpeed', 'lights', 'rain', 'parallax', 'volume', 'mute', 'fs']) assert.match(html, new RegExp(`id="${id}"`)); });
