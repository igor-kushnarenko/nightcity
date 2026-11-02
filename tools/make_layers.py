# Готовит слои из art_src/'layers nightcity' → public/layers/*.png и маски окон/неона.
# Исходники не трогаем. Запуск: python3 tools/make_layers.py
from PIL import Image
import numpy as np, os
SRC = 'art_src/layers nightcity'; OUT = 'public/layers'; W, H = 1672, 941
os.makedirs(OUT + '/masks', exist_ok=True)
def load(name):
    im = Image.open(f'{SRC}/{name}')
    if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
    return im
names = {'room': 'room.png', 'near': 'Ближний.png', 'midnear': 'Средний ближний.png', 'midfar': 'Средний дальний.png',
         'far': 'Дальний туманный мегаполис будущего.png', 'sky_dusk': 'Пиксельное небо в сумерках.png',
         'sky_night': 'night_sky.png', 'sky_day': 'day_sky.png', 'sky_storm': 'storm_sky.png',
         'clouds1': 'clouds_1.png', 'clouds2': 'clouds_2.png', 'clouds3': 'clouds_3.png', 'clouds_storm': 'storm_clouds.png'}
for k, n in names.items():
    im = load(n); im = im.convert('RGB') if k.startswith('sky') else im.convert('RGBA')
    im.save(f'{OUT}/{k}.png', optimize=True)
    if k in ('near', 'midnear', 'midfar', 'far'):
        a = np.asarray(im).astype(np.float32) / 255; r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
        mx = a[..., :3].max(-1); mn = a[..., :3].min(-1); sat = (mx - mn) / (mx + 1e-4)
        warm = (al > .5) & (r > .55) & (g > .4) & (b < g * .75) & (r >= g) & (sat > .35)
        neon = (al > .5) & (sat > .45) & (mx > .5) & (((b > r * 1.25) & (b > .55)) | ((g > .5) & (b > .5) & (r < .45)) | ((r > .55) & (b > .5) & (g < r * .6)))
        m = np.zeros((H, W, 3), np.uint8); m[..., 0] = warm * 255; m[..., 2] = neon * 255
        # кластер окон: случайная фаза на блок 6x6 (g) — чтобы окна мигали группами
        rng = np.random.default_rng(len(k)); blk = rng.integers(0, 256, (H // 6 + 1, W // 6 + 1), dtype=np.uint8)
        m[..., 1] = np.kron(blk, np.ones((6, 6), np.uint8))[:H, :W]
        Image.fromarray(m).save(f'{OUT}/masks/{k}_fx.png', optimize=True)
        print(k, 'windows', int(warm.sum()), 'neon', int(neon.sum()))
