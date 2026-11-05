# 鳥居の素材（灰色背景の1枚絵）を、ゲームで使う透過PNGにする。
# - 元画像は約9px四方で1ドット。各ドットの中央3x3の中央値で1pxに戻す
# - 灰色の背景と、柱の間に写り込んだ半透明の「幽霊」（生成時の写り込み）を消す
#   灰色からの色の離れ具合で残す部分を決め、外側からつながる灰色を透明にする。柱の内側の下段は四角く抜く
import os, numpy as np
from PIL import Image
from scipy import ndimage
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
SRC, OUT, B, PH = 'art/bg2/torii_src.jpg', 'page/torii.png', 9, 7
a = np.asarray(Image.open(R + SRC).convert('RGB')).astype(np.int16)
a = a[PH:, PH:]
H, W = a.shape[0] // B, a.shape[1] // B
blk = a[:H * B, :W * B].reshape(H, B, W, B, 3)[:, 3:6, :, 3:6, :]
n = np.median(blk.transpose(0, 2, 1, 3, 4).reshape(H, W, 9, 3), axis=2).astype(np.int16)
bg = np.median(np.concatenate([n[:4].reshape(-1, 3), n[-4:].reshape(-1, 3)]), axis=0)
dist = np.abs(n - bg).sum(2)
sat = n.max(2) - n.min(2)
keep = (dist > 60) | (sat > 45)
# the ghost between the pillars: everything inside the gate below the lower beam that is not moss is cleared
lab, k = ndimage.label(keep)
sizes = ndimage.sum(keep, lab, range(1, k + 1))
main = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 40])
cols = np.where(main.any(0))[0]; rows = np.where(main.any(1))[0]
x0, x1, y0, y1 = cols.min(), cols.max() + 1, rows.min(), rows.max() + 1
# pillars: the two widest red columns in the lower half
low = main[y0 + (y1 - y0) * 3 // 5: y1 - (y1 - y0) // 8, x0:x1]
fill = low.mean(0)
pill = np.where(fill > 0.8)[0] + x0
left = pill[pill < (x0 + x1) / 2]; right = pill[pill > (x0 + x1) / 2]
inner_l, inner_r = left.max() + 1, right.min()
# lower beam: the last row (from the top) where the span between the pillars is mostly filled
span = main[:, inner_l:inner_r].mean(1)
beam_rows = np.where(span[:y0 + (y1 - y0) * 11 // 20] > 0.6)[0]   # only the upper part: the moss line at the foot also spans the gate
beam_bot = beam_rows.max() + 1
green = (n[..., 1] > n[..., 0] + 12) & (n[..., 1] > n[..., 2])
inside = np.zeros_like(main); inside[beam_bot:y1 - 4, inner_l:inner_r] = True
main[inside & ~green] = False
# hanging moss inside the gate that no longer touches the beam goes too
lab2, k2 = ndimage.label(main)
top_lab = set(np.unique(lab2[:beam_bot])) - {0}
for i in range(1, k2 + 1):
    if i not in top_lab and (lab2 == i).sum() < 200: main[lab2 == i] = False
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = n.clip(0, 255); rgba[..., 3] = np.where(main, 255, 0)
rgba = rgba[y0:y1, x0:x1]
Image.fromarray(rgba).save(R + OUT, optimize=True)
print('torii', rgba.shape[1], 'x', rgba.shape[0], 'pillars inner', inner_l - x0, inner_r - x0, 'beam bottom', beam_bot - y0)
