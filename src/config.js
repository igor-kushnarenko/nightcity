// Сцена: размер холста и параллакс слоёв (px смещения при мыши у края, при силе 1).
export const W = 1672, H = 941;
export const LAYERS = [
  { id: 'sky', parallax: 4, scale: 1.03 },
  { id: 'clouds', parallax: 7, scale: 1.04 },
  { id: 'far', parallax: 10, scale: 1.03, fx: true },
  { id: 'midfar', parallax: 16, scale: 1.035, fx: true },
  { id: 'midnear', parallax: 24, scale: 1.04, fx: true },
  { id: 'near', parallax: 34, scale: 1.05, fx: true },
];
export const ROOM_PARALLAX = 2;
// Параллакс пока выключен (код сохранён): true — вернуть реакцию на мышь (и ползунок в index.html).
export const PARALLAX_ENABLED = false;
// ===== Раскладки города — ЕДИНСТВЕННОЕ место, где двигать фон =====
// x, y — сдвиг центра слоя в px холста 1672x941 (+x вправо, +y вниз); scale — масштаб слоя (1 = исходный PNG).
// Маски огней/неона едут вместе со слоем. Новую раскладку — просто добавить ключ, она появится в меню (‹ ›).
export const CITY_LAYOUTS = {
  // panorama — снято из art_src/nightcity_panorama.psd (1890x1063 → ×1672/1890) скриптом tools/psd_layout.py
  panorama: { name: 'Панорама', far: { x: 65, y: -88, scale: 0.575 }, midfar: { x: -123, y: -195, scale: 1.1023 }, midnear: { x: 255, y: -49, scale: 1.1041 }, near: { x: 28, y: -44, scale: 1.0934 } },
  classic: { name: 'Классика', far: { x: 0, y: 0, scale: 1.03 }, midfar: { x: 0, y: 0, scale: 1.035 }, midnear: { x: 0, y: 0, scale: 1.04 }, near: { x: 0, y: 0, scale: 1.05 } },
};
export const CITY_IDS = Object.keys(CITY_LAYOUTS);
export const DEFAULT_CITY = 'panorama';
/** Следующая/предыдущая раскладка по кругу. */
export function nextCity(id, d = 1) { const i = Math.max(0, CITY_IDS.indexOf(id)); return CITY_IDS[(i + d + CITY_IDS.length) % CITY_IDS.length]; }
/** Плавная смесь двух раскладок для слоя (t 0..1). */
export function cityPlace(from, to, layerId, t) { const a = CITY_LAYOUTS[from]?.[layerId] || { x: 0, y: 0, scale: 1 }, b = CITY_LAYOUTS[to]?.[layerId] || a, m = (u, v) => u + (v - u) * t; return { x: m(a.x, b.x), y: m(a.y, b.y), scale: m(a.scale, b.scale) }; }
/** Смещение слоя по позиции мыши (-1..1) и силе параллакса; не выходит за запас масштаба. */
export function layerOffset(layer, mx, my, strength) {
  const maxX = (W * (layer.scale - 1)) / 2, maxY = (H * (layer.scale - 1)) / 2, p = layer.parallax * strength;
  const cl = (v, m) => Math.max(-m, Math.min(m, v));
  return [cl(-mx * p, maxX), cl(my * p, maxY)];
}
// Светильники комнаты (пиксели room.png): pos — точка света (у панели — отрезок seg), hit — зона клика.
export const LAMPS = {
  left: { name: 'Лампа', key: 'l', pos: [194, 576], seg: [576, 576], radius: 230, color: [1.0, 0.72, 0.42], hit: [174, 546, 216, 602] },
  right: { name: 'Панель', key: 'k', pos: [1632, 350], seg: [275, 426], radius: 280, color: [1.0, 0.62, 0.28], hit: [1612, 240, 1662, 462] },
};
export const LAMP_IDS = Object.keys(LAMPS);
/** Какая лампа под точкой сцены (px), или null. */
export function hitLamp(x, y) { for (const id of LAMP_IDS) { const [x0, y0, x1, y1] = LAMPS[id].hit; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return id; } return null; }
/** Клиентские координаты → пиксели сцены при object-fit: contain. */
export function clientToScene(cx, cy, rect) { const s = Math.min(rect.width / W, rect.height / H), ox = rect.left + (rect.width - W * s) / 2, oy = rect.top + (rect.height - H * s) / 2; return [(cx - ox) / s, (cy - oy) / s]; }
// Радио на подоконнике (пиксели room.png): hit — зона клика/колеса, dial — шкала (светится), led — индикатор.
export const RADIO = { name: 'Радио', hit: [1218, 676, 1470, 800], dial: [1325, 714, 1451, 745], led: [1418, 752], fade: 0.3 };
/** Радио под точкой сцены? */
export function hitRadio(x, y) { const [x0, y0, x1, y1] = RADIO.hit; return x >= x0 && x <= x1 && y >= y0 && y <= y1; }
