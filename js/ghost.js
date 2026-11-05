// 影 (GHOST): a recorded performance kept as skeleton data, not video (企画書「影は動画ではなく骨格のデータ」).
// Recording, the store on this phone (IndexedDB), files to send to others, and drawing a ghost.
// A ghost file (.ghost.json):
//   { format: "ghost/1", id, name, kind: "fight" | "kata", master, created, fps, aspect,
//     points: [landmark indices], frames: [[t ms, x, y, x, y, …], …]  (camera picture 0–1, not mirrored, -1 = not seen),
//     events: [[t ms, type, …], …], plus meta for fights: weapon, division, diff, yokai, result }

export const FORMAT = "ghost/1";
// nose, shoulders, elbows, wrists, hips, knees, ankles: enough to draw a body and a sword
export const POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

// ---------- recording ----------
export function createGhostRecorder({ fps = 15, minVis = 0.3 } = {}) {
  let g = null, t0 = 0, lastAt = -1e9;
  return {
    get active() { return !!g; },
    start(meta = {}) {
      g = { format: FORMAT, id: "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: new Date().toISOString(),
        fps, points: POINTS, frames: [], events: [], kind: "fight", master: false, name: "", ...meta };
      t0 = performance.now(); lastAt = -1e9;
    },
    // lm: one person's landmarks (camera picture 0–1); aspect: picture width / height
    frame(lm, now = performance.now(), aspect) {
      if (!g || !lm || now - lastAt < 1000 / fps) return;
      lastAt = now;
      if (aspect && !g.aspect) g.aspect = +aspect.toFixed(4);
      const row = [Math.round(now - t0)];
      for (const i of POINTS) {
        const p = lm[i];
        if (p && (p.visibility ?? 1) >= minVis) row.push(+p.x.toFixed(3), +p.y.toFixed(3)); else row.push(-1, -1);
      }
      g.frames.push(row);
    },
    event(type, ...data) { if (g) g.events.push([Math.round(performance.now() - t0), type, ...data]); },
    // returns the finished ghost (or null when nothing was recorded); nothing is saved here
    stop(extra = {}) {
      const out = g; g = null;
      if (!out || out.frames.length < 2) return null;
      Object.assign(out, extra);
      out.durationMs = out.frames[out.frames.length - 1][0];
      return out;
    },
    cancel() { g = null; },
  };
}

// ---------- the store on this phone ----------
// two object stores: "meta" (small, for the list) and "data" (the frames)
function db() {
  return (db.p ||= new Promise((ok, ng) => {
    const r = indexedDB.open("ghost-store", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("meta", { keyPath: "id" }); r.result.createObjectStore("data", { keyPath: "id" }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error);
  }));
}
const req = (r) => new Promise((ok, ng) => { r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error); });
export const metaOf = (g) => { const { frames, events, ...m } = g; return { ...m, frameCount: frames.length, swingCount: events.filter((e) => e[1] === "swing").length }; };
export const ghostStore = {
  async save(g) {
    const d = await db(), tx = d.transaction(["meta", "data"], "readwrite");
    tx.objectStore("meta").put(metaOf(g)); tx.objectStore("data").put(g);
    await new Promise((ok, ng) => { tx.oncomplete = ok; tx.onerror = () => ng(tx.error); });
  },
  async list() { const d = await db(); const all = await req(d.transaction("meta").objectStore("meta").getAll()); return all.sort((a, b) => (a.created < b.created ? 1 : -1)); },
  async get(id) { const d = await db(); return req(d.transaction("data").objectStore("data").get(id)); },
  async remove(id) {
    const d = await db(), tx = d.transaction(["meta", "data"], "readwrite");
    tx.objectStore("meta").delete(id); tx.objectStore("data").delete(id);
    await new Promise((ok) => (tx.oncomplete = ok));
  },
  // keep at most `max` automatic fight ghosts; starred, master and kata ghosts are never thrown away
  async trim(max) {
    const auto = (await this.list()).filter((m) => m.kind === "fight" && !m.master && !m.starred);
    for (const m of auto.slice(max)) await this.remove(m.id);
  },
  async update(id, patch) { const g = await this.get(id); if (!g) return; Object.assign(g, patch); await this.save(g); },
};

// ---------- files ----------
export function ghostFile(g) {
  const safe = (g.name || g.id).replace(/[^\w぀-ヿ一-鿿-]+/g, "_").slice(0, 40);
  return new File([JSON.stringify(g)], `${safe}.ghost.json`, { type: "application/json" });
}
export async function readGhostFile(file) {
  const g = JSON.parse(await file.text());
  if (g.format !== FORMAT || !Array.isArray(g.frames) || !Array.isArray(g.points) || g.frames.length < 2) throw new Error("not a ghost file");
  return g;
}

// ---------- playback ----------
// the pose at time t (ms), in between two recorded frames; points not seen in either frame stay unseen
export function poseAt(g, t) {
  const F = g.frames;
  if (!F.length) return null;
  let i = poseAt.i && poseAt.g === g && F[poseAt.i] && F[poseAt.i][0] <= t ? poseAt.i : 0;
  while (i < F.length - 1 && F[i + 1][0] <= t) i++;
  poseAt.g = g; poseAt.i = i;
  const a = F[i], b = F[Math.min(i + 1, F.length - 1)], k = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
  const pose = {};
  g.points.forEach((p, j) => {
    const ax = a[1 + j * 2], ay = a[2 + j * 2], bx = b[1 + j * 2], by = b[2 + j * 2];
    if (ax < 0 && bx < 0) return;
    pose[p] = ax < 0 ? [bx, by] : bx < 0 ? [ax, ay] : [ax + (bx - ax) * k, ay + (by - ay) * k];
  });
  return pose;
}

// draws a grey shadow body with a sword. box: { x, y, w, h } on the canvas; the picture is mirrored like a selfie.
export function drawGhost(ctx, pose, box, { color = "rgba(200,205,215,0.55)", width = 0, aspect = 0.75 } = {}) {
  if (!pose) return;
  // fit the camera picture (aspect w/h) inside the box, centred
  const bw = Math.min(box.w, box.h * aspect), bh = bw / aspect, ox = box.x + (box.w - bw) / 2, oy = box.y + (box.h - bh) / 2;
  const P = (i) => pose[i] && [ox + (1 - pose[i][0]) * bw, oy + pose[i][1] * bh];
  const lw = width || Math.max(3, bw / 40);
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
  for (const [a, b] of BONES) { const A = P(a), B = P(b); if (A && B) { ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); } }
  const sh = P(11) && P(12) ? Math.hypot(P(11)[0] - P(12)[0], P(11)[1] - P(12)[1]) : bw / 6;
  const head = P(0) || (P(11) && P(12) ? [(P(11)[0] + P(12)[0]) / 2, (P(11)[1] + P(12)[1]) / 2 - sh * 0.6] : null);
  if (head) { ctx.beginPath(); ctx.arc(head[0], head[1], sh * 0.32, 0, Math.PI * 2); ctx.fill(); }
  // the sword: from the hands, along the forearm, about three forearms long
  const w = P(15) && P(16) ? [(P(15)[0] + P(16)[0]) / 2, (P(15)[1] + P(16)[1]) / 2] : P(15) || P(16);
  const e = P(13) && P(14) ? [(P(13)[0] + P(14)[0]) / 2, (P(13)[1] + P(14)[1]) / 2] : P(13) || P(14);
  if (w && e) {
    const dx = w[0] - e[0], dy = w[1] - e[1], L = Math.hypot(dx, dy) || 1, len = Math.max(L * 3, sh * 2.2);
    ctx.lineWidth = lw * 0.6; ctx.beginPath(); ctx.moveTo(...w); ctx.lineTo(w[0] + (dx / L) * len, w[1] + (dy / L) * len); ctx.stroke();
  }
  ctx.restore();
}
