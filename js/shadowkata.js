// 影の型 (docs/設計_影の3D.md「混ぜる案」): a made motion of a form, timed to the person's own swing and mixed with their skeleton.
// The skeleton tells when the swing starts, how fast it goes, where the hands are and which way the body faces;
// the made motion supplies what the skeleton cannot: the grip, the sword's line, an upright trunk and a set stance.
//
// Only one form is made so far: 真っ向斬り (shinmen), computed from keys (a test of the mixing, not finished animation).
// A swing is taken as shinmen when the recording says so (a "swing" event from the fight's judge), or, for recordings without
// events, when the hands come straight down fast. Everything else is shown as recorded.
//
// createKata(g, motion, lift, cfg, mode).at(t) returns joints like lift.at(t), plus J.sword (the blade's direction) and
// J.kata = { form, w, u } while a form is being shown. mode "mix" = C (made motion pulled towards the skeleton),
// "only" = B (the made motion alone; between swings the body holds the made kamae).

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---------- the made form: keys in the body's own frame (metres for a body whose hip-to-shoulder is 0.5 m) ----------
// x = the body's left, y = up from the hip centre, z = forwards. u: 0 kamae → 0.4 overhead → 0.7 the cut lands → 1 zanshin.
const SHINMEN = [
  { u: 0.0, grip: [0, 0.25, 0.32], blade: [0, 0.45, 0.89], lean: 0, step: 0 },
  { u: 0.4, grip: [0, 0.80, 0.06], blade: [0, 0.55, -0.83], lean: -2, step: 0 },
  { u: 0.55, grip: [0, 0.74, 0.34], blade: [0, 0.97, 0.25], lean: 2, step: 0.6 },
  { u: 0.7, grip: [0, 0.45, 0.48], blade: [0, 0.12, 0.99], lean: 6, step: 1 },
  { u: 0.85, grip: [0, 0.24, 0.44], blade: [0, -0.15, 0.99], lean: 4, step: 1 },
  { u: 1.0, grip: [0, 0.22, 0.42], blade: [0, -0.08, 0.99], lean: 3, step: 0.8 },
];
const FORMS = { shinmen: SHINMEN };
function keyAt(keys, u) {
  let i = 0; while (i < keys.length - 2 && keys[i + 1].u <= u) i++;
  const a = keys[i], b = keys[i + 1], k = ease((u - a.u) / (b.u - a.u));
  return { grip: lerp3(a.grip, b.grip, k), blade: norm(lerp3(a.blade, b.blade, k)), lean: a.lean + (b.lean - a.lean) * k, step: a.step + (b.step - a.step) * k };
}
const UPPER = 0.29, FORE = 0.27, REACH = (UPPER + FORE) * 0.97, CHEST = [0, 0.3, 0.3];
// the shoulder-to-hand bones placed by the two-bone joint (like tools/test/mkghosts.py), the elbow dropping down and out
function elbow(s, h, side) {
  const d = Math.max(1e-6, len(sub(h, s))), dr = mul(sub(h, s), 1 / d);
  const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d), up = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  let pole = [side * 0.5, -1, -0.3]; pole = norm(sub(pole, mul(dr, dot(pole, dr))));
  return add(add(s, mul(dr, a)), mul(pole, up));
}
// the 13 joints of the made form at u (body frame, metres)
function formBody(form, u) {
  const k = keyAt(FORMS[form], u), lean = (k.lean * Math.PI) / 180;
  const top = [0, 0.5 * Math.cos(lean), 0.5 * Math.sin(lean)];          // the shoulder centre, leaning forwards a little
  const sL = add(top, [0.19, 0, 0]), sR = add(top, [-0.19, 0, 0]);
  const g = add(k.grip, [0, 0, 0.5 * Math.sin(lean)]);
  // right hand by the guard, left hand at the pommel: 10 cm apart along the hilt
  let hR = add(g, mul(k.blade, 0.05)), hL = sub(g, mul(k.blade, 0.05));
  for (let n = 0; n < 40 && (len(sub(hL, sL)) > REACH || len(sub(hR, sR)) > REACH); n++) { hL = lerp3(CHEST, hL, 0.95); hR = lerp3(CHEST, hR, 0.95); }
  const st = k.step;                                                     // the right foot steps in as the cut lands
  return {
    0: add(top, [0, 0.22, 0.06]), 11: sL, 12: sR, 13: elbow(sL, hL, 1), 14: elbow(sR, hR, -1), 15: hL, 16: hR,
    23: [0.11, 0, 0], 24: [-0.11, 0, 0],
    25: [0.15, -0.44, -0.02], 27: [0.17, -0.87, -0.12],                  // left leg behind
    26: [-0.15, -0.43, 0.10 + 0.12 * st], 28: [-0.16, -0.86 + 0.02 * st, 0.12 + 0.16 * st],   // right leg forwards
    sc: top, blade: k.blade,
  };
}

// ---------- finding the swings in a recording ----------
function findSwings(g, motion, lift, c) {
  const T = g.frames.map((f) => f[0]), asp = g.aspect || 0.75;
  const H = T.map((t) => { const p = motion.at(t); return [(p[15][0] + p[16][0]) / 2, (p[15][1] + p[16][1]) / 2]; });   // hands, in picture units (y down)
  const vy = T.map((t, i) => (i ? ((H[i][1] - H[i - 1][1]) / (T[i] - T[i - 1])) * 1000 : 0));
  const events = (g.events || []).filter((e) => e[1] === "swing");
  const out = [];
  for (let i = 1; i < T.length; i++) {
    if (vy[i] <= c.minSpeed || (out.length && T[i] <= out[out.length - 1].e)) continue;
    let s = i; while (s > 1 && vy[s - 1] > c.minSpeed * 0.3) s--;
    let e = i; while (e < T.length - 1 && vy[e + 1] > c.minSpeed * 0.3) e++;
    let p = s; for (let k = s; k <= e; k++) if (vy[k] > vy[p]) p = k;
    const drop = H[e][1] - H[s - 1][1], side = Math.abs(H[e][0] - H[s - 1][0]) * asp;   // both in picture heights
    const ev = events.find((x) => x[0] >= T[s - 1] - c.eventWindowMs && x[0] <= T[e] + c.eventWindowMs);
    const form = events.length ? (ev && FORMS[ev[2]] ? ev[2] : null) : drop >= c.minDrop && side <= drop * c.vertical ? "shinmen" : null;
    if (form) {
      // the wind-up before it: from where the hands last started to rise, up to their highest point
      let j = s - 1; for (let k = s - 1; k >= 0 && T[s - 1] - T[k] <= 1200; k--) if (H[k][1] < H[j][1]) j = k;
      let w = j; for (let k = j; k >= 0 && T[j] - T[k] <= 1200; k--) { if (H[k][1] >= H[w][1]) w = k; else if (H[w][1] - H[k][1] > 0.02) break; }
      if (T[j] - T[w] < 150) w = Math.max(0, j - 3);
      out.push({ form, w: T[w], j: T[Math.max(j, w)], s: T[s - 1], p: T[p], e: T[e], drop });
    }
    i = e;
  }
  return out;
}

export function createKata(g, motion, lift, cfg = {}, mode = "mix") {
  const c = { fidelityArm: 0.35, fidelityBody: 0.2, minSpeed: 0.35, minDrop: 0.12, vertical: 0.6, eventWindowMs: 400, holdMs: 300, rampInMs: 150, rampOutMs: 300, ...cfg };
  const swings = findSwings(g, motion, lift, c);
  const only = mode === "only";
  // where in the made form the person is at time t, and how much of it to show
  function phase(t) {
    for (const sw of swings) {
      const a = sw.w - c.rampInMs, z = sw.e + c.holdMs + c.rampOutMs;
      if (t < a || t > z) continue;
      const keys = [[sw.w, 0], [sw.j, 0.4], [sw.p, 0.6], [sw.e, 0.8], [sw.e + c.holdMs, 1]];
      let u = 0;
      if (t >= keys[4][0]) u = 1; else for (let k = 0; k < 4; k++) if (t >= keys[k][0] && t <= keys[k + 1][0]) { const d = keys[k + 1][0] - keys[k][0]; u = keys[k][1] + (keys[k + 1][1] - keys[k][1]) * (d > 0 ? (t - keys[k][0]) / d : 1); }
      const w = t < sw.w ? (t - a) / c.rampInMs : t > sw.e + c.holdMs ? 1 - (t - sw.e - c.holdMs) / c.rampOutMs : 1;
      return { form: sw.form, u, w: ease(w), sw };
    }
    return only ? { form: "shinmen", u: 0, w: 1, sw: null } : null;      // B holds the made kamae between swings
  }
  return {
    swings, L: lift.L, hipWidth: lift.hipWidth, shoulderWidth: lift.shoulderWidth,
    at(t) {
      const J = lift.at(t), ph = phase(t);
      if (!ph || ph.w <= 0) return J;
      const f = motion.metaAt(t).facing, yaw = f && f.hips != null ? (f.hips * Math.PI) / 180 : 0;
      const left = [Math.cos(yaw), 0, Math.sin(yaw)], up = [0, 1, 0], fwd = [-Math.sin(yaw), 0, Math.cos(yaw)];
      const sc = lift.L[8] / 0.5, B = formBody(ph.form, ph.u);
      const W = (q) => add(J.hc, add(add(mul(left, q[0] * sc), mul(up, q[1] * sc)), mul(fwd, q[2] * sc)));
      const fa = only ? 0 : c.fidelityArm, fb = only ? 0 : c.fidelityBody, kA = ph.w * (1 - fa), kB = ph.w * (1 - fb);
      const out = { ...J };
      for (const i of [13, 14, 15, 16]) out[i] = lerp3(J[i], W(B[i]), kA);
      for (const i of [0, 11, 12, 23, 24, 25, 26, 27, 28]) out[i] = lerp3(J[i], W(B[i]), kB);
      out.sc = lerp3(J.sc, W(B.sc), kB);
      // the blade: the made line, turned with the body, pulled a little towards the forearms when following the person
      const made = norm(add(add(mul(left, B.blade[0]), mul(up, B.blade[1])), mul(fwd, B.blade[2])));
      const fore = norm(add(norm(sub(J[15], J[13])), norm(sub(J[16], J[14]))));
      out.sword = norm(lerp3(fore, made, ph.w * (1 - fa * 0.5)));
      out.kata = { form: ph.form, u: ph.u, w: ph.w };
      return out;
    },
  };
}
