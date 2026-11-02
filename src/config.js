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
