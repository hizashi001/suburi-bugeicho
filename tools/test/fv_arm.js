// stand-in for MediaPipe: a whole body in 3D (metres, hips at 0, y down, z toward the camera negative), cutting 真っ向 every 1.6 s
function frame(ts) {
  const c = (ts % 1600) / 1600, up = c < 0.35 ? c / 0.35 : c < 0.5 ? 1 - (c - 0.35) / 0.15 : 0;
  const turn = Math.sin(ts / 2500) * 0.25; // the body turns a little, to show it is 3D
  const P = {}, set = (i, x, y, z) => (P[i] = { x: x * Math.cos(turn) + z * Math.sin(turn), y, z: -x * Math.sin(turn) + z * Math.cos(turn), visibility: 0.99 });
  set(0, 0, -0.62, -0.08); set(2, 0.03, -0.66, -0.06); set(5, -0.03, -0.66, -0.06); set(7, 0.07, -0.63, 0.02); set(8, -0.07, -0.63, 0.02);
  set(11, 0.18, -0.45, 0); set(12, -0.18, -0.45, 0);
  const wy = -0.15 - up * 0.65, wz = -0.35 + up * 0.15, ey = -0.25 - up * 0.35;
  set(13, 0.2, ey, -0.18); set(14, -0.2, ey, -0.18); set(15, 0.03, wy, wz); set(16, -0.03, wy + 0.03, wz);
  if (globalThis.__armOut) { set(14, -0.45, -0.45, 0); set(16, -0.72, -0.45, 0); } // the right arm straight out to the side
  set(17, 0.03, wy - 0.03, wz - 0.02); set(18, -0.03, wy, wz - 0.02); set(19, 0.03, wy - 0.03, wz - 0.02); set(20, -0.03, wy, wz - 0.02); set(21, 0.03, wy, wz); set(22, -0.03, wy, wz);
  set(23, 0.1, 0, 0); set(24, -0.1, 0, 0); set(25, 0.14, 0.42, -0.08); set(26, -0.13, 0.42, -0.02); set(27, 0.16, 0.82, 0.02); set(28, -0.15, 0.82, 0.08);
  set(29, 0.16, 0.86, 0.06); set(30, -0.15, 0.86, 0.12); set(31, 0.18, 0.88, -0.1); set(32, -0.17, 0.88, -0.04); set(1, 0.02, -0.66, -0.07); set(3, 0.05, -0.66, -0.05); set(4, -0.02, -0.66, -0.07); set(6, -0.05, -0.66, -0.05); set(9, 0.02, -0.57, -0.08); set(10, -0.02, -0.57, -0.08);
  const wl = Array.from({ length: 33 }, (_, i) => P[i]);
  const lm = wl.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.55 + p.y * 0.42, z: p.z, visibility: 0.99 }));
  return { landmarks: [lm], worldLandmarks: [wl] };
}
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const PoseLandmarker = { createFromOptions: async () => ({ detectForVideo: (v, ts) => frame(ts) }) };
