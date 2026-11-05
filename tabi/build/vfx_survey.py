# 届いたVFX（art/incoming/vfx*/、送られた順は build/vfx_order.txt）に V001〜 の番号を振り、
# 動きの統計（build/vfx_stats.json）と確認用の一覧画像を作る
from PIL import Image, ImageSequence, ImageDraw
import numpy as np, json, colorsys, os, sys
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
OUT = sys.argv[1] if len(sys.argv) > 1 else R + 'build/'
order = []
for line in open(R + 'build/vfx_order.txt'):
    p = line.split(); order += [p[0] + '/' + h + '-image.gif' for h in p[1:]]
def load(f):
    out = []
    for x in ImageSequence.Iterator(Image.open(R + 'art/incoming/' + f)):
        a = x.convert('RGBA')
        if a.getpixel((0, 0))[3] == 0:   # a transparent sheet (the ink): draw it on light gray so black shows
            bg = Image.new('RGBA', a.size, (150, 150, 150, 255)); bg.alpha_composite(a); a = bg
        out.append(np.asarray(a.convert('RGB')).astype(np.float32))
    return out
cat = []; tiles = []
for i, f in enumerate(order, 1):
    fr = load(f); dur = [x.info.get('duration', 100) for x in ImageSequence.Iterator(Image.open(R + 'art/incoming/' + f))]
    st = np.stack(fr); bg = st[0, 0, 0]
    lum = np.abs(st - bg).max(3)
    m = lum.max(0) > 24
    if not m.any(): m = lum.max(0) > 4
    ys, xs = np.where(m); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    area = [int((l > 24).sum()) for l in lum]; pk = int(np.argmax(area))
    cen = []
    for l in lum:
        yy, xx = np.where(l > 24); cen.append((float(xx.mean()), float(yy.mean())) if len(xx) else None)
    c0 = next((c for c in cen if c), None); c1 = next((c for c in reversed(cen) if c), None)
    un = st.max(0); px = un[m]; w = lum.max(0)[m]; col = (px * w[:, None]).sum(0) / w.sum()
    h, s, v = colorsys.rgb_to_hsv(*(col / 255))
    cat.append(dict(id='V%03d' % i, file=f, frames=len(fr), ms=int(np.mean(dur)), bbox=[int(x0), int(y0), int(x1), int(y1)], peak=pk, area=max(area),
                    move=[round(c1[0] - c0[0]), round(c1[1] - c0[1])] if c0 else [0, 0], rgb=[int(c) for c in col], hue=round(h * 360), sat=round(float(s), 2)))
    tiles.append((fr, (x0, y0, x1, y1)))
json.dump(cat, open(R + 'build/vfx_stats.json', 'w'), ensure_ascii=False, indent=0)
def thumb(a, box, W, H):
    x0, y0, x1, y1 = box; pad = 4; x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(a.shape[1], x1 + pad); y1 = min(a.shape[0], y1 + pad)
    im = Image.fromarray(np.clip(a[y0:y1, x0:x1], 0, 255).astype(np.uint8)); im.thumbnail((W, H), Image.BILINEAR); return im
TW, TH, per = 330, 120, 72
for s in range(0, len(order), per):
    sub = list(range(s, min(s + per, len(order)))); cols = 6; rows = (len(sub) + cols - 1) // cols
    sh = Image.new('RGB', (cols * TW, rows * TH), (28, 28, 40)); d = ImageDraw.Draw(sh)
    for k, i in enumerate(sub):
        fr, box = tiles[i]; ox = (k % cols) * TW; oy = (k // cols) * TH; n = len(fr)
        sh.paste(thumb(np.stack(fr).max(0), box, 150, 100), (ox + 2, oy + 18))
        for j, fi in enumerate([n // 6, n // 3, n // 2, 2 * n // 3, 5 * n // 6, n - 1]):
            sh.paste(thumb(fr[fi], box, 56, 48), (ox + 156 + (j % 3) * 58, oy + 18 + (j // 3) * 50))
        d.text((ox + 3, oy + 3), 'V%03d  %df' % (i + 1, n), fill=(255, 230, 120)); d.rectangle([ox, oy, ox + TW - 1, oy + TH - 1], outline=(70, 70, 100))
    sh.save(OUT + 'vfx_sheet_%d.png' % (s // per + 1)); print(sh.size)
