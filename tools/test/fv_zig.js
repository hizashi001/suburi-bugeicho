// hands sweep down and up without ever stopping (shinmen ⇄ kiriage), 0.45 s per stroke, for 4 s; then rest 2 s
function frame(ts) {
  const c = (ts % 6000) / 1000;
  let hy;
  if (c < 4) { const ph = (c / 0.45) % 2; const u = ph < 1 ? ph : 2 - ph; hy = -0.75 + 0.85 * (0.5 - 0.5 * Math.cos(Math.PI * u)); }
  else hy = -0.75;
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: -0.3, z: 0, visibility: 0.99 }));
  const set = (i, x, y, z) => (wl[i] = { x, y, z, visibility: 0.99 });
  set(0, 0, -0.62, -0.05); set(11, 0.18, -0.45, 0); set(12, -0.18, -0.45, 0); set(23, 0.1, 0, 0); set(24, -0.1, 0, 0);
  set(13, 0.2, -0.2, -0.1); set(14, -0.2, -0.2, -0.1); set(15, 0.03, hy, -0.25); set(16, -0.03, hy, -0.25);
  const lm = wl.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.62 + p.y * 0.42, z: p.z, visibility: 0.99 }));
  return { landmarks: [lm], worldLandmarks: [wl] };
}
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const PoseLandmarker = { createFromOptions: async () => ({ detectForVideo: (v, ts) => frame(ts) }) };
