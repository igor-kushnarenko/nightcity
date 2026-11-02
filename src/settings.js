// Настройки nightcity (localStorage nightcity.settings.v1).
export const SETTINGS_KEY = 'nightcity.settings.v1';
export const SKY_PRESETS = ['dusk', 'night', 'day', 'storm'];
export const DEFAULT_SETTINGS = { sky: 'dusk', clouds: true, cloudSpeed: 0.4, lights: 0.7, rain: 0.5, parallax: 0.6, volume: 0.5 };
const c01 = (x, d) => (x !== null && x !== '' && x !== undefined && Number.isFinite(+x) ? Math.min(1, Math.max(0, +x)) : d);
export function normalize(raw) {
  const D = DEFAULT_SETTINGS;
  return {
    sky: SKY_PRESETS.includes(raw?.sky) ? raw.sky : D.sky,
    clouds: raw?.clouds === undefined ? D.clouds : !!raw.clouds,
    cloudSpeed: c01(raw?.cloudSpeed, D.cloudSpeed), lights: c01(raw?.lights, D.lights),
    rain: c01(raw?.rain, D.rain), parallax: c01(raw?.parallax, D.parallax), volume: c01(raw?.volume, D.volume),
  };
}
export function loadSettings(storage = globalThis.localStorage) {
  let raw = null; try { raw = JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null'); } catch {}
  return normalize(raw);
}
export function saveSettings(s, storage = globalThis.localStorage) { try { storage?.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} }
/** Ресурсы неба для пресета: storm — свои небо и облака. */
export function skyAssets(sky) {
  const s = SKY_PRESETS.includes(sky) ? sky : 'dusk';
  return { sky: `sky_${s}`, clouds: s === 'storm' ? ['clouds_storm'] : ['clouds1', 'clouds2', 'clouds3'] };
}
const lerp = (a, b, t) => a + (b - a) * t;
export function rainParams(level) {
  const l = c01(level, 0.5);
  return { density: lerp(0, 0.62, l ** 1.3), speed: lerp(0.75, 1.3, l), length: lerp(0.55, 1.7, l), slant: lerp(0.1, 0.34, l), alpha: lerp(0.65, 1.15, l),
    soundGain: l < 0.01 ? 0 : lerp(0.015, 0.07, l), soundCutoff: lerp(2500, 6000, l) };
}
