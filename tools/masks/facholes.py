# Full masks: make the pure-white openings at the eyes and mouth see-through (the studio white seen through the holes).
# Only looks near the eyes and the mouth of the aligned canvas, so a white-painted face is left alone.
import sys, json, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src, dst, names = sys.argv[1], sys.argv[2], sys.argv[3:]
C, EL, ER, IPD = 768, (310.5, 343), (457.5, 343), 147
yy, xx = np.mgrid[0:C, 0:C]
zone = ((xx - EL[0]) ** 2 + (yy - EL[1]) ** 2 < (0.6 * IPD) ** 2) | ((xx - ER[0]) ** 2 + (yy - ER[1]) ** 2 < (0.6 * IPD) ** 2)
zone |= (abs(xx - 384) < 0.95 * IPD) & (yy > EL[1] + 0.75 * IPD) & (yy < EL[1] + 2.1 * IPD)
for n in names:
    a = np.asarray(Image.open(f'{src}/{n}.png')).astype(np.float32); rgb, al = a[..., :3], a[..., 3]
    mn = rgb.min(2); sat = rgb.max(2) - mn
    white = (mn > 232) & (sat < 22) & (al > 200)
    lab, k = ndimage.label(white)
    hole = np.zeros_like(white)
    for i in range(1, k + 1):
        r = lab == i
        if r.sum() < 25 or (r & zone).sum() <= 0.8 * r.sum(): continue
        # an opening is ringed by a dark or coloured outline; a highlight fades into the light surface around it
        ring = ndimage.binary_dilation(r, iterations=4) & ~ndimage.binary_dilation(r, iterations=1)
        if mn[ring].mean() < float(sys.argv[0:1] and 185): hole |= r
    hole = ndimage.binary_dilation(hole, iterations=2) & (mn > 190) & (sat < 40)
    soft = np.asarray(Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))).astype(np.float32) / 255
    w = soft[..., None]
    rgb2 = np.where(w > 0.02, np.clip((rgb - w * 255) / np.clip(1 - w, 1e-3, 1), 0, 255), rgb)
    Image.fromarray(np.dstack([rgb2, al * (1 - soft)]).astype(np.uint8), 'RGBA').save(f'{dst}/{n}.png')
    print(f'{n:40s} opened {int(hole.sum())} px')
