import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, existsSync } from 'node:fs';
test('маска звёзд есть и подключена к небу', () => { assert.ok(existsSync(new URL('../public/layers/masks/stars_night.png', import.meta.url)));
  const m = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'); assert.match(m, /stars_night/); assert.match(m, /NOFX\.has\('stars'\)/); });
