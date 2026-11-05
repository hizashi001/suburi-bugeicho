# 背景の層（AIで作った横長の1枚絵）を、ゲームで使う等倍ドットのPNGにする。
# - 元画像は4px四方で1ドット。各ドットの中央2x2の中央値で1pxに戻す
# - 下の黒い帯（地面の代わり）は切り落とす。画像の下端がゲームの地平線（GY）に来る
# - key=True の層は、ほぼ黒の部分を透明にする（JPGで透明が無いため）
# - 左右がつながるか（横に並べて継ぎ目が出ないか）も数値で出す
import os, numpy as np
from PIL import Image
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
BLOCK = 4
LAYERS = [  # name, source, output, key black
    ('far', 'art/bg/l1_far.jpg', 'page/bg_far.png', False),
    ('mid', 'art/bg/l2_mid.jpg', 'page/bg_mid.png', True),
]
def native(path):
    a = np.asarray(Image.open(R + path).convert('RGB')).astype(np.int16)
    H, W = a.shape[0] // BLOCK, a.shape[1] // BLOCK
    a = a[:H * BLOCK, :W * BLOCK].reshape(H, BLOCK, W, BLOCK, 3)[:, 1:3, :, 1:3, :]
    return np.median(a.reshape(H, 2, W, 2, 3).transpose(0, 2, 1, 3, 4).reshape(H, W, 4, 3), axis=2).astype(np.uint8)
for name, src, out, key in LAYERS:
    n = native(src); H, W = n.shape[:2]
    m = n.max(2)
    # the black band at the bottom: first row from which every row is (almost) black
    dark = m.mean(1) < 12
    band = H
    while band > 0 and dark[band - 1]: band -= 1
    n = n[:band]
    rgba = np.dstack([n, np.full(n.shape[:2], 255, np.uint8)])
    if key:
        mm = n.max(2).astype(int)
        rgba[..., 3] = np.where(mm < 14, 0, 255)
        # lone opaque specks inside transparent areas (JPEG noise) are removed
        a = rgba[..., 3] > 0
        nb = sum(np.roll(np.roll(a, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a
        rgba[..., 3][a & (nb <= 1)] = 0
    Image.fromarray(rgba).save(R + out, optimize=True)
    seam = np.abs(n[:, 0].astype(int) - n[:, -1].astype(int)).mean()
    inner = np.abs(n[:, 0].astype(int) - n[:, 1].astype(int)).mean()
    print(name, 'native', W, 'x', H, '-> kept', band, 'rows; seam diff', round(seam, 1), '(neighbour diff', round(inner, 1), ')', 'top colour', n[:3].reshape(-1, 3).mean(0).round())
