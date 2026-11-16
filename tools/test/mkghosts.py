# Makes computed ghosts for shadowlab.html (docs/設計_影の見た目.md, stage 0).
#   python tools/test/mkghosts.py
# A simple stick body is posed by formulas, then looked at through a camera like the phone's.
# No pose estimation is involved, so these ghosts have no jitter and no guessing: they test the drawing alone
# (facing, twist, spin). Real ghosts recorded on the iPhone are still needed for everything else.
# Written to tools/test/ghosts/*.ghost.json, with index.json listing them.
import json, math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ghosts")
FPS, ASPECT = 15, 0.5625            # 15 frames a second, a 9:16 picture
CAM_D, SPAN = 3.2, 2.3              # camera 3.2 m away; the picture is 2.3 m tall at the body
POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

def rot_y(p, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)
def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def mix(a, b, k): return tuple(a[i] + (b[i] - a[i]) * k for i in range(3))
def ease(k): k = max(0.0, min(1.0, k)); return k * k * (3 - 2 * k)
def dist(a, b): return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))
UPPER, FORE = 0.29, 0.27            # upper arm and forearm, metres
REACH, CHEST = (UPPER + FORE) * 0.97, (0.0, 0.30, 0.30)

# hand positions in the body's own frame (metres; x = the body's left, y = up from the hips, z = forwards)
HANDS = {
    "kamae":     (0.00, 0.25, 0.32),
    "jodan":     (0.00, 0.78, 0.10),
    "shinmen_e": (0.00, 0.12, 0.42),
    "kesa_s":    (-0.30, 0.72, 0.12), "kesa_e": (0.28, 0.05, 0.36),
    "gkesa_s":   (0.30, 0.72, 0.12),  "gkesa_e": (-0.28, 0.05, 0.36),
    "do_s":      (-0.42, 0.30, 0.20), "do_e": (0.42, 0.28, 0.24),
    "spin_s":    (-0.40, 0.42, 0.18), "spin_e": (0.44, 0.34, 0.26),
}

def body(hand, yaw=0.0, twist=0.0, sink=0.0):
    """13 joints in the room (x = picture right, y = up, z = towards the camera). yaw turns everything, twist only above the hips."""
    up = lambda p: rot_y(p, yaw + twist)
    lo = lambda p: rot_y(p, yaw)
    sL, sR = (0.19, 0.50, 0.0), (-0.19, 0.50, 0.0)
    hL, hR = (-0.035 + hand[0], hand[1] - 0.05, hand[2]), (0.035 + hand[0], hand[1] + 0.05, hand[2])  # left hand at the pommel, right near the guard
    # the arms are two stiff bones (so the bone-length step of stage 1 has something true to keep):
    # hands that are out of reach are drawn in towards the chest together, and the elbow is placed by the two-bone joint
    for _ in range(40):
        if dist(sL, hL) <= REACH and dist(sR, hR) <= REACH: break
        hL, hR = mix(CHEST, hL, 0.95), mix(CHEST, hR, 0.95)
    def elbow(s, h, side):
        d = max(1e-6, dist(s, h)); dr = tuple((h[i] - s[i]) / d for i in range(3))
        a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d); up_ = math.sqrt(max(0.0, UPPER * UPPER - a * a))
        pole = (side * 0.5, -1.0, -0.3); k = sum(pole[i] * dr[i] for i in range(3))
        pole = tuple(pole[i] - dr[i] * k for i in range(3)); n = math.sqrt(sum(c * c for c in pole)) or 1.0
        return tuple(s[i] + dr[i] * a + pole[i] / n * up_ for i in range(3))
    J = {
        0: up((0.0, 0.72, 0.06)),
        11: up(sL), 12: up(sR),
        13: up(elbow(sL, hL, 1)), 14: up(elbow(sR, hR, -1)),
        15: up(hL), 16: up(hR),
        23: lo((0.11, 0.0, 0.0)), 24: lo((-0.11, 0.0, 0.0)),
        25: lo((0.16, -0.44 + sink * 0.5, 0.10)), 26: lo((-0.18, -0.44 + sink * 0.5, -0.02)),
        27: lo((0.20, -0.88 + sink, 0.12)), 28: lo((-0.24, -0.88 + sink, -0.10)),
    }
    return {k: (v[0], v[1] - sink, v[2]) for k, v in J.items()}

def project(J):
    s = 1.0 / SPAN
    row, zs = [], []
    for i in POINTS:
        x, y, z = J[i]
        k = CAM_D / (CAM_D - z)                      # nearer the camera = bigger
        # the picture is not mirrored: the person's left side is on the picture's right
        row += [round(0.5 + x * k * s / ASPECT, 3), round(0.56 - y * k * s, 3)]
        zs.append(round(-z * s / ASPECT, 3))         # like the pose estimate: depth from the hips, negative towards the camera
    return row, zs

def make(gid, name, script, events):
    """script(t seconds) -> (hand, yaw, twist, sink); events: [(seconds, form id)]"""
    total = script("len")
    frames, depth = [], []
    n = int(total * FPS) + 1
    for i in range(n):
        t = i / FPS
        row, zs = project(body(*script(t)))
        frames.append([round(t * 1000)] + row); depth.append(zs)
    return {
        "format": "ghost/1", "id": gid, "name": name, "kind": "kata", "master": False, "computed": True,
        "created": "2026-11-16T00:00:00.000Z", "fps": FPS, "aspect": ASPECT, "points": POINTS,
        "frames": frames, "depth": depth,
        "events": [[round(s * 1000), "swing", form, 100, 1] for s, form in events],
    }

def seq(keys):
    """keys: [(time, hand name, yaw, twist, sink)] -> script(t) with eased moves between the keys"""
    def f(t):
        if t == "len": return keys[-1][0]
        for a, b in zip(keys, keys[1:]):
            if t <= b[0]:
                k = ease((t - a[0]) / (b[0] - a[0]))
                return (mix(HANDS[a[1]], HANDS[b[1]], k), a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k, a[4] + (b[4] - a[4]) * k)
        a = keys[-1]
        return (HANDS[a[1]], a[2], a[3], a[4])
    return f

GHOSTS = [
    make("calc_slow", "計算・ゆっくりの型", seq([
        (0.0, "kamae", 0, 0, 0), (1.5, "kamae", 0, 0, 0), (2.7, "jodan", 0, 0, 0), (3.2, "jodan", 0, 0, 0),
        (3.6, "shinmen_e", 0, 0, 0.04), (5.6, "shinmen_e", 0, 0, 0.04), (6.6, "kamae", 0, 0, 0), (7.5, "kamae", 0, 0, 0)]),
        [(3.6, "shinmen")]),
    make("calc_combo", "計算・速い連撃", seq([
        (0.0, "kamae", 0, 0, 0), (0.8, "kesa_s", 0, -12, 0), (1.0, "kesa_e", 0, 14, 0.03),
        (1.35, "gkesa_s", 0, 12, 0), (1.55, "gkesa_e", 0, -14, 0.03),
        (1.9, "do_s", 0, -22, 0.02), (2.1, "do_e", 0, 24, 0.04), (3.4, "do_e", 0, 24, 0.04), (4.2, "kamae", 0, 0, 0)]),
        [(1.0, "kesa"), (1.55, "gyakukesa"), (2.1, "do")]),
    make("calc_twist", "計算・ひねり", seq([
        (0.0, "kamae", 0, 0, 0), (1.0, "kamae", 0, 0, 0), (2.2, "do_s", 0, -45, 0), (3.0, "do_s", 0, -45, 0),
        (3.5, "do_e", 0, 45, 0.03), (4.5, "do_e", 0, 45, 0.03), (5.5, "kamae", 0, 0, 0),
        (6.7, "kamae", 90, 0, 0), (7.7, "kamae", 90, 0, 0), (8.9, "kamae", 0, 0, 0), (10.1, "kamae", -90, 0, 0), (11.1, "kamae", -90, 0, 0), (12.0, "kamae", 0, 0, 0)]),
        [(3.5, "do")]),
    make("calc_spin", "計算・回転切り", seq([
        (0.0, "kamae", 0, 0, 0), (1.0, "kamae", 0, 0, 0), (1.5, "spin_s", 0, -25, 0.03),
        (2.3, "spin_e", 360, 25, 0.05), (3.6, "spin_e", 360, 25, 0.05), (4.4, "kamae", 360, 0, 0),
        (5.4, "kamae", 360, 0, 0), (5.9, "spin_s", 360, -25, 0.03), (6.35, "spin_e", 720, 25, 0.05), (7.6, "spin_e", 720, 25, 0.05), (8.4, "kamae", 720, 0, 0)]),
        [(2.3, "do"), (6.35, "do")]),
]

os.makedirs(OUT, exist_ok=True)
for g in GHOSTS:
    with open(os.path.join(OUT, g["id"] + ".ghost.json"), "w", encoding="utf8", newline="\n") as f:
        json.dump(g, f, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(OUT, "index.json"), "w", encoding="utf8", newline="\n") as f:
    # ghosts recorded on the iPhone are kept beside the computed ones and listed after them
    REAL = [{"file": "real_midare.ghost.json", "name": "ヒデキ・早い乱撃"}]
    json.dump([{"file": g["id"] + ".ghost.json", "name": g["name"]} for g in GHOSTS] + REAL, f, ensure_ascii=False, indent=1)
print([(g["id"], len(g["frames"])) for g in GHOSTS])
