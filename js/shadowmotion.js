// 影の動き (shadow motion): what a ghost's pose says about the body, apart from how it is drawn.
// Stage 0 of docs/設計_影の見た目.md holds only the facing (front / side / back) and the twist.
// Stage 1 added the clean-up (createMotion below: unseen points, jitter filter, bone lengths, planted feet, in-between frames).
//
// A pose comes from poseAt() in js/ghost.js: { landmarkIndex: [x, y] or [x, y, z] }.
// x, y are in the camera picture (0–1, not mirrored); z is depth from the hips, negative towards the camera.

const L_SHOULDER = 11, R_SHOULDER = 12, L_HIP = 23, R_HIP = 24;

// which way a body line (shoulders or hips) points, in degrees: 0 = square to the camera,
// + = the person's left side comes towards the camera, ±180 = the back is turned.
// null when either end is unseen or the ghost has no depth.
export function yawOf(pose, left, right) {
  const a = pose && pose[left], b = pose && pose[right];
  if (!a || !b || a.length < 3 || b.length < 3) return null;
  return (Math.atan2(b[2] - a[2], a[0] - b[0]) * 180) / Math.PI;
}
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// cfg = balance.json "shadow.facing": { sideDeg, backDeg }
// → { shoulders, hips, twist (shoulders − hips), side: "front" | "side" | "back" }, or null without depth
export function facingOf(pose, cfg = { sideDeg: 55, backDeg: 125 }) {
  const shoulders = yawOf(pose, L_SHOULDER, R_SHOULDER);
  if (shoulders == null) return null;
  const hips = yawOf(pose, L_HIP, R_HIP);
  const turn = Math.abs(shoulders);
  return {
    shoulders, hips,
    twist: hips == null ? null : wrap(shoulders - hips),
    side: turn >= cfg.backDeg ? "back" : turn >= cfg.sideDeg ? "side" : "front",
  };
}
export const hasDepth = (g) => Array.isArray(g.depth) && g.depth.length === g.frames.length;

// ---------- stage 1: the clean-up (docs/手順_影の見た目.md「第1段」) ----------
// createMotion(ghost, balance.shadow.motion) tidies the whole ghost once and keeps the result.
//   motion.at(tMs)     → a pose like poseAt(), but tidied, and always with all 13 points
//   motion.metaAt(tMs) → { facing: { shoulders, hips, twist, side } | null, seen: { point: 0–1 }, planted: { 27: bool, 28: bool } }
// Only what is shown is touched. The skeleton used for judging swings never comes through here.
// Each step can be switched off for the test page: smooth: null, boneLock: false, footLock: null, interp: "line".
// boneLock is false, "clamp" or "full" (true means "full"); see step 3.
const LIMBS = [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]];   // upper arm, forearm, thigh, shin: [from, to]
const LEGS = [[23, 25, 27], [24, 26, 28]];                                                         // [hip, knee, ankle]
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const euroAlpha = (rate, fc) => 1 / (1 + rate / (2 * Math.PI * fc));

// One Euro filter in one direction (dir = 1 forwards, −1 backwards). T in ms.
function euroPass(v, T, minCutoff, beta, dCutoff, dir) {
  const n = v.length, out = new Float64Array(n);
  let i = dir > 0 ? 0 : n - 1, prev = v[i], dPrev = 0;
  out[i] = prev;
  for (let k = 1; k < n; k++) {
    const j = i + dir, rate = 1000 / Math.max(1, Math.abs(T[j] - T[i]));
    dPrev += euroAlpha(rate, dCutoff) * ((v[j] - prev) * rate - dPrev);
    prev += euroAlpha(rate, minCutoff + beta * Math.abs(dPrev)) * (v[j] - prev);
    out[j] = prev; i = j;
  }
  return out;
}
// forwards and backwards, then the average: the recording is looked at afterwards, so the lag cancels out
function euroBoth(v, T, { minCutoff = 1.2, beta = 8, dCutoff = 4 } = {}) {
  if (v.length < 3) return v;
  const a = euroPass(v, T, minCutoff, beta, dCutoff, 1), b = euroPass(v, T, minCutoff, beta, dCutoff, -1);
  for (let i = 0; i < a.length; i++) a[i] = (a[i] + b[i]) / 2;
  return a;
}
function median(list) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const percentile = (list, p) => { if (!list.length) return 0; const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

export function createMotion(g, cfg = {}, facingCfg = { sideDeg: 55, backDeg: 125 }) {
  const F = g.frames, N = F.length, pts = g.points, M = pts.length;
  const D = hasDepth(g) ? g.depth : null, dims = D ? 3 : 2, asp = g.aspect || 0.75;
  const T = F.map((f) => f[0]);
  const J = {}; pts.forEach((p, j) => (J[p] = j));
  // P[j][c][i]: point j, axis c (x, y, z), frame i
  const P = pts.map((_, j) => Array.from({ length: dims }, (_, c) => {
    const a = new Float64Array(N);
    for (let i = 0; i < N; i++) a[i] = c < 2 ? F[i][1 + j * 2 + c] : D[i][j];
    return a;
  }));
  const rawSeen = pts.map((_, j) => { const s = new Uint8Array(N); for (let i = 0; i < N; i++) s[i] = F[i][1 + j * 2] >= 0 ? 1 : 0; return s; });
  const info = { depth: !!D, frames: N, filled: 0, never: [], lengths: null };

  // --- 1. fill the points that were not seen ---
  const holdMs = cfg.holdMs ?? 200;
  const seen = pts.map(() => new Float32Array(N).fill(1));
  const never = new Set();
  for (let j = 0; j < M; j++) {
    const s = rawSeen[j];
    let first = -1, last = -1;
    for (let i = 0; i < N; i++) if (s[i]) { if (first < 0) first = i; last = i; }
    if (first < 0) { never.add(j); seen[j].fill(0); info.filled += N; continue; }
    let prevSeen = -1, lostAt = -Infinity;                       // lostAt: time of the latest frame where the point was missing
    for (let i = 0; i < N; i++) {
      if (s[i]) { prevSeen = i; seen[j][i] = holdMs > 0 ? clamp01((T[i] - lostAt) / holdMs) : 1; continue; }
      info.filled++; seen[j][i] = 0; lostAt = T[i];
      let next = i + 1; while (next < N && !s[next]) next++;
      for (let c = 0; c < dims; c++) {
        const a = P[j][c];
        if (prevSeen < 0) a[i] = a[first];                         // only seen later: stay at that value
        else if (next >= N) a[i] = a[last];                        // only seen before: stay at that value
        else a[i] = a[prevSeen] + (a[next] - a[prevSeen]) * ((T[i] - T[prevSeen]) / Math.max(1, T[next] - T[prevSeen]));
      }
    }
  }
  // points that were never seen in the whole ghost are placed from the build of the body
  if (never.size) {
    info.never = [...never].map((j) => pts[j]);
    const ok = (id) => J[id] != null && !never.has(J[id]);
    const put = (id, fn) => { const j = J[id]; for (let i = 0; i < N; i++) { const v = fn(i); for (let c = 0; c < dims; c++) P[j][c][i] = v[c]; } never.delete(j); };
    const at = (id, i) => P[J[id]].map((a) => a[i]);
    const mid = (a, b) => (i) => at(a, i).map((v, c) => (v + at(b, i)[c]) / 2);
    const ext = (a, b, k) => (i) => at(b, i).map((v, c) => v + (v - at(a, i)[c]) * k);            // on from b, away from a
    const down = (from, k) => (i) => at(from, i).map((v, c) => v + ((at(23, i)[c] + at(24, i)[c]) / 2 - (at(11, i)[c] + at(12, i)[c]) / 2) * k); // along the spine, shoulders → hips
    const torso = () => ok(11) && ok(12) && ok(23) && ok(24);
    const rules = [
      [11, () => ok(12) && mid(12, 12)], [12, () => ok(11) && mid(11, 11)], [23, () => ok(24) && mid(24, 24)], [24, () => ok(23) && mid(23, 23)],
      [13, () => (ok(11) && ok(15) ? mid(11, 15) : ok(11) && mid(11, 11))], [14, () => (ok(12) && ok(16) ? mid(12, 16) : ok(12) && mid(12, 12))],
      [15, () => (ok(11) && ok(13) ? ext(11, 13, 1) : ok(13) && mid(13, 13))], [16, () => (ok(12) && ok(14) ? ext(12, 14, 1) : ok(14) && mid(14, 14))],
      [25, () => (ok(23) && ok(27) ? mid(23, 27) : torso() && down(23, 0.8))], [26, () => (ok(24) && ok(28) ? mid(24, 28) : torso() && down(24, 0.8))],
      [27, () => (ok(23) && ok(25) ? ext(23, 25, 1) : null)], [28, () => (ok(24) && ok(26) ? ext(24, 26, 1) : null)],
      [0, () => torso() && ((i) => down(11, -0.45)(i).map((v, c) => (v + down(12, -0.45)(i)[c]) / 2))],
    ];
    for (let pass = 0; pass < 4 && never.size; pass++) for (const [id, rule] of rules) if (J[id] != null && never.has(J[id])) { const fn = rule(); if (fn) put(id, fn); }
    for (const j of never) for (let c = 0; c < dims; c++) P[j][c].fill(c < 2 ? 0.5 : 0);            // nothing to go by: the middle of the picture
  }

  // --- 2. take the jitter out (One Euro, both ways) ---
  if (cfg.smooth) {
    for (let j = 0; j < M; j++) for (let c = 0; c < dims; c++) P[j][c] = euroBoth(P[j][c], T, cfg.smooth);
  }

  // lengths are measured in units of the picture's width: y is stretched by 1 / aspect, z is already in x's scale
  const vec = (a, b, i) => [P[b][0][i] - P[a][0][i], (P[b][1][i] - P[a][1][i]) / asp, D ? P[b][2][i] - P[a][2][i] : 0];
  const setFrom = (a, b, i, v) => { P[b][0][i] = P[a][0][i] + v[0]; P[b][1][i] = P[a][1][i] + v[1] * asp; if (D) P[b][2][i] = P[a][2][i] + v[2]; };
  const norm = (v) => Math.hypot(v[0], v[1], v[2]);

  // --- 3. keep the bones the same length ---
  // Each of the 8 bones gets one length for the whole ghost. For "full" it is the median of its 3D length.
  // For "clamp" it is the longest the bone is normally drawn (90th percentile on screen), or the 3D median if that is longer;
  // a limb near the camera is drawn a little bigger, so the plain median would pull in limbs that are not stretched at all.
  // boneLock "full" (or true): every frame, the bone keeps its direction and is set to that length (the far end is moved).
  //   What is seen on screen then also moves whenever the depth is wrong, so noisy depth becomes sideways jitter.
  // boneLock "clamp": the picture is trusted more than the depth. Only a bone drawn longer than its length is pulled in
  //   (an arm cannot stretch); a bone drawn shorter is left alone (it may be pointing at the camera). Depth is not touched.
  // A ghost without depth is always treated as "clamp".
  const lockMode = cfg.boneLock === true ? "full" : cfg.boneLock || null;
  const limbs = LIMBS.filter(([a, b]) => J[a] != null && J[b] != null).map(([a, b]) => [J[a], J[b]]);
  const lens = limbs.map(([a, b]) => {
    const both = [], all = [], flatBoth = [], flatAll = [];
    for (let i = 0; i < N; i++) {
      const v = vec(a, b, i), l = norm(v), f = Math.hypot(v[0], v[1]);
      all.push(l); flatAll.push(f);
      if (rawSeen[a][i] && rawSeen[b][i]) { both.push(l); flatBoth.push(f); }
    }
    const ok = both.length >= 3, space = D ? median(ok ? both : all) : 0;
    return D && lockMode === "full" ? space : Math.max(space, percentile(ok ? flatBoth : flatAll, 0.9));
  });
  const lenOf = (a, b) => { const k = limbs.findIndex((l) => l[0] === a && l[1] === b); return k < 0 ? 0 : lens[k]; };
  info.lengths = lens.map((l) => +l.toFixed(4));
  if (lockMode) {
    limbs.forEach(([a, b], n) => {                                  // parents first: shoulder → elbow → wrist, hip → knee → ankle
      const L = lens[n]; if (!(L > 0)) return;
      for (let i = 0; i < N; i++) {
        const v = vec(a, b, i);
        if (D && lockMode === "full") { const l = norm(v); if (l > 1e-6) setFrom(a, b, i, v.map((x) => (x * L) / l)); continue; }
        const flat = Math.hypot(v[0], v[1]);
        if (flat > L) setFrom(a, b, i, [(v[0] * L) / flat, (v[1] * L) / flat, v[2]]);
      }
    });
  }

  // --- 4. plant the feet ---
  const lockW = pts.map(() => null);                                // per ankle: how firmly it is held, 0–1 per frame
  if (cfg.footLock && N > 2) {
    const { speed = 0.15, blendMs = 80, drift = 0.02 } = cfg.footLock;
    for (const [hipId, kneeId, ankleId] of LEGS) {
      const h = J[hipId], kn = J[kneeId], an = J[ankleId];
      if (h == null || kn == null || an == null) continue;
      const X = P[an][0], Y = P[an][1];
      // speed of the ankle in picture heights a second
      const slow = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), dt = Math.max(1, T[b] - T[a]) / 1000;
        slow[i] = Math.hypot((X[b] - X[a]) * asp, Y[b] - Y[a]) / dt < speed ? 1 : 0;
      }
      // runs of slow frames; a run ends early when the foot has crept further than `drift` from where it was planted
      const runs = [];
      for (let i = 0; i < N; i++) {
        if (!slow[i]) continue;
        let e = i;
        while (e + 1 < N && slow[e + 1] && Math.hypot((X[e + 1] - X[i]) * asp, Y[e + 1] - Y[i]) <= drift) e++;
        if (e > i) runs.push([i, e]);
        i = e;
      }
      if (!runs.length) continue;
      const src = P[an].map((a) => Float64Array.from(a)), w = new Float32Array(N), tgt = P[an].map((a) => Float64Array.from(a));
      for (const [s, e] of runs) {
        const set = (i, k) => { if (k > w[i]) { w[i] = k; for (let c = 0; c < dims; c++) tgt[c][i] = src[c][s]; } };
        for (let i = s; i <= e; i++) set(i, 1);
        for (let i = s - 1; i >= 0 && T[s] - T[i] < blendMs; i--) set(i, 1 - (T[s] - T[i]) / blendMs);
        for (let i = e + 1; i < N && T[i] - T[e] < blendMs; i++) set(i, 1 - (T[i] - T[e]) / blendMs);
      }
      lockW[an] = w;
      for (let i = 0; i < N; i++) {
        if (!w[i]) continue;
        // the lengths this leg had before the ankle moved (or the locked ones)
        const l1 = D && lockMode === "full" && lenOf(h, kn) > 0 ? lenOf(h, kn) : norm(vec(h, kn, i));
        const l2 = D && lockMode === "full" && lenOf(kn, an) > 0 ? lenOf(kn, an) : norm(vec(kn, an, i));
        for (let c = 0; c < dims; c++) P[an][c][i] = src[c][i] + (tgt[c][i] - src[c][i]) * w[i];
        // "full": the knee goes back between hip and ankle, on the side it was bending to (two-bone joint).
        // otherwise the knee simply follows by half of what the ankle moved, so that noisy depth cannot push it sideways
        if (!(D && lockMode === "full")) { for (let c = 0; c < dims; c++) P[kn][c][i] += ((tgt[c][i] - src[c][i]) * w[i]) / 2; continue; }
        let toA = vec(h, an, i), d = norm(toA);
        if (d < 1e-6 || l1 < 1e-6 || l2 < 1e-6) continue;
        const reach = (l1 + l2) * 0.999;
        if (d > reach) { toA = toA.map((x) => (x * reach) / d); d = reach; setFrom(h, an, i, toA); }  // too far to reach: the ankle gives way, the leg does not stretch
        const dir = toA.map((x) => x / d), toK = vec(h, kn, i), along = toK[0] * dir[0] + toK[1] * dir[1] + toK[2] * dir[2];
        let bend = toK.map((x, c) => x - dir[c] * along), bl = norm(bend);
        if (bl < 1e-6) { bend = D ? [0, 0, -1] : [dir[1], -dir[0], 0]; const k = bend[0] * dir[0] + bend[1] * dir[1] + bend[2] * dir[2]; bend = bend.map((x, c) => x - dir[c] * k); bl = norm(bend) || 1; }
        const a = Math.max(-l1, Math.min(l1, (l1 * l1 - l2 * l2 + d * d) / (2 * d))), up = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        setFrom(h, kn, i, dir.map((x, c) => x * a + (bend[c] / bl) * up));
      }
    }
  }

  // --- 6. facing, frame by frame, steadied with the same filter ---
  let yawS = null, yawH = null;
  if (D && J[L_SHOULDER] != null && J[R_SHOULDER] != null) {
    const yaws = (l, r) => {
      if (J[l] == null || J[r] == null) return null;
      const a = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const y = (Math.atan2(P[J[r]][2][i] - P[J[l]][2][i], P[J[l]][0][i] - P[J[r]][0][i]) * 180) / Math.PI;
        a[i] = i ? a[i - 1] + wrap(y - a[i - 1]) : y;                // carried on past ±180° so a full turn stays one smooth line
      }
      return cfg.smooth ? euroBoth(a, T, cfg.smooth) : a;
    };
    yawS = yaws(L_SHOULDER, R_SHOULDER); yawH = yaws(L_HIP, R_HIP);
  }

  // --- 5. in between the frames ---
  const curve = cfg.interp !== "line";
  let hint = 0;
  const locate = (t) => {
    let i = T[hint] <= t ? hint : 0;
    while (i < N - 1 && T[i + 1] <= t) i++;
    hint = i;
    const j = Math.min(i + 1, N - 1);
    return [i, j, T[j] > T[i] ? clamp01((t - T[i]) / (T[j] - T[i])) : 0];
  };
  // slope at frame i (per ms), Catmull-Rom style; the end frames repeat their own value; a planted ankle has no slope
  const slope = (a, i, w) => {
    if (w && w[i] >= 1) return 0;
    const p = Math.max(0, i - 1), n = Math.min(N - 1, i + 1);
    const span = p === i ? 2 * (T[n] - T[i]) : n === i ? 2 * (T[i] - T[p]) : T[n] - T[p];
    return span > 0 ? (a[n] - a[p]) / span : 0;
  };
  const lerp = (a, i, j, k) => a[i] + (a[j] - a[i]) * k;

  return {
    info,
    get duration() { return T[N - 1]; },
    at(t) {
      if (!N) return null;
      const [i, j, k] = locate(t), h = T[j] - T[i], pose = {};
      const k2 = k * k, k3 = k2 * k, h00 = 2 * k3 - 3 * k2 + 1, h10 = k3 - 2 * k2 + k, h01 = -2 * k3 + 3 * k2, h11 = k3 - k2;
      for (let p = 0; p < M; p++) {
        const out = new Array(dims);
        for (let c = 0; c < dims; c++) {
          const a = P[p][c];
          out[c] = !curve || i === j ? lerp(a, i, j, k) : h00 * a[i] + h10 * h * slope(a, i, lockW[p]) + h01 * a[j] + h11 * h * slope(a, j, lockW[p]);
        }
        pose[pts[p]] = out;
      }
      return pose;
    },
    metaAt(t) {
      if (!N) return null;
      const [i, j, k] = locate(t), seenNow = {}, planted = {};
      for (let p = 0; p < M; p++) seenNow[pts[p]] = lerp(seen[p], i, j, k);
      for (const [, , ankleId] of LEGS) { const w = J[ankleId] != null && lockW[J[ankleId]]; planted[ankleId] = !!w && lerp(w, i, j, k) >= 0.5; }
      let facing = null;
      if (yawS) {
        const shoulders = wrap(lerp(yawS, i, j, k)), hips = yawH ? wrap(lerp(yawH, i, j, k)) : null, turn = Math.abs(shoulders);
        facing = { shoulders, hips, twist: hips == null ? null : wrap(shoulders - hips), side: turn >= facingCfg.backDeg ? "back" : turn >= facingCfg.sideDeg ? "side" : "front" };
      }
      return { facing, seen: seenNow, planted };
    },
  };
}
