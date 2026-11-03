"""Раскладка города из PSD → строка для CITY_LAYOUTS в src/config.js.
.venv/bin/python tools/psd_layout.py art_src/nightcity_panorama.psd [имя_раскладки]
Слои PSD (сверху вниз Layer 5..2) = near, midnear, midfar, far; ищем масштаб и сдвиг исходного PNG
(art_src/layers nightcity/) внутри слоя PSD (matchTemplate), переводим в px холста 1672x941."""
import sys, numpy as np, cv2
from PIL import Image
from psd_tools import PSDImage
W, H = 1672, 941
SRC = 'art_src/layers nightcity/'
F = {'far': 'Дальний туманный мегаполис будущего', 'midfar': 'Средний дальний', 'midnear': 'Средний ближний', 'near': 'Ближний'}
psd = PSDImage.open(sys.argv[1]); name = sys.argv[2] if len(sys.argv) > 2 else 'panorama'; k = W / psd.size[0]
layers = [l for l in psd if l.kind == 'pixel'][2:]  # Background, небо, затем far..near
out = {}
for key, l in zip(['far', 'midfar', 'midnear', 'near'], layers):
    P = np.array(l.topil().convert('RGBA')).astype(np.float32); pad = 80
    Pp = cv2.copyMakeBorder(P, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    src = Image.open(SRC + F[key] + '.png').convert('RGBA'); a = np.array(src)[..., 3]
    ys, xs = np.nonzero(a > 8); pa = np.array(l.topil().convert('RGBA'))[..., 3]; py, px = np.nonzero(pa > 8)
    s0 = (px.max() - px.min()) / (xs.max() - xs.min())
    crop = (xs.min() + 20, ys.min() + 20, xs.max() - 20, ys.max() - 20); c = src.crop(crop); best = None
    for s in np.arange(s0 - 0.07, s0 + 0.07, 0.002):
        w, h = round(c.width * s), round(c.height * s)
        if w >= Pp.shape[1] or h >= Pp.shape[0]: continue
        t = np.array(c.resize((w, h), Image.BILINEAR)).astype(np.float32)
        v, _, loc, _ = cv2.minMaxLoc(cv2.matchTemplate(Pp, t, cv2.TM_SQDIFF)); v /= t.size
        if best is None or v < best[0]: best = (v, s, loc)
    v, s, loc = best; S = s * k
    ox = l.left + loc[0] - pad - crop[0] * s; oy = l.top + loc[1] - pad - crop[1] * s
    out[key] = (round(ox * k + W * S / 2 - W / 2), round(oy * k + H * S / 2 - H / 2), float(round(S, 4))); print(key, out[key], 'err', round(v, 1), file=sys.stderr)
print(f"  {name}: {{ name: '{name}', " + ', '.join(f"{k_}: {{ x: {x}, y: {y}, scale: {sc} }}" for k_, (x, y, sc) in out.items()) + ' },')
