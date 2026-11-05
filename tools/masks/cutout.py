# Remove a white studio background from a mask image.
# 1) background = near-white pixels connected to the image border (so white inside the mask is kept)
# 2) soft drop shadows next to that region are added if they are pale and grey
# 3) a 1-2 px soft edge, with the white fringe taken back out of the edge colours
import sys, os, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def cut(path):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(np.float32)
    mn, mx = a.min(2), a.max(2); sat = mx - mn
    strict = (mn > 232) & (sat < 22)
    lab, _ = ndimage.label(strict)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); border = border[border > 0]
    bg = np.isin(lab, border)
    # pale grey shadow touching the background, grown a few steps
    soft = (mn > 196) & (sat < 16)
    for _ in range(40):
        grow = ndimage.binary_dilation(bg) & soft & ~bg
        if not grow.any(): break
        bg |= grow
    fg = ~bg
    fg = ndimage.binary_opening(fg, iterations=1)
    lab2, n = ndimage.label(fg)                     # keep the mask itself, drop specks
    if n > 1:
        sizes = ndimage.sum(fg, lab2, range(1, n + 1)); keep = sizes >= max(400, sizes.max() * 0.002)
        fg = np.isin(lab2, np.nonzero(keep)[0] + 1)
    fg = ndimage.binary_fill_holes(fg) | (fg)        # nothing inside the mask becomes see-through
    alpha = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255
    alpha[~ndimage.binary_dilation(fg, iterations=2)] = 0
    alpha[ndimage.binary_erosion(fg, iterations=2)] = 1
    # un-mix the white background from partly transparent edge pixels
    al = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.clip((a - (1 - al) * 255) / al, 0, 255)
    rgb = np.where(alpha[..., None] > 0.98, a, rgb)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

src, dst = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(src)):
    name = f.replace('.png4.jpg', '.png')
    cut(os.path.join(src, f)).save(os.path.join(dst, name))
    print('cut', name)
