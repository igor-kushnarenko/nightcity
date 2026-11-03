import test from 'node:test'; import assert from 'node:assert/strict';
import { CITY_LAYOUTS, CITY_IDS, DEFAULT_CITY, nextCity, cityPlace, cityAmbient, PARALLAX_ENABLED, LAYERS } from '../src/config.js';
import { DEFAULT_SETTINGS, normalize } from '../src/settings.js';
test('параллакс выключен, панорама по умолчанию, классика сохранена', () => {
  assert.equal(PARALLAX_ENABLED, false); assert.equal(DEFAULT_CITY, 'panorama2'); assert.equal(DEFAULT_SETTINGS.city, 'panorama2'); assert.ok(CITY_IDS.includes('panorama')); assert.ok(CITY_IDS.includes('classic'));
  for (const L of LAYERS.filter((l) => l.fx)) assert.equal(CITY_LAYOUTS.classic[L.id].scale, L.scale); });
test('у каждой раскладки все 4 слоя и имя', () => { for (const id of CITY_IDS) { const c = CITY_LAYOUTS[id]; assert.ok(c.name); for (const k of ['far', 'midfar', 'midnear', 'near']) assert.ok(c[k].scale > 0 && Number.isFinite(c[k].x + c[k].y)); } });
test('‹ › по кругу', () => { assert.equal(nextCity(CITY_IDS[0], 1), CITY_IDS[1]); assert.equal(nextCity(CITY_IDS[0], -1), CITY_IDS.at(-1)); assert.equal(nextCity('нет', 1), CITY_IDS[1 % CITY_IDS.length]); });
test('плавный переход между раскладками', () => { const a = cityPlace('classic', 'panorama', 'far', 0), b = cityPlace('classic', 'panorama', 'far', 1);
  assert.deepEqual(a, CITY_LAYOUTS.classic.far); assert.deepEqual(b, CITY_LAYOUTS.panorama.far); assert.ok(cityPlace('classic', 'panorama', 'far', 0.5).y < 0); });
test('city в настройках сохраняется', () => { assert.equal(normalize({ city: 'classic' }).city, 'classic'); assert.equal(normalize({}).city, 'panorama2'); });
test('roomAmbient: 1 по умолчанию, плавно', () => { assert.equal(cityAmbient('classic', 'panorama', 1), 1); assert.equal(cityAmbient('panorama', 'panorama2', 1), 0.6); assert.ok(Math.abs(cityAmbient('panorama', 'panorama2', 0.5) - 0.8) < 1e-9); });
