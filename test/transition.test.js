import test from 'node:test'; import assert from 'node:assert/strict';
import { createTransition, startTransition, stepTransition, blendParams, progress, PRESETS } from '../src/transition.js';
const sum = (w) => w.reduce((a, b) => a + b, 0);
test('загрузка — сразу пресет, без перехода', () => { const s = createTransition('night'); assert.deepEqual(s.weights, [0, 1, 0, 0]); assert.equal(progress(s), 1); });
test('переход за 10 с, веса суммируются в 1, монотонно', () => { let s = startTransition(createTransition('night'), 'day', 10); let prev = 0;
  for (let i = 0; i < 100; i++) { s = stepTransition(s, 0.1); assert.ok(Math.abs(sum(s.weights) - 1) < 1e-9); assert.ok(s.weights[2] >= prev - 1e-12); prev = s.weights[2]; }
  assert.deepEqual(s.weights.map((x) => +x.toFixed(6)), [0, 0, 1, 0]); });
test('переключение посреди перехода — без скачка', () => { let s = startTransition(createTransition('dusk'), 'storm', 10); s = stepTransition(s, 5);
  const before = [...s.weights]; s = startTransition(s, 'night'); assert.deepEqual(s.weights, before); s = stepTransition(s, 0.016);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(s.weights[i] - before[i]) < 0.01); });
test('смесь параметров: гроза включается только с весом', () => { assert.equal(blendParams([0, 0, 0, 1]).storm, 1); assert.equal(blendParams([0, 1, 0, 0]).stars, 1);
  const half = blendParams([0, .5, .5, 0]); assert.ok(half.lights > 0.35 && half.lights < 1); });
test('dur 0 — мгновенно; неизвестный пресет игнорируется', () => { let s = startTransition(createTransition('dusk'), 'day', 0); s = stepTransition(s, 0); assert.equal(s.weights[2], 1);
  assert.equal(startTransition(s, 'mars'), s); assert.equal(PRESETS.length, 4); });
