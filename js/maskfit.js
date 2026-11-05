// Keeps a 鬼面 on the player's face from the pose landmarks (MediaPipe Pose, 33 points).
// - While both eyes are seen, it learns where the head sits relative to the torso (shoulders → hips) and how big it is.
//   When the eyes are lost (a spin, the sword across the face) it carries on from the torso.
// - The size is held when it suddenly shrinks (turning side-on), so the face is still covered when it comes back,
//   and on coming back it snaps straight onto the face without easing in.
// - The tilt follows the head only gently: pose eye points jitter, and a wobbling mask looks wrong.
// Pure logic: no drawing, no camera.

const NOSE = 0, EYE_L = 2, EYE_R = 5, SH_L = 11, SH_R = 12, HIP_L = 23, HIP_R = 24;
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const lerp = (a, b, k) => a * k + b * (1 - k);

// opts: smooth 0–1 position easing; tiltSmooth easing of the tilt; tiltGain how much of the head tilt to follow;
// maxTilt (degrees); sizeHold how much of the recent size is kept when it shrinks fast; sizeDecay share of the size
// that may be lost per second; eyeVis/bodyVis how sure a point must be; holdMs how long to keep the last place
export function createMaskFit({ smooth = 0.5, tiltSmooth = 0.8, tiltGain = 0.7, maxTilt = 25, sizeHold = 0.9, sizeDecay = 0.25,
  eyeVis = 0.5, bodyVis = 0.3, holdMs = 1500 } = {}) {
  let model = null;              // head relative to the torso, learned while the eyes are seen
  let face = null;               // { mid, ipd, ang, nose: [along, down] in eye-spacings }
  let lastAt = -1e9, prevSource = "none", source = "none", sizeRef = 0, lastT = 0;

  function torso(P, ok) {
    if (!ok(SH_L) || !ok(SH_R)) return null;
    const top = mid(P(SH_L), P(SH_R));
    if (ok(HIP_L) && ok(HIP_R)) {
      const hip = mid(P(HIP_L), P(HIP_R)), len = dist(top, hip);
      if (len > 1) return { top, len, ang: Math.atan2(top[0] - hip[0], hip[1] - top[1]) };
    }
    const w = dist(P(SH_L), P(SH_R));   // hips out of the picture: shoulder width stands in (only as a fallback)
    return w > 1 && model ? { top, len: w * model.lenPerShoulder, ang: 0 } : null;
  }

  // lm: landmarks of one person; toCanvas(p) → [x, y] on the picture (mirroring and cropping already applied).
  // Returns { l, r, mid, ipd, ang, nose } (eye points left to right, nose tip) or null.
  function update(lm, now, toCanvas) {
    const dt = Math.min(0.5, Math.max(0, (now - lastT) / 1000)); lastT = now;
    let m = null;   // this frame's measure: { mid, ipd, ang, nose }
    if (lm) {
      const P = (i) => toCanvas(lm[i]);
      const vis = (i) => lm[i].visibility ?? 1;
      const ok = (i) => vis(i) >= bodyVis;
      const T = torso(P, ok);
      if (vis(EYE_L) >= eyeVis && vis(EYE_R) >= eyeVis) {
        const [l, r] = [P(EYE_L), P(EYE_R)].sort((a, b) => a[0] - b[0]);
        const c = mid(l, r), ipd = Math.max(1, dist(l, r)), ang = Math.atan2(r[1] - l[1], r[0] - l[0]);
        // the nose tip in the face's own frame (along the eye line, down the face), in eye-spacings
        const nv = vis(NOSE) >= eyeVis ? rot([P(NOSE)[0] - c[0], P(NOSE)[1] - c[1]], -ang) : null;
        const nose = nv ? [nv[0] / ipd, nv[1] / ipd] : model ? model.nose : [0, 0.75];
        m = { mid: c, ipd, ang, nose };
        source = "eyes";
        if (T) {
          const off = rot([c[0] - T.top[0], c[1] - T.top[1]], -T.ang);
          const fresh = { off: [off[0] / T.len, off[1] / T.len], ipd: ipd / T.len, tilt: ang - T.ang, nose,
            lenPerShoulder: ok(HIP_L) && ok(HIP_R) ? T.len / Math.max(1, dist(P(SH_L), P(SH_R))) : model ? model.lenPerShoulder : 1.6 };
          const k = model ? 0.9 : 0;   // a slow average, so one odd frame does not spoil it
          model = model ? { off: [lerp(model.off[0], fresh.off[0], k), lerp(model.off[1], fresh.off[1], k)], ipd: lerp(model.ipd, fresh.ipd, k),
            tilt: lerp(model.tilt, fresh.tilt, k), nose: [lerp(model.nose[0], nose[0], k), lerp(model.nose[1], nose[1], k)],
            lenPerShoulder: lerp(model.lenPerShoulder, fresh.lenPerShoulder, k) } : fresh;
        }
      } else if (T && model) {
        // the eyes are hidden: put the head where the torso says it is
        const o = rot([model.off[0] * T.len, model.off[1] * T.len], T.ang);
        m = { mid: [T.top[0] + o[0], T.top[1] + o[1]], ipd: model.ipd * T.len, ang: model.tilt + T.ang, nose: model.nose };
        source = "body";
      }
    }
    if (m) {
      // coming back from the body estimate (or from nothing): snap onto the face at once
      const snap = !face || now - lastAt > 400 || (prevSource !== "eyes" && source === "eyes");
      const k = snap ? 0 : smooth, ka = snap ? 0 : tiltSmooth;
      // the size never drops fast: hold most of the recent size, let it shrink only slowly
      sizeRef = Math.max(m.ipd, sizeRef * (1 - sizeDecay * dt));
      const ipd = Math.max(m.ipd, sizeRef * sizeHold);
      const lim = (maxTilt * Math.PI) / 180, ang = Math.max(-lim, Math.min(lim, m.ang * tiltGain));
      face = face && !snap ? { mid: [lerp(face.mid[0], m.mid[0], k), lerp(face.mid[1], m.mid[1], k)], ipd: lerp(face.ipd, ipd, k), ang: lerp(face.ang, ang, ka),
        nose: [lerp(face.nose[0], m.nose[0], k), lerp(face.nose[1], m.nose[1], k)] } : { mid: m.mid, ipd, ang, nose: m.nose };
      lastAt = now; prevSource = source;
    } else if (now - lastAt > holdMs) { face = null; source = "none"; prevSource = "none"; sizeRef = 0; }
    else { source = "held"; prevSource = "held"; }
    if (!face) return null;
    const half = face.ipd / 2, ux = Math.cos(face.ang), uy = Math.sin(face.ang);
    const n = rot([face.nose[0] * face.ipd, face.nose[1] * face.ipd], face.ang);
    return { l: [face.mid[0] - half * ux, face.mid[1] - half * uy], r: [face.mid[0] + half * ux, face.mid[1] + half * uy],
      mid: face.mid, ipd: face.ipd, ang: face.ang, nose: [face.mid[0] + n[0], face.mid[1] + n[1]] };
  }
  return { update, get source() { return source; }, get learned() { return !!model; } };
}
