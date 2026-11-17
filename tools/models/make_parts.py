"""
影の鎧武者を作る (docs/設計_影の3D.md 第3D-3.0段)。

Tripo3D などで作った1体の重いモデル（Tポーズ）から、影に使う軽い部品のモデルを作る:
  1. 軽くする: 近い点を1つにまとめる（格子に寄せる）。墨で塗りつぶして輪郭で見せるので、細かい面は要らない
  2. 骨に合わせる: VRM（assets/models/shadow.vrm）の骨の位置を、モデルの腕の高さ・手先・足元に合わせて伸び縮みさせる
  3. 切り分ける: 面を一番近い骨に付ける。関節（首・肩・肘・手首・膝・足首）の近くの面は消して、隙間にする
  4. 書き出す: 骨ごとに1つの部品（名前は "part_" + VRM の骨の名前）。座標は VRM の立ち姿の座標に直してある

使い方:
  python tools/models/make_parts.py assets/images/3d/samurai.glb assets/models/samurai_parts.glb
数値は下の CFG（試しながら決める値。決まったら balance.json へは移さない: 作る時だけの値）。
"""
import sys, json, struct
import numpy as np
import trimesh

CFG = {
    "cell": 0.0105,          # まとめる格子の大きさ（モデルの高さを1としたとき）
    # the joints left empty: a slice across the bone, gap = half its thickness, reach = how far out from the bone it cuts
    # (VRM metres). axis: the bone that runs through the joint ("up" = straight up)
    "gap": {
        "neck": (0.025, 0.12, "up"),
        "leftUpperArm": (0.02, 0.09, "leftUpperArm"), "rightUpperArm": (0.02, 0.09, "rightUpperArm"),
        "leftLowerArm": (0.025, 0.12, "leftUpperArm"), "rightLowerArm": (0.025, 0.12, "rightUpperArm"),
        "leftHand": (0.018, 0.09, "leftLowerArm"), "rightHand": (0.018, 0.09, "rightLowerArm"),
        "leftLowerLeg": (0.03, 0.16, "leftUpperLeg"), "rightLowerLeg": (0.03, 0.16, "rightUpperLeg"),
        "leftFoot": (0.02, 0.11, "leftLowerLeg"), "rightFoot": (0.02, 0.11, "rightLowerLeg"),
    },
}

# ---------- the VRM skeleton at rest ----------
def read_glb_json(path):
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n])

def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def vrm_joints(path):
    j = read_glb_json(path)
    nodes, parent = j["nodes"], {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []): parent[c] = i
    def world(i):
        M = np.eye(4)
        n = nodes[i]
        M[:3, :3] = quat_mat(n.get("rotation", [0, 0, 0, 1])) * np.array(n.get("scale", [1, 1, 1]))
        M[:3, 3] = n.get("translation", [0, 0, 0])
        return world(parent[i]) @ M if i in parent else M
    hb = j["extensions"]["VRMC_vrm"]["humanoid"]["humanBones"]
    return {k: world(v["node"])[:3, 3] for k, v in hb.items()}

# the bones a piece can hang on: (bone, from joint, to joint or None = a fixed offset upwards)
SEGMENTS = [
    ("hips", "hips", "spine"), ("spine", "spine", "chest"), ("chest", "chest", "neck"),
    ("head", "head", None),
    ("leftUpperArm", "leftUpperArm", "leftLowerArm"), ("leftLowerArm", "leftLowerArm", "leftHand"), ("leftHand", "leftHand", "leftMiddleProximal"),
    ("rightUpperArm", "rightUpperArm", "rightLowerArm"), ("rightLowerArm", "rightLowerArm", "rightHand"), ("rightHand", "rightHand", "rightMiddleProximal"),
    ("leftUpperLeg", "leftUpperLeg", "leftLowerLeg"), ("leftLowerLeg", "leftLowerLeg", "leftFoot"), ("leftFoot", "leftFoot", "leftToes"),
    ("rightUpperLeg", "rightUpperLeg", "rightLowerLeg"), ("rightLowerLeg", "rightLowerLeg", "rightFoot"), ("rightFoot", "rightFoot", "rightToes"),
]

def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(1e-9, ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)

# ---------- lighter: vertex clustering ----------
def cluster(m, cell):
    v, f = m.vertices, m.faces
    key = np.floor(v / cell).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    nv = np.zeros((len(uniq), 3)); cnt = np.bincount(inv, minlength=len(uniq))
    np.add.at(nv, inv, v); nv /= cnt[:, None]
    nf = inv[f]
    ok = (nf[:, 0] != nf[:, 1]) & (nf[:, 1] != nf[:, 2]) & (nf[:, 0] != nf[:, 2])
    nf = nf[ok]
    nf = nf[np.sort(np.unique(np.sort(nf, axis=1), axis=0, return_index=True)[1])]   # the same face twice: once
    out = trimesh.Trimesh(nv, nf, process=True)
    out.remove_unreferenced_vertices()
    return out

def main(src, dst):
    sc = trimesh.load(src)
    m = sc.to_geometry() if isinstance(sc, trimesh.Scene) else sc
    print("in:", len(m.faces), "faces, extents", np.round(m.extents, 3))
    m = cluster(m, CFG["cell"] * m.extents[1])
    print("lighter:", len(m.faces), "faces")

    J = vrm_joints("assets/models/shadow.vrm")
    # the model's T-pose landmarks: hand tips (widest x), arm height (where the arms are), feet (lowest y)
    v = m.vertices
    span = v[:, 0].max() - v[:, 0].min()
    arms = v[np.abs(v[:, 0]) > 0.75 * np.abs(v[:, 0]).max()]
    arm_y = np.median(arms[:, 1]) - v[:, 1].min()
    cx, cz, y0 = (v[:, 0].max() + v[:, 0].min()) / 2, np.median(v[:, 2]), v[:, 1].min()
    # the same on the VRM: hand tips ≈ middle finger tips, arm height = the upper arms
    tipL, tipR = J.get("leftMiddleDistal", J["leftHand"]), J.get("rightMiddleDistal", J["rightHand"])
    vspan = abs(tipL[0] - tipR[0]) * 1.06
    floor = min(J["leftFoot"][1], J["rightFoot"][1]) - 0.08
    varm = (J["leftUpperArm"][1] + J["rightUpperArm"][1]) / 2 - floor
    sx, sy = vspan / span, varm / arm_y
    print("scale x %.3f y %.3f" % (sx, sy))
    # the model into the VRM's rest space (x and z by sx, y by sy)
    P = np.empty_like(v)
    P[:, 0] = (v[:, 0] - cx) * sx
    P[:, 1] = (v[:, 1] - y0) * sy + floor
    P[:, 2] = (v[:, 2] - cz) * sx + J["hips"][2]
    m.vertices = P

    # each face goes to the nearest bone
    C = m.triangles_center
    head_top = J["head"] + np.array([0, 0.25, 0])
    D = []
    for name, a, b in SEGMENTS:
        A = J[a]; B = J[b] if b else head_top
        if b and b not in J: B = A + np.array([0, -0.1, 0])
        D.append(seg_dist(C, A, B))
    D = np.stack(D, 1)
    owner = D.argmin(1)
    # joints left empty
    keep = np.ones(len(C), bool)
    nxt = {s[1]: s[2] for s in SEGMENTS}
    for jn, (half, reach, ax) in CFG["gap"].items():
        if jn not in J: continue
        if ax == "up": d = np.array([0, 1.0, 0])
        else: d = J[nxt[ax]] - J[ax]; d = d / np.linalg.norm(d)
        rel = C - J[jn]; along = rel @ d; radial = np.linalg.norm(rel - along[:, None] * d, axis=1)
        keep &= ~((np.abs(along) < half) & (radial < reach))
    print("removed at joints:", int((~keep).sum()), "faces")

    out = trimesh.Scene()
    for k, (name, _, _) in enumerate(SEGMENTS):
        sel = np.where((owner == k) & keep)[0]
        if not len(sel): continue
        part = m.submesh([sel], append=True)
        part.visual = trimesh.visual.ColorVisuals(part, face_colors=[230, 230, 230, 255])
        out.add_geometry(part, node_name="part_" + name, geom_name="part_" + name)
        print(" part_%s: %d faces" % (name, len(sel)))
    out.export(dst)
    print("wrote", dst)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
