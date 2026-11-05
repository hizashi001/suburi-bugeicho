# 256-colour palette with alpha (like TinyPNG). Usage: quant.py src dst [maxside]
import sys, os, glob, imagequant
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; maxside = int(sys.argv[3]) if len(sys.argv) > 3 else 0
os.makedirs(dst, exist_ok=True)
tot0 = tot1 = 0
for p in sorted(glob.glob(src + '/*.png')):
    im = Image.open(p)
    if maxside and max(im.size) > maxside:
        s = maxside / max(im.size); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    q = imagequant.quantize_pil_image(im.convert('RGBA'), dithering_level=1.0, max_colors=256, min_quality=60, max_quality=int(os.environ.get("QMAX", "95")))
    out = os.path.join(dst, os.path.basename(p)); q.save(out, optimize=True)
    tot0 += os.path.getsize(p); tot1 += os.path.getsize(out)
    print(f'{os.path.basename(p):40s} {im.size[0]}x{im.size[1]} {os.path.getsize(p)//1024}KB -> {os.path.getsize(out)//1024}KB')
print(f'TOTAL {tot0//1024}KB -> {tot1//1024}KB')
