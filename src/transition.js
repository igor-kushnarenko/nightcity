// Плавные переходы между пресетами неба. Состояние — веса пресетов (сумма 1); переход идёт от текущей смеси
// к целевому пресету по smoothstep, поэтому переключение посреди перехода не даёт скачков.
export const PRESETS = ['dusk', 'night', 'day', 'storm'];
// Параметры пресетов: огни города, звёзды, цветокоррекция города и комнаты, гроза, добавка к дождю
export const PRESET_PARAMS = {
  dusk:  { lights: 0.85, stars: 0.0, grade: [1.0, 0.95, 0.95], room: [1.0, 0.97, 0.95], storm: 0, rainAdd: 0 },
  night: { lights: 1.0, stars: 1.0, grade: [0.9, 0.92, 1.0], room: [0.95, 0.96, 1.0], storm: 0, rainAdd: 0 },
  day:   { lights: 0.35, stars: 0.0, grade: [1.08, 1.08, 1.06], room: [1.08, 1.07, 1.05], storm: 0, rainAdd: 0 },
  storm: { lights: 0.8, stars: 0.0, grade: [0.82, 0.86, 0.95], room: [0.9, 0.92, 0.98], storm: 1, rainAdd: 0.3 },
};
export const smoothstep = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const oneHot = (p) => PRESETS.map((q) => (q === p ? 1 : 0));
export function createTransition(preset, duration = 10) {
  return { from: oneHot(preset), to: oneHot(preset), target: preset, t: duration, dur: duration, weights: oneHot(preset) };
}
/** Начать переход к preset от текущей смеси. */
export function startTransition(s, preset, duration = s.dur) {
  if (!PRESETS.includes(preset)) return s;
  if (preset === s.target && s.t >= s.dur) return s;
  return { ...s, from: [...s.weights], to: oneHot(preset), target: preset, t: 0, dur: Math.max(0, duration) };
}
/** Шаг времени dt (с). */
export function stepTransition(s, dt) {
  const t = Math.min(s.dur, s.t + dt); const k = s.dur > 0 ? smoothstep(t / s.dur) : 1;
  return { ...s, t, weights: s.from.map((f, i) => f + (s.to[i] - f) * k) };
}
export const progress = (s) => (s.dur > 0 ? Math.min(1, s.t / s.dur) : 1);
/** Смешанные параметры по весам. */
export function blendParams(weights) {
  const out = { lights: 0, stars: 0, grade: [0, 0, 0], room: [0, 0, 0], storm: 0, rainAdd: 0 };
  PRESETS.forEach((p, i) => { const w = weights[i], P = PRESET_PARAMS[p]; if (!w) return;
    for (const k of ['lights', 'stars', 'storm', 'rainAdd']) out[k] += P[k] * w;
    for (const k of ['grade', 'room']) for (let j = 0; j < 3; j++) out[k][j] += P[k][j] * w; });
  return out;
}
