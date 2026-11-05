# gold oni: clear the cream halo (pale, weakly saturated) reached from outside; gold itself is strongly saturated
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
p = sys.argv[1]
a = np.asarray(Image.open(p)).astype(np.float32); rgb, al = a[..., :3], a[..., 3]
mn = rgb.min(2); sat = rgb.max(2) - mn
pale = (mn > 175) & (sat < 70)
out = al < 20
for _ in range(80):
    g = ndimage.binary_dilation(out) & pale & ~out
    if not g.any(): break
    out |= g
soft = np.asarray(Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
Image.fromarray(np.dstack([rgb, np.where(out, 0, al * (1 - soft))]).astype(np.uint8), 'RGBA').save(p)
print('halo cleared', int(out.sum() - (al < 20).sum()))
