import test from 'node:test'; import assert from 'node:assert/strict';
import { loadSettings, saveSettings, skyAssets, rainParams, DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/settings.js';
import { LAYERS, layerOffset, W } from '../src/config.js';
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
test('ключ и дефолты', () => { assert.equal(SETTINGS_KEY, 'nightcity.settings.v1'); assert.deepEqual(loadSettings(mem()), DEFAULT_SETTINGS); });
test('битый JSON → дефолты', () => { const s = mem(); s.setItem(SETTINGS_KEY, '{x'); assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS); });
test('сохранение и ограничения', () => { const s = mem(); saveSettings({ sky: 'storm', clouds: false, rain: 7, lights: -1, parallax: 'x' }, s);
  const r = loadSettings(s); assert.equal(r.sky, 'storm'); assert.equal(r.clouds, false); assert.equal(r.rain, 1); assert.equal(r.lights, 0); assert.equal(r.parallax, DEFAULT_SETTINGS.parallax); });
test('неизвестное небо → dusk', () => { const s = mem(); s.setItem(SETTINGS_KEY, '{"sky":"mars"}'); assert.equal(loadSettings(s).sky, 'dusk'); });
test('storm берёт свои облака', () => { assert.deepEqual(skyAssets('storm'), { sky: 'sky_storm', clouds: ['clouds_storm'] }); assert.equal(skyAssets('night').clouds.length, 3); });
test('дождь монотонен, звук тихий, 0 = нет дождя', () => { let p = rainParams(0); assert.equal(p.density, 0); assert.equal(p.soundGain, 0);
  for (let l = 0.1; l <= 1.0001; l += 0.1) { const q = rainParams(l); assert.ok(q.density >= p.density && q.soundGain >= p.soundGain); p = q; } assert.ok(p.soundGain <= 0.08); });
test('параллакс: небо меньше всех, ближний больше, в пределах запаса', () => {
  const ps = LAYERS.map((l) => l.parallax); assert.deepEqual([...ps].sort((a, b) => a - b), ps);
  for (const l of LAYERS) { const [x] = layerOffset(l, 1, 1, 1); assert.ok(Math.abs(x) <= (W * (l.scale - 1)) / 2 + 1e-9); }
  assert.deepEqual(layerOffset(LAYERS[3], 0, 0, 1).map(Math.abs), [0, 0]); });
