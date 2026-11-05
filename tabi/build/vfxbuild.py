# 届いたVFX（黒背景のGIF、256x144）から、ゲームで使う分だけを1枚のアトラス（page/vfx.png, page/vfx.json）にまとめる。
# - 黒背景は「明るさ＝不透明度」で抜く（色は明るさで割り戻す）。光るものは加算で描くと元のGIFと同じ見た目になる
# - 長いGIFはコマを間引いて最大 MAXF コマにする（1コマの時間 fd は伸ばして、全体の長さは保つ）
# - 各コマは余白を切り詰め、基準点（'c' 全体の中心 / 'b' 全体の下端中央）からのずれ ox, oy を持つ
# - USE の番号（V001〜）は build/vfx_order.txt の送られた順。何に使うかは VFX_CATALOG.md
import os, json, numpy as np
from PIL import Image, ImageSequence
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
MAXF = 12
order = []
for line in open(R + 'build/vfx_order.txt'):
    p = line.split(); order += [p[0] + '/' + h + '-image.gif' for h in p[1:]]
# key: (V番号, 基準, 縮小率, 最大コマ, 開始コマ, 終了コマ)  縮小率は画面いっぱいの大きなものだけ0.5（描くときに2倍する）
USE = {
  # 斬撃（青白い霊気の刃）
  'sl_h': ('V044', 'c', 1, 10, 0, None), 'sl_wide': ('V145', 'c', 1, 10, 0, None), 'sl_cres': ('V042', 'c', 1, 10, 0, None),
  'sl_cres2': ('V061', 'c', 1, 10, 0, None), 'sl_hook': ('V058', 'c', 1, 10, 0, None), 'sl_thin': ('V125', 'c', 1, 8, 0, None),
  'sl_diag': ('V180', 'c', 1, 10, 0, None), 'sl_x': ('V009', 'c', 1, 10, 0, None), 'sl_ring': ('V114', 'c', 1, 10, 0, None),
  'sl_ring2': ('V126', 'c', 1, 10, 0, None), 'sl_swirl': ('V085', 'c', 1, 12, 0, None), 'dash': ('V016', 'c', 1, 10, 0, None),
  'comet': ('V214', 'c', 1, 12, 0, None), 'wind_shot': ('V037', 'c', 1, 10, 0, None), 'sl_red': ('V066', 'c', 1, 10, 0, None),
  'sl_cross': ('V067', 'c', 1, 10, 0, None),
  # 当たり
  'hit_b1': ('V075', 'c', 1, 10, 0, None), 'hit_b2': ('V063', 'c', 1, 10, 0, None), 'hit_b3': ('V092', 'c', 1, 10, 0, None),
  'hit_o1': ('V025', 'c', 1, 10, 0, None), 'hit_o2': ('V171', 'c', 1, 10, 0, None), 'hit_red': ('V108', 'c', 1, 10, 0, None),
  'hit_big': ('V209', 'c', 1, 12, 0, None), 'hit_star': ('V207', 'c', 1, 12, 0, None), 'hit_w': ('V041', 'c', 1, 10, 0, None),
  'hit_el': ('V040', 'c', 1, 10, 0, None), 'burst_w': ('V196', 'c', 1, 12, 0, None),
  # 雷
  'bolt_v': ('V129', 'b', 1, 10, 0, None), 'bolt_g': ('V186', 'b', 1, 10, 0, None), 'bolt_web': ('V143', 'c', 1, 12, 0, None),
  'bolt_s': ('V053', 'c', 1, 10, 0, None), 'bolt_claw': ('V182', 'c', 1, 10, 0, None), 'bolt_big': ('V107', 'c', 1, 10, 0, None),
  # 炎・爆発
  'fire_burst': ('V003', 'b', 1, 12, 0, None), 'fire_big': ('V014', 'b', 1, 12, 0, None), 'fire_col': ('V084', 'b', 1, 12, 0, None),
  'fire_col2': ('V190', 'b', 1, 12, 0, None), 'expl': ('V079', 'c', 1, 12, 0, None), 'expl_ring': ('V095', 'c', 1, 12, 0, None),
  'expl_mush': ('V119', 'b', 1, 12, 0, None), 'expl_mush2': ('V048', 'b', 1, 12, 0, None), 'expl_line': ('V130', 'b', 1, 12, 0, None),
  'fire_ring': ('V136', 'c', 1, 12, 0, None), 'fire_line': ('V144', 'b', 1, 12, 0, None), 'flame_s': ('V137', 'b', 1, 12, 0, None),
  # 煙・土ぼこり
  'dust_land': ('V149', 'b', 1, 12, 0, None), 'dust_puff': ('V031', 'b', 1, 12, 0, None), 'dust_wide': ('V021', 'b', 1, 12, 0, None),
  'dust_dash': ('V013', 'b', 1, 12, 0, None), 'smoke': ('V127', 'c', 1, 12, 0, None), 'smoke_col': ('V034', 'b', 1, 12, 0, None),
  'cloud_w': ('V022', 'c', 1, 12, 0, None),
  # 地面
  'gnd_crack': ('V023', 'b', 1, 10, 0, None), 'gnd_geyser': ('V118', 'b', 1, 12, 0, None), 'gnd_dust': ('V128', 'b', 1, 12, 0, None),
  'gnd_dome': ('V140', 'b', 1, 12, 0, None), 'gnd_splash': ('V193', 'b', 1, 12, 0, None),
  # 気・霊気・結界
  'aura_b': ('V018', 'b', 1, 12, 0, None), 'aura_red': ('V054', 'c', 0.5, 12, 0, None), 'orb_charge': ('V101', 'c', 1, 12, 0, None),
  'ring_charge': ('V043', 'c', 1, 12, 0, None), 'beam': ('V192', 'b', 1, 12, 0, None),
  'barrier': ('V111', 'c', 0.5, 12, 0, None), 'motes': ('V109', 'c', 0.5, 12, 0, None), 'spirit': ('V204', 'c', 1, 12, 0, None),
  'speed': ('V148', 'c', 0.5, 12, 0, None),
  # 光・報酬
  'ring_w': ('V178', 'c', 1, 12, 0, None), 'twinkle': ('V010', 'c', 1, 10, 0, None),
  'spark_y': ('V070', 'c', 1, 10, 0, None), 'ring_y': ('V117', 'c', 1, 12, 0, None), 'gold_swirl': ('V199', 'c', 1, 12, 0, None),
  # 墨・赤
  'ink_spray': ('V001', 'c', 1, 4, 0, None), 'red_swirl': ('V153', 'c', 1, 12, 0, None), 'red_pop': ('V152', 'b', 1, 10, 0, None),
}
idx = {('V%03d' % (i + 1)): f for i, f in enumerate(order)}
tiles = []; meta = {}
for key, (vid, anc, sc, maxf, f0, f1) in USE.items():
    im = Image.open(R + 'art/incoming/' + idx[vid])
    fr = []; du = []
    for x in ImageSequence.Iterator(im):
        a = np.asarray(x.convert('RGBA')).astype(np.float32); du.append(x.info.get('duration', 100))
        if a[0, 0, 3] > 0:   # black background: brightness becomes opacity
            al = a[..., :3].max(2) / 255.0
            al = np.clip((al - 0.12) / 0.88, 0, 1)   # the faint haze of the black background is cut, so no box shows around a frame
            rgb = a[..., :3] / np.maximum(al[..., None], 1e-3)
            a = np.dstack([np.clip(rgb, 0, 255), al * 255])
        fr.append(a)
    fr = fr[f0:f1]; du = du[f0:f1]
    # drop the empty frames at the ends
    live = [i for i, a in enumerate(fr) if (a[..., 3] > 20).sum() > 3]
    fr = fr[live[0]:live[-1] + 1]; du = du[live[0]:live[-1] + 1]
    total = sum(du) / 1000
    step = max(1, int(np.ceil(len(fr) / maxf)))
    fr = fr[::step]
    if sc != 1:
        fr = [np.asarray(Image.fromarray(a.astype(np.uint8)).resize((round(a.shape[1] * sc), round(a.shape[0] * sc)), Image.BILINEAR)).astype(np.float32) for a in fr]
    un = np.zeros(fr[0].shape[:2], bool)
    for a in fr: un |= a[..., 3] > 20
    ys, xs = np.where(un)
    # which sides of the source frame the effect runs into (cut off by the GIF's border): l r t b
    Hs, Ws = un.shape
    cut = ''.join(ch for ch, hit in (('l', xs.min() <= 2), ('r', xs.max() >= Ws - 3), ('t', ys.min() <= 2), ('b', ys.max() >= Hs - 3)) if hit)
    # soften every cut side: the alpha fades to nothing over the last FEATHER pixels, so no hard straight edge shows
    FEATHER = 18
    if cut and anc != 'b' or (cut and cut.replace('b', '')):
        rx = np.ones(Ws, np.float32); ry = np.ones(Hs, np.float32); ramp = np.linspace(0, 1, FEATHER, dtype=np.float32)
        if 'l' in cut: rx[:FEATHER] = np.minimum(rx[:FEATHER], ramp)
        if 'r' in cut: rx[-FEATHER:] = np.minimum(rx[-FEATHER:], ramp[::-1])
        if 't' in cut: ry[:FEATHER] = np.minimum(ry[:FEATHER], ramp)
        if 'b' in cut and anc != 'b': ry[-FEATHER:] = np.minimum(ry[-FEATHER:], ramp[::-1])   # effects standing on the ground keep their foot
        fr = [np.dstack([a[..., :3], a[..., 3] * ry[:, None] * rx[None, :]]) for a in fr]
    ax = (xs.min() + xs.max() + 1) / 2; ay = (ys.max() + 1) if anc == 'b' else (ys.min() + ys.max() + 1) / 2
    lst = []
    for a in fr:
        m = a[..., 3] > 6
        if not m.any(): m[0, 0] = True
        yy, xx = np.where(m); x0, x1, y0, y1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
        tiles.append(a[y0:y1, x0:x1].astype(np.uint8)); lst.append([0, 0, int(x1 - x0), int(y1 - y0), int(round(x0 - ax)), int(round(y0 - ay))])
    meta[key] = { 'v': vid, 'fd': round(total / len(fr), 3), 'k': 1 / sc, 'f': lst, 'cut': cut, 'W': int(xs.max() - xs.min() + 1) }
# pack: tallest first, rows
order_t = sorted(range(len(tiles)), key=lambda i: -tiles[i].shape[0])
SW = 2048; x = y = rowh = 0; pos = [None] * len(tiles)
for i in order_t:
    h, w = tiles[i].shape[:2]
    if x + w > SW: x = 0; y += rowh + 1; rowh = 0
    pos[i] = (x, y); x += w + 1; rowh = max(rowh, h)
sheet = np.zeros((y + rowh, SW, 4), np.uint8)
for i, t in enumerate(tiles): px_, py = pos[i]; sheet[py:py + t.shape[0], px_:px_ + t.shape[1]] = t
k = 0
for key in meta:
    for fr in meta[key]['f']: fr[0], fr[1] = pos[k]; k += 1
Image.fromarray(sheet).save(R + 'page/vfx.png', optimize=True)
json.dump(meta, open(R + 'page/vfx.json', 'w'), separators=(',', ':'))
print('vfx.png', sheet.shape, len(meta), 'effects', len(tiles), 'frames', os.path.getsize(R + 'page/vfx.png') // 1024, 'KB')
