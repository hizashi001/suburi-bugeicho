# for each file keep the smaller of: compressed version, or the original when it is already within the size limit
import sys, os, glob, shutil
from PIL import Image
orig, comp, dst, maxside = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]); os.makedirs(dst, exist_ok=True); tot = 0
for c in sorted(glob.glob(comp + '/*.png')):
    n = os.path.basename(c); o = os.path.join(orig, n)
    use = o if (max(Image.open(o).size) <= maxside and os.path.getsize(o) <= os.path.getsize(c)) else c
    shutil.copy(use, os.path.join(dst, n)); tot += os.path.getsize(use)
    print(f'{n:42s} {"original" if use == o else "compressed"} {os.path.getsize(use)//1024}KB')
print('TOTAL', tot // 1024, 'KB')
