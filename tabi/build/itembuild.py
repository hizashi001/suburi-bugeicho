# 報酬アイテムの絵（透過PNG、250x250、1ドット約8px）を、ゲームで使う等倍ドット（page/items.png, page/items.json）にする。
# - マスごとにドットの大きさと位相を測り、各ドットの中央の色で1pxに戻す
import os, json, numpy as np
from PIL import Image
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
SRC = [('g_blade', '94dfc636'), ('g_tsuba', '24c14c78'), ('g_saya', '098874c6'), ('g_tsuka', '08d2d4dd'), ('g_kabuto', '083a0f35'), ('g_kote', 'b9c5545a'),
       ('g_do', '998ad467'), ('g_sune', 'a2417b04'), ('tama', '88feef70'), ('koban', 'be93a274'), ('zeni', '67d3cc1c'), ('maki', 'f45b6497')]
def block(a):
    # the dot size and phase: where the colour changes along rows and columns
    L = a[..., :3].astype(float).mean(2) * (a[..., 3] > 0)
    best = None
    for B in (7,):   # every picture of this set uses 7px dots (wider searches picked multiples on some)
        for ax in (0, 1):
            d = np.abs(np.diff(L, axis=1 - ax)).sum(ax)
            s = [d[i::B].sum() for i in range(B)]; r = max(s) / (np.mean(s) + 1e-6)
            if best is None or r > best[0]: best = (r, B)
    B = best[1]
    ph = []
    for ax in (0, 1):
        d = np.abs(np.diff(L, axis=1 - ax)).sum(ax); s = [d[i::B].sum() for i in range(B)]; ph.append((int(np.argmax(s)) + 1) % B)
    return B, ph[0], ph[1]
tiles = {}
for name, h in SRC:
    a = np.asarray(Image.open(R + 'art/items_t/' + h + '-image.png').convert('RGBA'))
    B, px_, py_ = block(a)
    c = a[py_:, px_:]; hh, ww = c.shape[0] // B, c.shape[1] // B
    mid = B // 2
    n = c[mid:hh * B:B, mid:ww * B:B][:hh, :ww].copy()
    n[..., 3] = np.where(n[..., 3] > 128, 255, 0)
    ys, xs = np.where(n[..., 3] > 0)
    tiles[name] = n[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    print(name, 'dot', B, '->', tiles[name].shape[1], 'x', tiles[name].shape[0])
x = 0; meta = {}; H = max(t.shape[0] for t in tiles.values())
sheet = np.zeros((H, sum(t.shape[1] + 1 for t in tiles.values()), 4), np.uint8)
for name, t in tiles.items():
    sheet[:t.shape[0], x:x + t.shape[1]] = t; meta[name] = [x, 0, t.shape[1], t.shape[0]]; x += t.shape[1] + 1
Image.fromarray(sheet).save(R + 'page/items.png', optimize=True)
json.dump(meta, open(R + 'page/items.json', 'w'), separators=(',', ':'))
