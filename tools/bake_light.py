# Запечённый свет ламп (подход rainroom: комната = OFF + I·(ON−OFF)). Для каждой лампы — аддитивная тёплая карта
# public/layers/masks/lit_left.png, lit_right.png: диффуз по псевдонормалям, общая тёплая засветка, блики,
# ручные маски бликов на предметах подоконника (ноутбук, кружка, радио, шкатулка, книги), тёплое пятно и отражения на подоконнике.
# Запуск: .venv/bin/python tools/bake_light.py [--preview]
import sys; from PIL import Image; import numpy as np; from scipy import ndimage as ndi
a = np.asarray(Image.open('public/layers/room.png')).astype(np.float32) / 255
rgb, al = a[..., :3], a[..., 3]; H, W = al.shape; solid = (al > .5).astype(np.float32)
lum = rgb @ np.array([.299, .587, .114], np.float32)
hgt = ndi.gaussian_filter(lum, 1.2) * solid
gx, gy = ndi.sobel(hgt, 1), ndi.sobel(hgt, 0)
n = np.dstack([-gx * 3, -gy * 3, np.ones_like(hgt)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
edge = np.hypot(ndi.sobel(lum, 1), ndi.sobel(lum, 0))
mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / (mx + 1e-4)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
# предметы на подоконнике и полке (x0, y0, x1, y1, сила блика)
OBJ = {'laptop': (340, 620, 605, 818, 1.0), 'mug': (628, 714, 722, 808, 1.3), 'radio': (1219, 640, 1468, 801, 1.1),
       'box': (1479, 727, 1613, 801, .9), 'books': (188, 751, 335, 817, .7), 'camera': (120, 540, 182, 600, 1.0)}
objm = np.zeros((H, W), np.float32)
for x0, y0, x1, y1, k in OBJ.values(): objm[y0:y1, x0:x1] = np.maximum(objm[y0:y1, x0:x1], k)
sill = (np.clip((yy - 781) / 10, 0, 1) * np.clip((848 - yy) / 6, 0, 1) * ((xx >= 50) & (xx <= 1640))).astype(np.float32) * solid * (objm == 0)
LAMPS = {'left': dict(pos=(194, 576), z=40, R=380, C=np.array([1.0, .70, .40])),
         'right': dict(pos=(1632, 350), seg=(275, 426), z=30, R=480, C=np.array([1.0, .62, .28]))}
def bake(L, gain):
    lx, ly = L['pos']; py = np.clip(yy, *L['seg']) if 'seg' in L else np.full_like(yy, ly)
    dx, dy = lx - xx, py - yy; d = np.hypot(dx, dy) + 1e-3
    l = np.dstack([dx, dy, np.full_like(dx, L['z'])]); l /= np.linalg.norm(l, axis=2, keepdims=True)
    ndl = np.clip((n * l).sum(-1), 0, 1)
    att = 1 / (1 + (d / L['R']) ** 2 * 3); far = 1 / (1 + (d / (L['R'] * 2.2)) ** 2)
    C = L['C']; alb = rgb + .04
    diff = alb * C * (att * (.3 + .7 * ndl) * 2.6)[..., None] + C * (att * (.3 + .7 * ndl) * .05)[..., None]
    fill = (alb * .8 + .035) * (C * C) * far[..., None]                       # общая тёплая засветка комнаты
    hv = l + np.array([0, 0, 1.]); hv /= np.linalg.norm(hv, axis=2, keepdims=True)
    gloss = np.clip((lum - .1) * 2.5, 0, 1) * np.clip(1.2 - sat * 1.4, 0, 1) * .5 + np.clip(edge * 2, 0, .5)
    spec = C * (np.clip((n * hv).sum(-1), 0, 1) ** 24 * gloss * att * .9)[..., None]
    # блики на предметах: грани, повёрнутые к лампе (2D-направление градиента), сильнее на ярких кромках
    g2 = np.dstack([-gx, -gy]); g2n = g2 / (np.linalg.norm(g2, axis=2, keepdims=True) + 1e-4)
    toward = np.clip((g2n[..., 0] * dx + g2n[..., 1] * dy) / d, 0, 1)
    rim = np.clip(edge * 4, 0, 1) * toward ** 1.5 * objm * far * (.45 + lum)
    rimc = C * (rim * 1.1)[..., None]
    # тёплое пятно и отражения на подоконнике: сильнее там, где в арте уже нарисованы блики (они «теплеют»)
    pool = sill * np.exp(-((xx - lx) / (L['R'] * 1.1)) ** 2) * (.12 + 3.0 * np.clip(lum - .1, 0, 1)) * far
    poolc = (C * C) * (pool * 1.5)[..., None]
    out = (diff + fill + spec + rimc + poolc) * gain * solid[..., None]
    return np.clip(out, 0, 1)
res = {}
for id, gain in (('left', 1.0), ('right', 1.5)):
    o = np.floor(bake(LAMPS[id], gain) * 48 + .5) / 48           # пиксельные ступени
    res[id] = o; Image.fromarray((o * 255).astype(np.uint8)).save(f'public/layers/masks/lit_{id}.png', optimize=True)
    print(id, 'mean add', float(o[al > .5].mean()))
if '--preview' in sys.argv:
    bg = np.zeros((H, W, 3), np.float32) + np.array([.02, .03, .06])
    for name, k in (('off', (0, 0)), ('both', (1, 1))):
        c = np.clip(rgb + res['left'] * k[0] + res['right'] * k[1], 0, 1); comp = c * al[..., None] + bg * (1 - al[..., None])
        Image.fromarray((comp * 255).astype(np.uint8)).save(f'/tmp/bake_{name}.png')
