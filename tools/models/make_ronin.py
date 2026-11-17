"""
影のキャラ（骨で曲がる、濃淡のある体）を作る (docs/注文書_影の世界観.md、docs/設計_影の3D.md 第3D-3.1段)。

Tripo3D などで作った、模様付き・骨なしの重いモデル（Tポーズ）から:
  1. 模様の濃淡を、点ごとの灰色にする（模様の画像は持たない。影は灰色の濃淡で描くので、これで足りる）
  2. 軽くする（近い点を1つにまとめる。灰色はまとめた点の平均）
  3. VRM（assets/models/shadow.vrm）の骨の大きさに合わせる（腕の高さ・手先・足元。make_parts.py と同じ）
  4. 書き出す（GLB。点の色 = 灰色）。骨への結び付けは描く側（js/shadowarmor.js の loadSkinnedBody）が行う

使い方:
  python tools/models/make_ronin.py assets/images/3d/ronin.glb assets/models/ronin_body.glb
"""
import sys, os
import numpy as np
import trimesh
sys.path.insert(0, os.path.dirname(__file__))
from make_parts import cluster, vrm_joints

CELL = 0.0075          # まとめる格子（モデルの高さを1として）

def gray_of(m):
    """the texture's brightness at each vertex (0..1)"""
    v = m.visual
    img = np.asarray(v.material.baseColorTexture.convert("L"), dtype=np.float32) / 255
    h, w = img.shape
    uv = np.asarray(v.uv, dtype=np.float64)
    x = np.clip((uv[:, 0] % 1) * (w - 1), 0, w - 1).astype(int)
    y = np.clip((1 - uv[:, 1] % 1) * (h - 1), 0, h - 1).astype(int)
    return img[y, x]

def cluster_with(m, val, cell):
    """like make_parts.cluster, carrying a value per vertex (averaged)"""
    key = np.floor(m.vertices / cell).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
    cnt = np.bincount(inv, minlength=len(uniq))
    nv = np.zeros((len(uniq), 3)); np.add.at(nv, inv, m.vertices); nv /= cnt[:, None]
    nval = np.bincount(inv, weights=val, minlength=len(uniq)) / cnt
    nf = inv[m.faces]
    ok = (nf[:, 0] != nf[:, 1]) & (nf[:, 1] != nf[:, 2]) & (nf[:, 0] != nf[:, 2]); nf = nf[ok]
    nf = nf[np.sort(np.unique(np.sort(nf, axis=1), axis=0, return_index=True)[1])]
    used = np.unique(nf); remap = -np.ones(len(nv), int); remap[used] = np.arange(len(used))
    return nv[used], remap[nf], nval[used]

def main(src, dst):
    sc = trimesh.load(src)
    m = sc.to_geometry() if isinstance(sc, trimesh.Scene) else sc
    print("in:", len(m.faces), "faces")
    g = gray_of(m)
    v, f, g = cluster_with(m, g, CELL * m.extents[1])
    print("lighter:", len(f), "faces, grey %.2f..%.2f" % (g.min(), g.max()))
    J = vrm_joints("assets/models/shadow.vrm")
    span = v[:, 0].max() - v[:, 0].min()
    arms = v[np.abs(v[:, 0]) > 0.75 * np.abs(v[:, 0]).max()]
    arm_y = np.median(arms[:, 1]) - v[:, 1].min()
    cx, cz, y0 = (v[:, 0].max() + v[:, 0].min()) / 2, np.median(v[:, 2]), v[:, 1].min()
    tipL, tipR = J.get("leftMiddleDistal", J["leftHand"]), J.get("rightMiddleDistal", J["rightHand"])
    vspan = abs(tipL[0] - tipR[0]) * 1.06
    floor = min(J["leftFoot"][1], J["rightFoot"][1]) - 0.08
    varm = (J["leftUpperArm"][1] + J["rightUpperArm"][1]) / 2 - floor
    sx, sy = vspan / span, varm / arm_y
    print("scale x %.3f y %.3f" % (sx, sy))
    P = np.empty_like(v)
    P[:, 0] = (v[:, 0] - cx) * sx
    P[:, 1] = (v[:, 1] - y0) * sy + floor
    P[:, 2] = (v[:, 2] - cz) * sx + J["hips"][2]
    c = (np.clip(g, 0, 1) * 255).astype(np.uint8)
    out = trimesh.Trimesh(P, f, vertex_colors=np.stack([c, c, c, np.full_like(c, 255)], 1), process=False)
    out.export(dst)
    print("wrote", dst, os.path.getsize(dst) // 1024, "KB")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
