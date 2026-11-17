// 影の輪郭 (docs/設計_影の3D.md 第3D-4.0段): the person's own outline, recorded with the skeleton, so the ghost carries the
// body's real movement (the turn of the hips, the shoulders going in, the cloth flying) — and then given the body of the
// chosen avatar (a slim person as a hulking oni, a heavy person as a slender sennyo) while keeping that movement.
//
// Recorded as points only, never a picture (ヒデキの了承 2026-11-17): ghost.outlines = [[t ms, x0, y0, x1, y1, …], …],
// N points round the body, picture 0–1, not mirrored, starting at the top of the head and going the same way round.

// ---------- from the segmentation mask (MediaPipe) to N points round the body ----------
// mask: values 0–1, w×h, row by row. Returns [x0, y0, …] (0–1) or null when no body is found.
export function outlineFromMask(mask, w, h, n = 96, thr = 0.5, grid = 128) {
  const step = Math.max(1, Math.round(w / grid)), gw = Math.floor(w / step), gh = Math.floor(h / step);
  const on = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) on[y * gw + x] = mask[(y * step) * w + x * step] > thr ? 1 : 0;
  // the largest piece only (a hand or a chair in the background is dropped)
  const lab = new Int32Array(gw * gh); let best = 0, bestN = 0, cur = 0;
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || lab[i]) continue;
    cur++; let cnt = 0; const st = [i]; lab[i] = cur;
    while (st.length) { const j = st.pop(); cnt++; const x = j % gw, y = (j / gw) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < gw - 1 ? j + 1 : -1, y > 0 ? j - gw : -1, y < gh - 1 ? j + gw : -1]) if (k >= 0 && on[k] && !lab[k]) { lab[k] = cur; st.push(k); } }
    if (cnt > bestN) { bestN = cnt; best = cur; }
  }
  if (bestN < 30) return null;
  const at = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && lab[y * gw + x] === best;
  // the top of the head: the first pixel of the piece, row by row
  let sx = -1, sy = -1;
  for (let y = 0; y < gh && sx < 0; y++) for (let x = 0; x < gw; x++) if (at(x, y)) { sx = x; sy = y; break; }
  // walk round the edge (Moore neighbour tracing), clockwise on the picture
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pts = [[sx, sy]]; let x = sx, y = sy, dir = 6, guard = 0;
  do {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8, nx = x + D[d][0], ny = y + D[d][1];
      if (at(nx, ny)) { x = nx; y = ny; dir = d; found = true; break; }
    }
    if (!found) break;
    pts.push([x, y]);
  } while ((x !== sx || y !== sy) && ++guard < gw * gh * 2);
  if (pts.length < 8) return null;
  // smooth a little, then N points at equal spacing along the edge
  const m = pts.length, sm = pts.map((_, i) => { let ax = 0, ay = 0; for (let k = -2; k <= 2; k++) { const q = pts[(i + k + m) % m]; ax += q[0]; ay += q[1]; } return [ax / 5, ay / 5]; });
  const len = [0]; for (let i = 1; i <= m; i++) { const a = sm[i - 1], b = sm[i % m]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const out = [], total = len[m]; let j = 0;
  for (let k = 0; k < n; k++) {
    const want = (k / n) * total; while (j < m - 1 && len[j + 1] < want) j++;
    const a = sm[j], b = sm[(j + 1) % m], f = len[j + 1] > len[j] ? (want - len[j]) / (len[j + 1] - len[j]) : 0;
    out.push(+(((a[0] + (b[0] - a[0]) * f) * step + step / 2) / w).toFixed(4), +(((a[1] + (b[1] - a[1]) * f) * step + step / 2) / h).toFixed(4));
  }
  return out;
}

// ---------- playback: the outline at time t (between two recorded outlines, point by point) ----------
export function outlineAt(g, t) {
  const O = g.outlines; if (!O || O.length < 2) return null;
  let i = outlineAt.g === g && O[outlineAt.i] && O[outlineAt.i][0] <= t ? outlineAt.i : 0;
  while (i < O.length - 1 && O[i + 1][0] <= t) i++;
  outlineAt.g = g; outlineAt.i = i;
  const a = O[i], b = O[Math.min(i + 1, O.length - 1)], k = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
  if (a.length !== b.length) return a.slice(1);
  const out = new Array(a.length - 1);
  for (let j = 1; j < a.length; j++) out[j - 1] = a[j] + (b[j] - a[j]) * k;
  return out;
}

// ---------- the avatar's body: the person's outline, made thicker or thinner part by part ----------
// Each outline point belongs to the nearest part of the skeleton (head, torso, upper arm, forearm, thigh, shin); its distance
// from that part is scaled by the avatar's thickness for the part (and, for the torso, along it: shoulders → waist → hips).
// What the person's body does from moment to moment stays, because only the distance is scaled, not replaced.
// pose: the 13 points (picture 0–1, x, y); asp: picture width / height. Returns new [x0, y0, …].
const PARTS = [["head", 0, 0], ["torso", "sc", "hc"], ["arm", 11, 13], ["arm", 12, 14], ["fore", 13, 15], ["fore", 14, 16],
  ["thigh", 23, 25], ["thigh", 24, 26], ["shin", 25, 27], ["shin", 26, 28]];
export function reshape(out, pose, asp, av) {
  if (!av || !pose || !pose[11] || !pose[12] || !pose[23] || !pose[24]) return out;
  const P = (k) => (k === "sc" ? [(pose[11][0] + pose[12][0]) / 2, ((pose[11][1] + pose[12][1]) / 2) / asp] : k === "hc" ? [(pose[23][0] + pose[24][0]) / 2, ((pose[23][1] + pose[24][1]) / 2) / asp] : pose[k] ? [pose[k][0], pose[k][1] / asp] : null);
  const segs = PARTS.map(([part, a, b]) => ({ part, A: P(a), B: P(b) })).filter((s) => s.A && s.B);
  const n = out.length / 2, res = new Array(out.length), kk = new Float64Array(n), cx = new Float64Array(n), cy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = out[i * 2], y = out[i * 2 + 1] / asp; let bd = Infinity, bs = null, bt = 0;
    for (const s of segs) {
      const dx = s.B[0] - s.A[0], dy = s.B[1] - s.A[1], L2 = dx * dx + dy * dy;
      const t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((x - s.A[0]) * dx + (y - s.A[1]) * dy) / L2)) : 0;
      const d = Math.hypot(x - (s.A[0] + dx * t), y - (s.A[1] + dy * t));
      if (d < bd) { bd = d; bs = s; bt = t; }
    }
    const k = av[bs.part] ?? 1;
    // the torso's thickness changes from the shoulders (t 0) to the waist (0.7) to the hips (1)
    kk[i] = bs.part === "torso" ? (bt < 0.7 ? (av.shoulders ?? k) + ((av.waist ?? k) - (av.shoulders ?? k)) * (bt / 0.7) : (av.waist ?? k) + ((av.hips ?? k) - (av.waist ?? k)) * ((bt - 0.7) / 0.3))
      : bs.part === "shin" ? k * (1 + ((av.hem ?? 1) - 1) * bt) : k;       // a robe or hakama widening to the hem
    cx[i] = bs.A[0] + (bs.B[0] - bs.A[0]) * bt; cy[i] = bs.A[1] + (bs.B[1] - bs.A[1]) * bt;
  }
  // smooth the thickness round the outline so the parts meet without steps
  const ks = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = -3; j <= 3; j++) s += kk[(i + j + n) % n]; ks[i] = s / 7; }
  for (let i = 0; i < n; i++) {
    const x = out[i * 2], y = out[i * 2 + 1] / asp;
    res[i * 2] = cx[i] + (x - cx[i]) * ks[i]; res[i * 2 + 1] = (cy[i] + (y - cy[i]) * ks[i]) * asp;
  }
  return res;
}
