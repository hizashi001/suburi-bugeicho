// Keeps a 鬼面 on the player's face from the pose landmarks (MediaPipe Pose, 33 points).
// While both eyes are seen, it learns where the head sits relative to the torso (shoulders → hips) and how big it is.
// When the eyes are lost — a spin, the sword across the face — it carries on from the torso,
// so the mask never drops off for a moment and shows the face. Pure logic: no drawing, no camera.

const EYE_L = 2, EYE_R = 5, SH_L = 11, SH_R = 12, HIP_L = 23, HIP_R = 24;
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// opts: smooth 0–1 (higher = steadier but slower), eyeVis / bodyVis = how sure a point must be, holdMs = how long to keep
// the last place when even the body is lost
export function createMaskFit({ smooth = 0.5, eyeVis = 0.5, bodyVis = 0.3, holdMs = 1500 } = {}) {
  let model = null;          // head relative to the torso, learned while the eyes are seen
  let eyes = null, lastAt = -1e9, source = "none";

  // the torso as a little frame: its top (shoulder middle), its length and its tilt
  function torso(P, ok) {
    if (!ok(SH_L) || !ok(SH_R)) return null;
    const top = mid(P(SH_L), P(SH_R));
    if (ok(HIP_L) && ok(HIP_R)) {
      const hip = mid(P(HIP_L), P(HIP_R)), len = dist(top, hip);
      if (len > 1) return { top, len, ang: Math.atan2(top[0] - hip[0], hip[1] - top[1]) };
    }
    // hips out of the picture: shoulder width stands in for the length (it shrinks while turning, so only as a fallback)
    const w = dist(P(SH_L), P(SH_R));
    return w > 1 && model ? { top, len: w * model.lenPerShoulder, ang: 0 } : null;
  }
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

  // lm: landmarks of one person; toCanvas(p) → [x, y] on the picture (mirroring and cropping already applied)
  // returns the two eye points, left to right on the picture, or null
  function update(lm, now, toCanvas) {
    let target = null;
    if (lm) {
      const P = (i) => toCanvas(lm[i]);
      const ok = (i) => (lm[i].visibility ?? 1) >= bodyVis;
      const T = torso(P, ok);
      if ((lm[EYE_L].visibility ?? 1) >= eyeVis && (lm[EYE_R].visibility ?? 1) >= eyeVis) {
        target = [P(EYE_L), P(EYE_R)].sort((a, b) => a[0] - b[0]);
        source = "eyes";
        if (T) {
          // learn: the eye middle from the shoulder middle, in torso lengths, in the torso's own frame
          const m = mid(...target), off = rot([m[0] - T.top[0], m[1] - T.top[1]], -T.ang);
          const fresh = { off: [off[0] / T.len, off[1] / T.len], ipd: dist(...target) / T.len,
            tilt: Math.atan2(target[1][1] - target[0][1], target[1][0] - target[0][0]) - T.ang,
            lenPerShoulder: ok(HIP_L) && ok(HIP_R) ? T.len / Math.max(1, dist(P(SH_L), P(SH_R))) : model ? model.lenPerShoulder : 1.6 };
          const k = model ? 0.9 : 0; // a slow average, so one odd frame does not spoil it
          model = model ? { off: [model.off[0] * k + fresh.off[0] * (1 - k), model.off[1] * k + fresh.off[1] * (1 - k)], ipd: model.ipd * k + fresh.ipd * (1 - k),
            tilt: model.tilt * k + fresh.tilt * (1 - k), lenPerShoulder: model.lenPerShoulder * k + fresh.lenPerShoulder * (1 - k) } : fresh;
        }
      } else if (T && model) {
        // the eyes are hidden: put the head where the torso says it is
        const o = rot([model.off[0] * T.len, model.off[1] * T.len], T.ang), m = [T.top[0] + o[0], T.top[1] + o[1]];
        const half = (model.ipd * T.len) / 2, a = model.tilt + T.ang;
        target = [[m[0] - half * Math.cos(a), m[1] - half * Math.sin(a)], [m[0] + half * Math.cos(a), m[1] + half * Math.sin(a)]];
        source = "body";
      }
    }
    if (target) {
      const k = eyes && now - lastAt < 400 ? smooth : 0;
      eyes = eyes ? eyes.map((e, i) => [e[0] * k + target[i][0] * (1 - k), e[1] * k + target[i][1] * (1 - k)]) : target;
      lastAt = now;
    } else if (now - lastAt > holdMs) { eyes = null; source = "none"; }
    else source = "held";
    return eyes;
  }
  return { update, get source() { return source; }, get learned() { return !!model; } };
}
