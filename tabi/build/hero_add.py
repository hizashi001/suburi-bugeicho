# 既存の hero.png / heroM.json に、新しい影の動き（GIF）を書き足す。全体を作り直さずに済む。
# 使い方: python3 hero_add.py   （build/ フォルダで実行。page/ の hero.png, hero.json, heroM.json を上書き）
# GIFの1コマ目は開始画像（足元の影つき）なので使わず、2〜5コマ目をループに使う。
import os, json, numpy as np, cv2
from PIL import Image, ImageSequence
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
P = R + 'page/'
S = 0.79                       # hero_build.py と同じ縮小率
NAX, NAY = 117.5, 207          # 中段の開始画像（kage_chudan_250.png）の基準点。既存の c/d 系と同じ
ADD = [('b01', 'art/hero_new/b01_breath.gif'), ('b02', 'art/hero_new/b02_suriashi.gif'), ('b03', 'art/hero_new/b03_kuchu_aligned.gif'), ('r01', 'art/hero_new/r01_run.gif')]

def scale_frame(f, s, ax, ay):
    H, W = f.shape[:2]; a = f[..., 3:4] / 255.0
    pre = np.dstack([f[..., :3] * a, a[..., 0]]).astype(np.float32)
    M = np.array([[s, 0, (1 - s) * ax], [0, s, (1 - s) * ay]], np.float32)
    r = cv2.warpAffine(pre, M, (W, H), flags=cv2.INTER_AREA)
    al = r[..., 3]; col = r[..., :3] / np.maximum(al[..., None], 1e-4)
    pal = np.unique(f[f[..., 3] > 0][:, :3], axis=0).astype(np.float32)
    keep = al > 0.5; px = col[keep]; o = np.zeros_like(f)
    if len(px):
        best = np.empty(len(px), int)
        for i in range(0, len(px), 4000):
            d = ((px[i:i + 4000, None, :] - pal[None]) ** 2).sum(-1); best[i:i + 4000] = d.argmin(1)
        o[keep, :3] = pal[best].astype(np.uint8); o[keep, 3] = 255
    return o

def mouth(fr, tile):
    a = tile[..., 3] > 0
    t = np.where(a.any(1))[0].min()
    top = np.where(a[t:t + 8].any(0))[0]; hc = (top.min() + top.max()) / 2
    cols = np.where(a[t + 9:t + 17].any(0))[0]; near = cols[(cols >= hc - 14) & (cols <= hc + 16)]
    fr['mx'] = int(fr['ox'] + (near.max() if len(near) else hc + 6)); fr['my'] = int(fr['oy'] + t + 13)

sheet = np.asarray(Image.open(P + 'hero.png').convert('RGBA'))
meta = json.load(open(P + 'heroM.json'))
for k, _ in ADD: meta.pop(k, None)
# drop rows that an earlier run of this script appended (everything below the original atlas)
base_h = min(sheet.shape[0], max(f["y"] + f["h"] for v in meta.values() for f in v))
sheet = sheet[:base_h]
tiles = []
for key, fn in ADD:
    fr = [np.asarray(f.convert('RGBA')).copy() for f in ImageSequence.Iterator(Image.open(R + fn))][1:]
    lst = []
    for f in fr:
        sf = scale_frame(f, S, NAX, NAY); al = sf[..., 3] > 0
        ys = np.where(al.any(1))[0]; xs = np.where(al.any(0))[0]
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        t = sf[y0:y1, x0:x1]; tiles.append(t)
        lst.append({'ox': int(round(x0 - NAX)), 'oy': int(round(y0 - NAY)), '_t': len(tiles) - 1})
    meta[key] = lst
SW = sheet.shape[1]; x = 0; y = base_h + 1; rowh = 0; pos = []
for t in tiles:
    h, w = t.shape[:2]
    if x + w > SW: x = 0; y += rowh + 1; rowh = 0
    pos.append((x, y)); x += w + 1; rowh = max(rowh, h)
out = np.zeros((y + rowh, SW, 4), np.uint8); out[:base_h] = sheet
for (px_, py), t in zip(pos, tiles): out[py:py + t.shape[0], px_:px_ + t.shape[1]] = t
for key, _ in ADD:
    for fr in meta[key]:
        i = fr.pop('_t'); t = tiles[i]
        fr.update({'x': pos[i][0], 'y': pos[i][1], 'w': t.shape[1], 'h': t.shape[0]}); mouth(fr, t)
Image.fromarray(out).save(P + 'hero.png', optimize=True)
plain = {k: [{kk: vv for kk, vv in f.items() if kk not in ('mx', 'my')} for f in v] for k, v in meta.items()}
json.dump(plain, open(P + 'hero.json', 'w'), separators=(',', ':'))
json.dump(meta, open(P + 'heroM.json', 'w'), separators=(',', ':'))
print('hero.png', out.shape, {k: len(meta[k]) for k, _ in ADD}, [meta['b01'][0], meta['b02'][0]])
