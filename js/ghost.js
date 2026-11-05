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

// ---------- the GHOST as it should look: an ink-black samurai silhouette with a rising aura ----------
// Drawn from the same 13 points: thick limbs, a torso, wide hakama, a head with a topknot and a curved sword.
// Around it a glow that breathes, sparks that rise off the body like heat, and a fading trail behind the blade.
// Keeps its own particles, so make one renderer per ghost on screen.
export function createGhostRenderer({ aura = [120, 175, 255], core = "rgba(6,8,14,0.94)" } = {}) {
  const off = document.createElement("canvas"), o = off.getContext("2d");
  const tint = document.createElement("canvas"), tc = tint.getContext("2d");
  let sparks = [], trail = [], lastT = 0;
  const A = (a) => `rgba(${aura[0]},${aura[1]},${aura[2]},${a})`;
  return {
    // pose: from poseAt(); box: where to draw; t: ms clock for the flicker and sparks
    draw(ctx, pose, box, { aspect = 0.75, t = performance.now(), power = 1 } = {}) {
      const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
      if (!pose) { sparks = []; trail = []; return; }
      const bw = Math.min(box.w, box.h * aspect), bh = bw / aspect, ox = box.x + (box.w - bw) / 2, oy = box.y + (box.h - bh) / 2;
      const P = (i) => pose[i] && [ox + (1 - pose[i][0]) * bw, oy + pose[i][1] * bh];
      const avg = (a, b) => (a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a || b);
      const sL = P(11), sR = P(12), hL = P(23), hR = P(24);
      if (!sL || !sR) return;
      const sh = Math.hypot(sL[0] - sR[0], sL[1] - sR[1]) || bw / 6, U = Math.max(sh, bw / 9);
      if (off.width !== ctx.canvas.width || off.height !== ctx.canvas.height) { off.width = tint.width = ctx.canvas.width; off.height = tint.height = ctx.canvas.height; }
      o.clearRect(0, 0, off.width, off.height);
      o.fillStyle = o.strokeStyle = "#000"; o.lineCap = o.lineJoin = "round";
      const limb = (a, b, w) => { const A1 = P(a), B1 = P(b); if (A1 && B1) { o.lineWidth = w * U; o.beginPath(); o.moveTo(...A1); o.lineTo(...B1); o.stroke(); } };
      // torso (a little wider at the shoulders, like a kimono)
      const hipC = avg(hL, hR) || [(sL[0] + sR[0]) / 2, (sL[1] + sR[1]) / 2 + U * 1.6];
      const out = (p, from, k) => [p[0] + (p[0] - from[0]) * k, p[1] + (p[1] - from[1]) * k];
      const sc = avg(sL, sR);
      o.beginPath(); o.moveTo(...out(sL, sc, 0.25)); o.lineTo(...out(sR, sc, 0.25)); o.lineTo(...(hR || [hipC[0] + U * 0.4, hipC[1]])); o.lineTo(...(hL || [hipC[0] - U * 0.4, hipC[1]])); o.closePath(); o.fill();
      // hakama: wide from the hips, flaring towards the ankles
      const kL = P(25), kR = P(26), aL = P(27) || kL, aR = P(28) || kR;
      if (aL && aR) {
        const hl = hL || [hipC[0] - U * 0.4, hipC[1]], hr = hR || [hipC[0] + U * 0.4, hipC[1]], side = Math.sign(hr[0] - hl[0]) || 1;
        o.beginPath(); o.moveTo(hl[0] - side * U * 0.25, hl[1]); o.lineTo(hr[0] + side * U * 0.25, hr[1]);
        o.lineTo(aR[0] + side * U * 0.55, aR[1] + U * 0.1); o.lineTo((aL[0] + aR[0]) / 2, Math.min(aL[1], aR[1]) - U * 0.35); o.lineTo(aL[0] - side * U * 0.55, aL[1] + U * 0.1); o.closePath(); o.fill();
      }
      limb(11, 13, 0.34); limb(13, 15, 0.28); limb(12, 14, 0.34); limb(14, 16, 0.28); limb(11, 12, 0.4);
      limb(23, 25, 0.42); limb(25, 27, 0.32); limb(24, 26, 0.42); limb(26, 28, 0.32);
      // head and topknot
      const head = P(0) ? [P(0)[0], P(0)[1] - U * 0.12] : [sc[0], sc[1] - U * 0.75];
      o.beginPath(); o.arc(head[0], head[1], U * 0.36, 0, Math.PI * 2); o.fill();
      o.beginPath(); o.ellipse(head[0], head[1] - U * 0.42, U * 0.1, U * 0.16, 0, 0, Math.PI * 2); o.fill();
      // the sword: from the hands along the forearm, slightly curved, with a guard
      const w = avg(P(15), P(16)), e = avg(P(13), P(14));
      let blade = null;
      if (w && e) {
        const dx = w[0] - e[0], dy = w[1] - e[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, len = Math.max(L * 3.2, U * 2.6);
        const tip = [w[0] + ux * len, w[1] + uy * len], curve = [w[0] + ux * len * 0.55 - uy * U * 0.18, w[1] + uy * len * 0.55 + ux * U * 0.18];
        o.lineWidth = U * 0.09; o.beginPath(); o.moveTo(...w); o.quadraticCurveTo(...curve, ...tip); o.stroke();
        o.beginPath(); o.ellipse(w[0] + ux * U * 0.12, w[1] + uy * U * 0.12, U * 0.16, U * 0.06, Math.atan2(uy, ux) + Math.PI / 2, 0, Math.PI * 2); o.fill();
        blade = { w, curve, tip };
        trail.push({ ...blade, t });
      }
      trail = trail.filter((b) => t - b.t < 260);

      const breathe = 0.75 + 0.25 * Math.sin(t / 260) + 0.08 * Math.sin(t / 47);
      ctx.save();
      // 1) the aura: a blurred, coloured copy of the silhouette, twice, breathing.
      //    Only the shadow of the copy is drawn (the copy itself is pushed off the canvas): shadows blur in every browser.
      tc.globalCompositeOperation = "source-over"; tc.clearRect(0, 0, tint.width, tint.height); tc.drawImage(off, 0, 0);
      tc.globalCompositeOperation = "source-in"; tc.fillStyle = A(1); tc.fillRect(0, 0, tint.width, tint.height);
      const far = tint.width + 50;
      ctx.globalCompositeOperation = "lighter"; ctx.shadowOffsetX = far;
      for (const [blur, al] of [[0.25, 1], [0.7, 0.9], [1.9, 0.75]]) { ctx.shadowColor = A(al * power); ctx.shadowBlur = U * blur * breathe; ctx.drawImage(tint, -far, 0); }
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;
      // a thin rim of light right at the edge of the body
      const rim = Math.max(1.5, U * 0.05);
      ctx.globalAlpha = 0.45 * power;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.drawImage(tint, Math.cos(a) * rim, Math.sin(a) * rim); }
      ctx.globalAlpha = 1;
      // 2) the blade's afterimage
      trail.forEach((b, i) => {
        const k = 1 - (t - b.t) / 260;
        ctx.strokeStyle = A(0.5 * k * power); ctx.lineWidth = U * 0.12 * k + 1; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(...b.w); ctx.quadraticCurveTo(...b.curve, ...b.tip); ctx.stroke();
      });
      // 3) the body itself, ink black
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1; ctx.drawImage(off, 0, 0);
      ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = core; ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.globalCompositeOperation = "source-over";
      // the edge of the blade catches the light
      if (blade) { ctx.strokeStyle = A(0.9); ctx.lineWidth = Math.max(1, U * 0.025); ctx.beginPath(); ctx.moveTo(...blade.w); ctx.quadraticCurveTo(...blade.curve, ...blade.tip); ctx.stroke(); }
      // 4) sparks rising off the body like heat
      const bones = [[11, 23], [12, 24], [11, 13], [12, 14], [13, 15], [14, 16], [23, 25], [24, 26], [0, 0]];
      let n = dt * 110 * power;
      while (n-- > Math.random()) {
        const [a, b] = bones[(Math.random() * bones.length) | 0], A1 = P(a), B1 = P(b) || A1;
        if (!A1) continue;
        const k = Math.random(), x = A1[0] + (B1[0] - A1[0]) * k + (Math.random() - 0.5) * U * 0.5, y = A1[1] + (B1[1] - A1[1]) * k;
        sparks.push({ x, y, vx: (Math.random() - 0.5) * U * 0.4, vy: -U * (1.0 + Math.random() * 1.6), life: 0, max: 0.5 + Math.random() * 0.8, r: U * (0.015 + Math.random() * 0.035) });
      }
      ctx.globalCompositeOperation = "lighter";
      sparks = sparks.filter((p) => (p.life += dt) < p.max);
      for (const p of sparks) {
        p.x += p.vx * dt + Math.sin((t + p.y) / 180) * U * 0.01; p.y += p.vy * dt;
        const k = 1 - p.life / p.max, r = p.r * (0.6 + k);
        // a small flame: bright core, stretched along its rise
        ctx.fillStyle = A(0.9 * k); ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 3.5, Math.atan2(p.vx, -p.vy), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
  };
}
