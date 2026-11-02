# Карты света комнаты: masks/room_nrm.png (rg — псевдонормаль из яркости (собель), b — блеск),
# masks/room_emit.png (r — левая лампа-цилиндр, g — правая янтарная панель). Запуск: .venv/bin/python tools/make_light.py
from PIL import Image; import numpy as np; from scipy import ndimage as ndi
a = np.asarray(Image.open('public/layers/room.png')).astype(np.float32) / 255
rgb, al = a[..., :3], a[..., 3]; H, W = al.shape
lum = rgb @ np.array([.299, .587, .114], np.float32)
h = ndi.gaussian_filter(lum, 1.2) * (al > .5)
gx = ndi.sobel(h, 1); gy = ndi.sobel(h, 0); s = 3.0
n = np.dstack([-gx * s, -gy * s, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / (mx + 1e-4)
edge = np.hypot(ndi.sobel(lum, 1), ndi.sobel(lum, 0))
gloss = np.clip((lum - .12) * 2.5, 0, 1) * np.clip(1.2 - sat * 1.5, 0, 1) * 0.6 + np.clip(edge * 1.5, 0, .4)
gloss[(al < .5)] = 0
nrm = np.dstack([(n[..., 0] * .5 + .5), (n[..., 1] * .5 + .5), np.clip(gloss, 0, 1)])
Image.fromarray((nrm * 255).astype(np.uint8)).save('public/layers/masks/room_nrm.png', optimize=True)
emit = np.zeros((H, W, 3), np.uint8)
yy, xx = np.mgrid[0:H, 0:W]
left = ((xx >= 182) & (xx <= 206) & (yy >= 557) & (yy <= 594) & (al > .5))
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
right = (xx >= 1615) & (xx <= 1650) & (yy >= 262) & (yy <= 440) & (r > g + .07) & (g > b + .05) & (al > .5)
right = ndi.binary_closing(right, np.ones((3, 3), bool))
emit[..., 0] = left * 255; emit[..., 1] = right * 255
Image.fromarray(emit).save('public/layers/masks/room_emit.png', optimize=True)
print('left px', int(left.sum()), 'right px', int(right.sum()))
