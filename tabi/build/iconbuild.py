# アイコン（250x250、枠つき）を、画面で使う大きさ（112x112）にしてpage/icons/へ置く。
import os, glob
from PIL import Image
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
os.makedirs(R + 'page/icons', exist_ok=True)
for f in sorted(glob.glob(R + 'art/icons/*.png')):
    im = Image.open(f).convert('RGB').resize((112, 112), Image.LANCZOS)
    im.save(R + 'page/icons/' + os.path.basename(f), optimize=True)
    print(os.path.basename(f))
