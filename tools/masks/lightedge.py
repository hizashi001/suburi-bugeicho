# Clear pale pixels that are reached from the outside (smoke wisps, background seen between folds)
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
path, thr = sys.argv[1], int(sys.argv[2])
a = np.asarray(Image.open(path)).astype(np.float32)
rgb, al = a[..., :3], a[..., 3]
mn = rgb.min(2); sat = rgb.max(2) - mn
pale = (mn > thr) & (sat < 26)
out = al < 20
for _ in range(400):
    g = ndimage.binary_dilation(out) & pale & ~out
    if not g.any(): break
    out |= g
# pale pockets fully enclosed by the cloth but large and flat (background behind a gap)
lab, k = ndimage.label(pale & ~out)
for i in range(1, k + 1):
    r = lab == i
    if r.sum() > 250 and rgb[r].std() < 6 and mn[r].mean() > 240: out |= r
soft = np.asarray(Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
al2 = np.where(out, 0, al * (1 - soft))
Image.fromarray(np.dstack([rgb, al2]).astype(np.uint8), 'RGBA').save(path)
print(path.split('/')[-1], 'cleared', int(out.sum() - (al < 20).sum()), 'px')
