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
