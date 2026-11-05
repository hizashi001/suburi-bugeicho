// writes a fake MediaPipe whose hands move from A to B in `dur` seconds every 2 s, then drift back slowly
const fs = require('fs');
const [out, ax, ay, bx, by, dur] = process.argv.slice(2);
fs.writeFileSync(out, `
const A = [${ax}, ${ay}], Bp = [${bx}, ${by}], D = ${dur};
function frame(ts) {
  const c = (ts % 2000) / 1000; let u;
  if (c < 0.5) u = 0; else if (c < 0.5 + D) u = (c - 0.5) / D; else if (c < 1.2) u = 1; else u = 1 - (c - 1.2) / 0.8;
  const hx = A[0] + (Bp[0] - A[0]) * u, hy = A[1] + (Bp[1] - A[1]) * u;
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: -0.3, z: 0, visibility: 0.99 }));
  const set = (i, x, y, z) => (wl[i] = { x, y, z, visibility: 0.99 });
  set(0, 0, -0.62, -0.05); set(11, 0.18, -0.45, 0); set(12, -0.18, -0.45, 0); set(23, 0.1, 0, 0); set(24, -0.1, 0, 0);
  set(13, 0.2, -0.2, -0.1); set(14, -0.2, -0.2, -0.1); set(15, hx + 0.03, hy, -0.25); set(16, hx - 0.03, hy, -0.25);
  const lm = wl.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.62 + p.y * 0.42, z: p.z, visibility: 0.99 }));
  return { landmarks: [lm], worldLandmarks: [wl] };
}
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const PoseLandmarker = { createFromOptions: async () => ({ detectForVideo: (v, ts) => frame(ts) }) };
`);
