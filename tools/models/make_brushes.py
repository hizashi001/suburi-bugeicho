"""
筆の素材を、影の描き方で使える形にする (docs/注文書_筆の素材.md, docs/設計_影の3D.md 第3D-3.0段)。

AIで作った「白い背景に黒い墨」の画像から:
  - 墨の濃さを透明度にした、黒だけの PNG（白は透明）にする
  - 墨のある所だけを切り出し、アプリ用に縮める
  - 飛沫は、1粒ずつ切り出して1枚に並べ、位置を JSON に書く
元の画像は、上書きする前に外の置き場（引数の2つ目）へ写す。

使い方:
  python tools/models/make_brushes.py assets/images/shadow ../_downloads/brush_originals
"""
import sys, os, json, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

def ink(path, white=0.9, black=0.25):
    """the ink's darkness as alpha: paper (lighter than `white`) → 0, ink darker than `black` → 1"""
    a = np.asarray(Image.open(path).convert("L"), dtype=np.float32) / 255
    return np.clip((white - a) / (white - black), 0, 1)

def crop(al, pad=8, thr=0.04):
    ys, xs = np.where(al > thr)
    if not len(xs): return al
    return al[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]

def save(al, path, width=None):
    im = Image.fromarray((al * 255).astype(np.uint8), "L")
    if width and im.width > width: im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
    rgba = Image.merge("RGBA", [Image.new("L", im.size, 0)] * 3 + [im])   # black ink, darkness in the alpha
    rgba.save(path, optimize=True)
    return im.size

def main(src, keep):
    os.makedirs(keep, exist_ok=True)
    files = sorted(f for f in os.listdir(src) if f.startswith("shadow_brush_") and f.endswith(".png"))
    for f in files:
        if not os.path.exists(os.path.join(keep, f)): shutil.copy2(os.path.join(src, f), os.path.join(keep, f))
    out = {}
    for f in files:
        p, orig = os.path.join(src, f), os.path.join(keep, f)
        kind = f.split("_")[2]
        if kind == "sweep":
            out[f] = save(crop(ink(orig)), p, 1024)
        elif kind == "dry":
            al = ink(orig, white=0.95, black=0.2)
            out[f] = save(al, p, 1024)                     # the whole picture: used as a repeating texture
        elif kind == "smoke":
            al = ink(orig, white=0.88, black=0.15)
            h, w = al.shape; yy, xx = np.mgrid[0:h, 0:w]
            edge = np.minimum(np.minimum(yy, h - 1 - yy) / (0.12 * h), np.minimum(xx, w - 1 - xx) / (0.12 * w))
            al = al * np.clip(edge, 0, 1) ** 1.5 * 0.85                 # the edges (and the water's surface) fade out
            out[f] = save(crop(al), p, 512)
        elif kind == "splat":
            al = ink(orig)
            lab, n = ndimage.label(al > 0.15)
            boxes = ndimage.find_objects(lab)
            sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
            order = [i for i in np.argsort(-sizes) if sizes[i] > 60][:40]
            sprites = []
            for i in order:
                sl = boxes[i]; y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
                m = al[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4] * (ndimage.binary_dilation(lab == i + 1, iterations=4)[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4])
                sprites.append(m)
            # pack: rows of sprites scaled so the biggest is 160 px
            k = 160 / max(max(s.shape) for s in sprites)
            imgs = [Image.fromarray((s * 255).astype(np.uint8), "L").resize((max(2, round(s.shape[1] * k)), max(2, round(s.shape[0] * k))), Image.LANCZOS) for s in sprites]
            W, x, y, row, rects = 1024, 0, 0, 0, []
            for im in imgs:
                if x + im.width > W: x, y, row = 0, y + row + 2, 0
                rects.append([x, y, im.width, im.height]); x += im.width + 2; row = max(row, im.height)
            sheet = Image.new("L", (W, y + row), 0)
            for im, r in zip(imgs, rects): sheet.paste(im, (r[0], r[1]))
            Image.merge("RGBA", [Image.new("L", sheet.size, 0)] * 3 + [sheet]).save(p, optimize=True)
            with open(os.path.join(src, "shadow_brush_splat_01.json"), "w", encoding="utf8") as fp: json.dump({"sprites": rects}, fp)
            out[f] = [sheet.size, len(rects), "sprites"]
    for f, v in out.items(): print(f, v, os.path.getsize(os.path.join(src, f)) // 1024, "KB")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
