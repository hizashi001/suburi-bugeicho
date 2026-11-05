import sys, json, numpy as np
from PIL import Image
A = json.load(open(sys.argv[1])); res = {}
for n, (l, r, kind) in A.items():
    al = np.asarray(Image.open(f'{sys.argv[2]}/{n}.png'))[..., 3] > 8
    ys, xs = np.nonzero(al); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    if kind == 'half':     # no eyes on a half mask: estimate them from its width and the top of the nose
        ipd = (x1 - x0) / 2.5; cx = (x0 + x1) / 2
        col = al[:, int(cx) - 3:int(cx) + 4].any(1); top = np.nonzero(col)[0].min()
        ey = top - 0.35 * ipd; l, r = [cx - ipd / 2, ey], [cx + ipd / 2, ey]; A[n][0], A[n][1] = l, r
    ipd = r[0] - l[0]; cx = (l[0] + r[0]) / 2; ey = (l[1] + r[1]) / 2
    res[n] = dict(up=(ey - y0) / ipd, down=(y1 - ey) / ipd, side=max(cx - x0, x1 - cx) / ipd)
for k in ('up', 'down', 'side'):
    m = max(res, key=lambda n: res[n][k]); print(k, round(res[m][k], 2), m)
json.dump(A, open(sys.argv[1], 'w'), indent=1)
