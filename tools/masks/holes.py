# Make the openings of hoods and menpo see-through: enclosed pure-white areas (the studio white showing through)
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
path, minsize = sys.argv[1], int(sys.argv[2])
a = np.asarray(Image.open(path)).astype(np.float32)
rgb, al = a[..., :3], a[..., 3]
mn = rgb.min(2); sat = rgb.max(2) - mn
white = (mn > 228) & (sat < 18) & (al > 200)
lab, k = ndimage.label(white)
sizes = ndimage.sum(white, lab, range(1, k + 1))
hole = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= minsize])
hole = ndimage.binary_dilation(hole, iterations=2) & (mn > 200)   # take the pale rim of the opening too
soft = np.asarray(Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
al2 = al * (1 - soft)
w = soft[..., None]
rgb2 = np.clip((rgb - w * 255) / np.clip(1 - w, 1e-3, 1), 0, 255)   # remove white from the rim
rgb2 = np.where(w > 0.02, rgb2, rgb)
Image.fromarray(np.dstack([rgb2, al2]).astype(np.uint8), 'RGBA').save(path)
print(path.split('/')[-1], 'holes made:', int((sizes >= minsize).sum()))
