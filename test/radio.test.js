import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RADIO, hitRadio, hitLamp } from '../src/config.js';
import { loadSettings, saveSettings, SETTINGS_KEY } from '../src/settings.js';
import { nextIndex } from '../src/radio.js';
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
test('радио: выкл по умолчанию, настройки сохраняются и ограничиваются', () => {
  const st = mem(); let s = loadSettings(st); assert.equal(s.radio, false); assert.equal(s.radioVol, 0.5); assert.equal(s.radioStation, '');
  saveSettings({ ...s, radio: true, radioVol: 3, radioStation: 'abc' }, st); s = loadSettings(st);
  assert.deepEqual([s.radio, s.radioVol, s.radioStation], [true, 1, 'abc']); assert.ok(st.getItem(SETTINGS_KEY));
});
test('зона радио: попадание, не пересекается с лампами', () => {
  assert.ok(hitRadio(1340, 740)); assert.ok(!hitRadio(600, 740)); const [x0, y0, x1, y1] = RADIO.hit;
  for (let x = x0; x <= x1; x += 8) for (let y = y0; y <= y1; y += 8) assert.equal(hitLamp(x, y), null);
});
test('станции: https, без HLS, без дублей', () => {
  const list = JSON.parse(readFileSync(new URL('../public/stations.json', import.meta.url))); assert.ok(list.length > 0);
  for (const s of list) { assert.match(s.url, /^https:\/\//); assert.ok(!/\.m3u8/i.test(s.url)); }
  assert.equal(new Set(list.map((s) => s.url)).size, list.length);
});
test('следующая станция пропускает нерабочие', () => { assert.equal(nextIndex(3, 0, 1, new Set([1])), 2); assert.equal(nextIndex(2, 0, 1, new Set([0, 1])), -1); });
