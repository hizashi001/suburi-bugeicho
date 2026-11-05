// stand-in for MediaPipe: a standing body whose head sways a little, with both eyes visible
function frame(ts) {
  const away = (ts % 3000) > 2000; // a spin: for 1 s in every 3 s the eyes are not seen
  const sway = Math.sin(ts / 700) * 0.05, tilt = Math.sin(ts / 900) * 0.01;
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: -0.3, z: 0, visibility: 0.99 }));
  const set = (i, x, y) => (wl[i] = { x, y, z: 0, visibility: 0.99 });
  set(0, sway, -0.62); set(2, sway - 0.07, -0.66 - tilt); set(5, sway + 0.07, -0.66 + tilt);
  set(11, 0.18, -0.45); set(12, -0.18, -0.45); set(23, 0.1, 0); set(24, -0.1, 0);
  const lm = wl.map((p, i) => ({ x: 0.5 + p.x * 0.5, y: 0.62 + p.y * 0.42, z: 0, visibility: away && i <= 10 ? 0.1 : 0.99 }));
  return { landmarks: [lm], worldLandmarks: [wl] };
}
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const PoseLandmarker = { createFromOptions: async () => ({ detectForVideo: (v, ts) => frame(ts) }) };
