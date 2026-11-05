# Put every mask on one canvas with the wearer's eyes at the same two points (scale + rotate + move)
import sys, json, math, os
from PIL import Image
A = json.load(open(sys.argv[1])); src, dst = sys.argv[2], sys.argv[3]
C, IPD, EY = 768, 147, 343
EL, ER = (C / 2 - IPD / 2, EY), (C / 2 + IPD / 2, EY)
for n, (l, r, kind) in A.items():
    im = Image.open(f'{src}/{n}.png')
    dx, dy = r[0] - l[0], r[1] - l[1]
    s = IPD / math.hypot(dx, dy); ang = math.atan2(dy, dx)
    # inverse map: output point → source point
    ca, sa = math.cos(ang) / s, math.sin(ang) / s
    a, b = ca, -sa; d, e = sa, ca
    c = l[0] - (a * EL[0] + b * EL[1]); f = l[1] - (d * EL[0] + e * EL[1])
    out = im.transform((C, C), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC)
    out.save(f'{dst}/{n}.png', optimize=True)
    print(f'{n:40s} {kind:10s} {os.path.getsize(dst + "/" + n + ".png") // 1024}KB')
