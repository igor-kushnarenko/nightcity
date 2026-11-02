# Маски звёзд: masks/stars_<sky>.png — r=255 на звезде, g = id звезды (фаза). Звёзды — связные компоненты ярких
# мелких пикселей, заметно ярче локального фона. Запуск: .venv/bin/python tools/make_stars.py
from PIL import Image; import numpy as np; from scipy import ndimage as ndi
for sky in ('night', 'dusk'):
    a = np.asarray(Image.open(f'public/layers/sky_{sky}.png').convert('RGB')).astype(np.float32) / 255
    lum = a @ np.array([.299, .587, .114], np.float32); bg = ndi.median_filter(lum, 9)
    cand = (lum - bg > .12) & (lum > .3)
    lab, n = ndi.label(cand, np.ones((3, 3), bool)); idx = np.arange(1, n + 1)
    area = ndi.sum(cand, lab, idx); sl = ndi.find_objects(lab)
    keep = np.zeros(n + 1, bool)
    for i, s in enumerate(sl): keep[i + 1] = area[i] <= 16 and (s[0].stop - s[0].start) <= 5 and (s[1].stop - s[1].start) <= 5
    st = keep[lab]; lab2, n2 = ndi.label(st, np.ones((3, 3), bool))
    m = np.zeros(lum.shape + (3,), np.uint8); m[..., 0] = st * 255
    ph = np.random.default_rng(7).integers(1, 256, n2 + 1).astype(np.uint8); m[..., 1] = np.where(st, ph[lab2], 0)
    Image.fromarray(m).save(f'public/layers/masks/stars_{sky}.png', optimize=True); print(sky, 'stars', n2)
