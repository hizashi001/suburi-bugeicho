// stand-in for MediaPipe: a body that swings straight down every 2 seconds, then slowly raises the sword again
function frame(ts) {
  const c = (ts % 2000) / 1000;
  let h;
  if (c < 0.5) h = -0.9; else if (c < 0.75) h = -0.9 + ((c - 0.5) / 0.25) * 1.0; else if (c < 1.2) h = 0.1; else h = 0.1 - ((c - 1.2) / 0.8) * 1.0;
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: -0.3, z: 0, visibility: 0.99 }));
  const set = (i, x, y, z) => (wl[i] = { x, y, z, visibility: 0.99 });
  set(0, 0, -0.62, -0.05); set(11, 0.18, -0.45, 0); set(12, -0.18, -0.45, 0); set(23, 0.1, 0, 0); set(24, -0.1, 0, 0);
  set(13, 0.2, -0.2, -0.1); set(14, -0.2, -0.2, -0.1); set(15, 0.03, h, -0.25); set(16, -0.03, h, -0.25);
  const lm = wl.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.62 + p.y * 0.42, z: p.z, visibility: 0.99 }));
  return { landmarks: [lm], worldLandmarks: [wl] };
}
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const PoseLandmarker = { createFromOptions: async () => ({ detectForVideo: (v, ts) => frame(ts) }) };
