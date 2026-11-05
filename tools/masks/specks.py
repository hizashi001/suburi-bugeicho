# keep the mask body: drop small pieces cut off from it
import sys, glob, numpy as np
from PIL import Image
from scipy import ndimage
for p in sorted(glob.glob(sys.argv[1] + '/*.png')):
    a = np.asarray(Image.open(p)).copy(); on = a[..., 3] > 8
    lab, n = ndimage.label(on)
    if n <= 1: continue
    sizes = ndimage.sum(on, lab, range(1, n + 1)); keep = np.nonzero(sizes >= sizes.max() * 0.01)[0] + 1
    drop = on & ~np.isin(lab, keep)
    if drop.any(): a[drop, 3] = 0; Image.fromarray(a, 'RGBA').save(p); print(p.split('/')[-1], 'specks removed', int(drop.sum()))
