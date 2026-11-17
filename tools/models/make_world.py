"""
影の世界観の素材を、描き方で使える形にする (docs/注文書_影の世界観.md)。

  背景 shadow_bg_*.png   → 灰色だけ・幅900 に縮める（背景は白黒の絵なので、色は持たない）
  舞う物 shadow_fx_flakes / shreds → 1つずつ切り出して1枚に並べる（位置は同じ名前の .json）。墨＝透明度の黒
  風の筋 shadow_fx_wind  → 墨＝透明度の黒、幅1024
  重い煙 shadow_fx_smoke_heavy_* → 墨＝透明度の黒、縁を薄く、幅512
  筆の質感 shadow_fx_paint_* → 灰色だけ・1024（体の濃淡に重ねる、繰り返しの模様）
元の画像は、上書きする前に外の置き場（引数の2つ目）へ写す（まだ加工していない物だけ）。

使い方:
  python tools/models/make_world.py assets/images/shadow ../_downloads/world_originals
"""
import sys, os, json, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from make_brushes import ink, crop, save

def atlas(al, out_png, out_json, keep=40, minpx=80, big=150):
    lab, n = ndimage.label(al > 0.12)
    boxes = ndimage.find_objects(lab)
    sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
    order = [i for i in np.argsort(-sizes) if sizes[i] > minpx][:keep]
    sprites = []
    for i in order:
        sl = boxes[i]; y0, y1, x0, x1 = max(0, sl[0].start - 6), sl[0].stop + 6, max(0, sl[1].start - 6), sl[1].stop + 6
        mask = ndimage.binary_dilation(lab == i + 1, iterations=6)[y0:y1, x0:x1]
        sprites.append(al[y0:y1, x0:x1] * mask)
    k = big / max(max(s.shape) for s in sprites)
    imgs = [Image.fromarray((s * 255).astype(np.uint8), "L").resize((max(2, round(s.shape[1] * k)), max(2, round(s.shape[0] * k))), Image.LANCZOS) for s in sprites]
    W, x, y, row, rects = 1024, 0, 0, 0, []
    for im in imgs:
        if x + im.width > W: x, y, row = 0, y + row + 2, 0
        rects.append([x, y, im.width, im.height]); x += im.width + 2; row = max(row, im.height)
    sheet = Image.new("L", (W, y + row), 0)
    for im, r in zip(imgs, rects): sheet.paste(im, (r[0], r[1]))
    Image.merge("RGBA", [Image.new("L", sheet.size, 0)] * 3 + [sheet]).save(out_png, optimize=True)
    json.dump({"sprites": rects}, open(out_json, "w", encoding="utf8"))
    return [sheet.size, len(rects)]

def fade_edges(al, frac=0.12):
    h, w = al.shape; yy, xx = np.mgrid[0:h, 0:w]
    e = np.minimum(np.minimum(yy, h - 1 - yy) / (frac * h), np.minimum(xx, w - 1 - xx) / (frac * w))
    return al * np.clip(e, 0, 1) ** 1.5

def main(src, keep):
    os.makedirs(keep, exist_ok=True)
    files = sorted(f for f in os.listdir(src) if (f.startswith("shadow_bg_") or f.startswith("shadow_fx_")) and f.endswith(".png"))
    for f in files:
        im = Image.open(os.path.join(src, f))
        done = im.mode in ("L", "RGBA") and os.path.exists(os.path.join(keep, f))
        if not done: shutil.copy2(os.path.join(src, f), os.path.join(keep, f))
    for f in files:
        p, orig = os.path.join(src, f), os.path.join(keep, f)
        if f.startswith("shadow_bg_"):
            im = Image.open(orig).convert("L"); im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS); im.save(p, optimize=True)
            r = im.size
        elif "flakes" in f or "shreds" in f:
            r = atlas(ink(orig, white=0.92, black=0.3), p, p[:-4] + ".json", keep=40 if "flakes" in f else 36)
        elif "wind" in f:
            r = save(crop(fade_edges(ink(orig, white=0.95, black=0.35), 0.08)), p, 1024)
        elif "smoke_heavy" in f:
            r = save(crop(fade_edges(ink(orig, white=0.93, black=0.12), 0.1)), p, 512)
        elif "paint" in f:
            im = Image.open(orig).convert("L").resize((512, 512), Image.LANCZOS); im.save(p, optimize=True); r = im.size
        else:
            continue
        print(f, r, os.path.getsize(p) // 1024, "KB")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
