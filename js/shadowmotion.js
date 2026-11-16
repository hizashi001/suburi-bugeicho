// 影の動き (shadow motion): what a ghost's pose says about the body, apart from how it is drawn.
// Stage 0 of docs/設計_影の見た目.md holds only the facing (front / side / back) and the twist.
// Stage 1 adds the clean-up here (jitter filter, in-between frames, bone lengths, unseen points, planted feet).
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
