// 影の世界観 (docs/注文書_影の世界観.md, docs/設計_影の3D.md 第3D-3.1段): the parts of the "painted" ghost that are not the body's
// bones — the shader that paints the body in a few greys, the weather (snow, ash, torn cloth, wind) that blows across and is
// stirred by the blade, the glowing eyes and the eerie light on the blade. js/shadow3d.js uses these when "paint" is chosen.

// ---------- the painted body: a few greys, a rough brush texture laid over them, edges torn away downwind ----------
export const PAINT_FRAG = [
  "uniform sampler2D tCol, tPaint; uniform vec2 res, wind; uniform float time, wob, smear, usePaint; uniform vec4 tones, cuts; varying vec2 vUv;",
  "float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
  "float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
  "  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }",
  "float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * nz(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }",
  "void main(){",
  "  float asp = res.x / res.y; vec2 q = vUv * vec2(asp, 1.0) * 4.0;",
  "  vec2 uv = vUv + (vec2(fbm(q + time * 0.1), fbm(q + 17.3 - time * 0.08)) - 0.5) * wob;",
  "  vec4 c = texture2D(tCol, uv); float m = c.a;",
  "  float b = 0.0;",
  "  for (int i = 0; i < 8; i++) { float a = float(i) / 8.0 * 6.2832; b += texture2D(tCol, uv + vec2(cos(a), sin(a)) * 6.0 / res).a; }",
  "  b /= 8.0; float inside = m * smoothstep(0.3, 1.0, b);",
  "  float L = dot(c.rgb, vec3(0.299, 0.587, 0.114)) / max(m, 0.001);",
  // a rough brush texture moves the borders between the greys, so they look painted
  "  vec2 pr = mat2(0.86, -0.5, 0.5, 0.86) * (vUv * vec2(asp, 1.0)) * 1.7;",
  "  float paint = usePaint > 0.5 ? texture2D(tPaint, pr).r : fbm(pr * 8.0);",
  "  float Lp = L + (paint - 0.5) * 0.32;",
  "  float g = tones.x;",
  "  g = mix(g, tones.y, smoothstep(cuts.x - 0.03, cuts.x + 0.03, Lp));",
  "  g = mix(g, tones.z, smoothstep(cuts.y - 0.03, cuts.y + 0.03, Lp));",
  "  g = mix(g, tones.w, smoothstep(cuts.z - 0.03, cuts.z + 0.03, Lp));",
  // the edge breaks up a little
  "  float a = m * smoothstep(0.38, 0.55, fbm(q * 3.0 + 9.0) * 0.6 + inside * 0.8);",
  // torn streaks blown downwind: a point downwind of the body takes the body from upwind, in ragged rows
  "  vec2 w = normalize(wind); vec2 side = vec2(-w.y, w.x);",
  "  float row = fbm(vec2(dot(vUv * vec2(asp, 1.0), side) * 38.0, time * 0.3));",
  "  float len = smear * (0.2 + 1.3 * smoothstep(0.45, 0.85, row));",
  "  float tr = 0.0;",
  "  for (int i = 1; i <= 10; i++) { float k = float(i) / 10.0; tr = max(tr, texture2D(tCol, uv - w * k * len).a * (1.0 - k)); }",
  "  tr *= smoothstep(0.35, 0.7, fbm(q * 6.0 + time * 0.2));",
  "  float A = max(a, tr * 0.8);",
  "  float G = mix(tones.x + 0.04, g, a / max(A, 0.001));",
  "  vec3 col = vec3(G * 0.97, G * 0.99, G * 1.03);",
  "  gl_FragColor = vec4(col * A, A);",
  "}",
].join("\n");

// ---------- pictures ----------
const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const json = (src) => fetch(src).then((r) => (r.ok ? r.json() : null)).catch(() => null);
// a black-ink sprite sheet recoloured (white for snow, grey for ash)
function tint(img, rgb) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = `rgb(${rgb.join(",")})`; x.fillRect(0, 0, c.width, c.height);
  return c;
}
export async function loadWorld(dir) {
  const [flakes, flakesJ, shreds, shredsJ, wind, paint, ...smoke] = await Promise.all([
    load(dir + "shadow_fx_flakes_01.png"), json(dir + "shadow_fx_flakes_01.json"), load(dir + "shadow_fx_shreds_01.png"), json(dir + "shadow_fx_shreds_01.json"),
    load(dir + "shadow_fx_wind_01.png"), load(dir + "shadow_fx_paint_02.png"),
    ...[1, 2, 3, 4].map((n) => load(dir + `shadow_fx_smoke_heavy_0${n}.png`)),
  ]);
  return {
    flakes: flakes && flakesJ ? { white: tint(flakes, [245, 247, 250]), grey: tint(flakes, [70, 70, 74]), rects: flakesJ.sprites } : null,
    shreds: shreds && shredsJ ? { dark: tint(shreds, [28, 28, 30]), light: tint(shreds, [225, 225, 228]), rects: shredsJ.sprites } : null,
    wind: wind ? tint(wind, [235, 238, 242]) : null, windDark: wind,
    paint, smoke: smoke.filter(Boolean),
  };
}

// ---------- weather: flakes and shreds blown by the wind, stirred by the blade ----------
// kind: "snow" | "ash" | "mist" | null. Positions are in the picture (unmirrored); the wind is given as the viewer sees it.
export function createWeather(W, cfg = {}) {
  const C = { back: 70, front: 18, speed: 0.22, gust: 0.5, stir: 0.6, stirR: 0.12, wind: [1, 0.3], ...cfg };
  let ps = [], kind = null, size = [0, 0], streak = 0;
  const seed = (bw, bh, front, anywhere) => {
    const big = front ? 1.8 + Math.random() * 2.2 : 0.4 + Math.random() * 1.1;
    return { x: anywhere ? Math.random() * bw : (C.wind[0] > 0 ? bw : 0) + (C.wind[0] > 0 ? -1 : 1) * Math.random() * bw * 0.2 - (C.wind[0] > 0 ? 0 : 0),
      y: anywhere ? Math.random() * bh : Math.random() * bh * 1.1 - bh * 0.1, vx: 0, vy: 0, s: big, front, spin: Math.random() * 6, rs: (Math.random() - 0.5) * 3,
      id: Math.floor(Math.random() * 1000), shred: Math.random() < (kind === "ash" ? 0.35 : 0.08), phase: Math.random() * 6 };
  };
  function reset(bw, bh) {
    ps = [];
    const n = kind === "mist" ? 0.4 : 1;
    for (let i = 0; i < C.back * n; i++) ps.push(seed(bw, bh, false, true));
    for (let i = 0; i < C.front * n; i++) ps.push(seed(bw, bh, true, true));
  }
  return {
    set(k, bw, bh) { if (k !== kind || size[0] !== bw || size[1] !== bh) { kind = k; size = [bw, bh]; if (kind) reset(bw, bh); else ps = []; } },
    // tip: the blade's tip on the picture now and its speed (px/s), so a cut sweeps the flakes along
    step(dt, time, tip, tipV) {
      if (!kind || dt <= 0) return;
      const [bw, bh] = size, gust = 1 + C.gust * Math.sin(time / 1700) * Math.sin(time / 610);
      const wx = -C.wind[0], wy = C.wind[1];                         // mirrored frame: the viewer's right is our left
      for (const p of ps) {
        const sp = C.speed * bw * (p.front ? 1.6 : 0.6 + 0.4 * p.s) * gust;
        p.vx += (wx * sp - p.vx) * Math.min(1, dt * 2); p.vy += (wy * sp + Math.sin(time / 500 + p.phase) * bw * 0.03 - p.vy) * Math.min(1, dt * 2);
        if (tip && tipV) {
          const d = Math.hypot(p.x - tip[0], p.y - tip[1]), R = C.stirR * bw;
          if (d < R) { const k = (1 - d / R) * C.stir; p.vx += tipV[0] * k * dt * 8; p.vy += tipV[1] * k * dt * 8; }
        }
        p.x += p.vx * dt; p.y += p.vy * dt; p.spin += p.rs * dt;
        const m = bw * 0.15;
        if (p.x < -m || p.x > bw + m || p.y < -m || p.y > bh + m) Object.assign(p, seed(bw, bh, p.front, false), { y: Math.random() * bh });
      }
      streak = (streak + dt * C.speed * 2.2 * gust) % 1;
    },
    draw(ctx, front) {
      if (!kind) return;
      const [bw, bh] = size;
      ctx.save();
      // wind streaks behind everything
      if (!front && W.wind) {
        const img = kind === "ash" ? W.windDark : W.wind, w = bw * 1.6, h = (w * img.height) / img.width;
        ctx.globalAlpha = kind === "mist" ? 0.18 : 0.32;
        for (let k = -1; k <= 1; k++) {
          const ox = -C.wind[0] * (streak + k) * w, oy = C.wind[1] * (streak + k) * h * 0.5;
          ctx.save(); ctx.translate(bw / 2 + ox, bh * 0.45 + oy); ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
        }
      }
      for (const p of ps) {
        if (p.front !== front) continue;
        const sheet = p.shred && W.shreds ? W.shreds : W.flakes; if (!sheet) continue;
        const img = p.shred ? (kind === "ash" ? sheet.dark : sheet.light) : kind === "ash" ? sheet.grey : sheet.white;
        const rc = sheet.rects[p.id % sheet.rects.length], r = bw * 0.006 * p.s * (p.shred ? 1.6 : 1), k = (r * 2) / Math.max(rc[2], rc[3]);
        ctx.globalAlpha = (front ? 0.55 : 0.85) * (p.shred ? 0.9 : 1);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin); ctx.drawImage(img, rc[0], rc[1], rc[2], rc[3], (-rc[2] * k) / 2, (-rc[3] * k) / 2, rc[2] * k, rc[3] * k); ctx.restore();
      }
      ctx.restore();
    },
  };
}

// ---------- glowing eyes: two red points with a soft halo, leaving a short streak of light as the head moves ----------
export function drawEyes(ctx, trails, bw, rgb, k, glow = 1) {
  if (k <= 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const c = (a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(1, a)})`;
  for (const tr of trails) {
    if (!tr.length) continue;
    // the streak of light left behind: wide and soft, then a bright core, fading towards its tail
    for (const [w, a] of [[0.03, 0.18], [0.012, 0.5], [0.004, 0.9]]) {
      for (let i = 1; i < tr.length; i++) {
        const f = i / tr.length;
        ctx.strokeStyle = c(a * f * f * k * glow); ctx.lineWidth = bw * w * (0.35 + 0.65 * f);
        ctx.beginPath(); ctx.moveTo(...tr[i - 1]); ctx.lineTo(...tr[i]); ctx.stroke();
      }
    }
    const [x, y] = tr[tr.length - 1];
    for (const [R, a] of [[0.11, 0.18], [0.045, 0.45], [0.016, 1]]) {           // a wide bloom, a halo, a hot core
      const r = bw * R * (0.7 + 0.3 * glow), gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, R < 0.02 ? `rgba(255,240,230,${a * k})` : c(a * k * glow)); gr.addColorStop(0.35, c(a * 0.45 * k * glow)); gr.addColorStop(1, c(0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- the blade's eerie light: a flickering glow along the dark blade ----------
// the blade's afterglow: the last moments of the blade, as fading streaks of its light (hist: [{time, h, tip}] newest last)
export function drawBladeAfterglow(ctx, hist, bw, rgb, time, ms, strength) {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let i = 0; i < hist.length - 1; i++) {
    const e = hist[i], age = (time - e.time) / ms; if (age >= 1 || age < 0) continue;
    const a = Math.pow(1 - age, 1.6) * strength;
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.22 * a})`; ctx.lineWidth = bw * 0.02;
    ctx.beginPath(); ctx.moveTo(e.h[0] + (e.tip[0] - e.h[0]) * 0.2, e.h[1] + (e.tip[1] - e.h[1]) * 0.2); ctx.lineTo(...e.tip); ctx.stroke();
  }
  ctx.restore();
}
export function drawBladeGlow(ctx, h, tip, bw, rgb, time, strength) {
  const flick = 0.75 + 0.15 * Math.sin(time / 47) + 0.1 * Math.sin(time / 13.3);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (const [w, a] of [[0.06, 0.1], [0.03, 0.2], [0.014, 0.4], [0.005, 0.85]]) {
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * flick * strength})`; ctx.lineWidth = bw * w;
    ctx.beginPath(); ctx.moveTo(h[0] + (tip[0] - h[0]) * 0.12, h[1] + (tip[1] - h[1]) * 0.12); ctx.lineTo(...tip); ctx.stroke();
  }
  ctx.restore();
}

// ---------- キレ（先回り）: inside each fast stroke of the hands, time is bent so the ghost gets there first: it moves ahead of
// the person, reaches the end of the stroke early and holds it. It is never behind the person (a lag looks small and slow);
// the stroke still starts and ends at the recorded moments, so the person's timing is kept.
// lift: anything with at(t). Returns the same shape, plus `swings` ([from, to] ms) for checks.
export function createSnap(g, motion, lift, cfg = {}) {
  const C = { speed: 0.9, power: 1.8, minMs: 120, maxMs: 1400, ...cfg };
  const T = g.frames.map((f) => f[0]), asp = g.aspect || 0.75, n = T.length;
  const H = T.map((t) => { const p = motion.at(t); return [(p[15][0] + p[16][0]) / 2, ((p[15][1] + p[16][1]) / 2) / asp]; });
  const raw = T.map((t, i) => (i ? Math.hypot(H[i][0] - H[i - 1][0], H[i][1] - H[i - 1][1]) / Math.max(1, T[i] - T[i - 1]) * 1000 : 0));
  const sp = raw.map((v, i) => (raw[Math.max(0, i - 1)] + 2 * v + raw[Math.min(n - 1, i + 1)]) / 4);
  // one stroke = from one slowest moment of the hands to the next; only strokes that get fast are bent
  const valleys = [0];
  for (let i = 1; i < n - 1; i++) if (sp[i] <= sp[i - 1] && sp[i] < sp[i + 1]) valleys.push(i);
  valleys.push(n - 1);
  const segs = [];
  for (let k = 0; k < valleys.length - 1; k++) {
    const a = valleys[k], b = valleys[k + 1], ms = T[b] - T[a];
    let top = 0; for (let i = a; i <= b; i++) top = Math.max(top, sp[i]);
    if (top > C.speed && ms >= C.minMs && ms <= C.maxMs) segs.push([T[a], T[b]]);
  }
  const remap = (t) => {
    // ahead of the person, never behind: the stroke is finished early and held (ease-out), so it hits and settles
    for (const [a, b] of segs) if (t > a && t < b) { const u = (t - a) / (b - a); return a + (b - a) * (1 - Math.pow(1 - u, C.power)); }
    return t;
  };
  return { ...lift, swings: segs, remap, at: (t) => lift.at(remap(t)) };
}

// ---------- 誇張: the arms swing wider than the person's — never smaller. Each hand and elbow is pushed further out from
// where it has been on average just before and after (a running mean over `windowMs`), by `gain`; the whole arm also
// reaches a little further from the shoulders (`reach`). motion: anything with at(t) / metaAt(t) giving the 13 points.
export function createAmp(g, motion, cfg = {}) {
  const C = { gain: 0.45, windowMs: 360, reach: 1.08, ...cfg };
  const T = g.frames.map((f) => f[0]), n = T.length, P = T.map((t) => motion.at(t));
  const ARM = [13, 14, 15, 16], sc = (p) => [(p[11][0] + p[12][0]) / 2, (p[11][1] + p[12][1]) / 2];
  // the running mean of each arm point relative to the shoulder centre, at each frame
  const mean = P.map((_, i) => {
    const out = {}; let cnt = 0;
    for (const k of ARM) out[k] = [0, 0];
    for (let j = i; j >= 0 && T[i] - T[j] <= C.windowMs / 2; j--) { const s = sc(P[j]); for (const k of ARM) { out[k][0] += P[j][k][0] - s[0]; out[k][1] += P[j][k][1] - s[1]; } cnt++; }
    for (let j = i + 1; j < n && T[j] - T[i] <= C.windowMs / 2; j++) { const s = sc(P[j]); for (const k of ARM) { out[k][0] += P[j][k][0] - s[0]; out[k][1] += P[j][k][1] - s[1]; } cnt++; }
    for (const k of ARM) { out[k][0] /= cnt; out[k][1] /= cnt; }
    return out;
  });
  let hint = 0;
  return {
    ...motion,
    at(t) {
      const src = motion.at(t), p = Array.isArray(src) ? src.map((q) => (q ? q.slice() : q)) : {};
      if (!Array.isArray(src)) for (const k in src) p[k] = Array.isArray(src[k]) ? src[k].slice() : src[k];
      let i = T[hint] <= t ? hint : 0; while (i < n - 1 && T[i + 1] <= t) i++; hint = i;
      const j = Math.min(i + 1, n - 1), k = T[j] > T[i] ? Math.max(0, Math.min(1, (t - T[i]) / (T[j] - T[i]))) : 0, s = sc(p);
      for (const a of ARM) {
        const mx = mean[i][a][0] + (mean[j][a][0] - mean[i][a][0]) * k, my = mean[i][a][1] + (mean[j][a][1] - mean[i][a][1]) * k;
        const rx = p[a][0] - s[0], ry = p[a][1] - s[1];
        p[a][0] = s[0] + (rx + (rx - mx) * C.gain) * C.reach; p[a][1] = s[1] + (ry + (ry - my) * C.gain) * C.reach;
      }
      return p;
    },
    metaAt: (t) => motion.metaAt(t),
  };
}

// ---------- the body from the person's outline (js/shadowoutline.js): a painted silhouette ----------
// pts: [x0, y0, …] in pixels (unmirrored picture, the caller's frame is mirrored). o: { ink, light, paint (image), wind, time,
// rim, alpha, wobble }. The outline is a smooth closed brush shape; inside, a rough paint texture and a light edge on the lit side.
export function silPath(ctx, pts, wob = 0, time = 0) {
  const n = pts.length / 2, P = (i) => { const k = ((i % n) + n) % n, x = pts[k * 2], y = pts[k * 2 + 1];
    return wob ? [x + Math.sin(time / 260 + k * 1.7) * wob, y + Math.cos(time / 310 + k * 2.3) * wob] : [x, y]; };
  ctx.beginPath();
  let a = P(0), b = P(1); ctx.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 1; i <= n; i++) { a = P(i); b = P(i + 1); ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  ctx.closePath();
}
export function drawSil(ctx, pts, bw, o) {
  const ink = o.ink || [20, 20, 24], light = o.light || [200, 204, 210], wob = bw * (o.wobble ?? 0.003);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  silPath(ctx, pts, wob, o.time); ctx.fillStyle = `rgb(${ink.join(",")})`; ctx.fill();
  ctx.save(); silPath(ctx, pts, wob, o.time); ctx.clip();
  // a rough paint texture inside (lighter strokes on the dark body)
  if (o.paint) {
    const pat = ctx.createPattern(o.paint, "repeat");
    ctx.globalAlpha = (o.alpha ?? 1) * (o.texture ?? 0.22); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = pat;
    ctx.save(); ctx.translate((o.time / 40) % 512, 0); ctx.fillRect(-bw * 2, -bw * 3, bw * 5, bw * 7); ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }
  // the lit edge: the outline stroked again, shifted away from the light, so only its lit inner side stays inside the clip
  ctx.globalAlpha = (o.alpha ?? 1) * (o.rim ?? 0.75);
  ctx.translate(bw * 0.008, bw * 0.006); ctx.strokeStyle = `rgb(${light.join(",")})`; ctx.lineWidth = bw * 0.014; ctx.shadowColor = `rgb(${light.join(",")})`; ctx.shadowBlur = bw * 0.03;
  silPath(ctx, pts, wob, o.time); ctx.stroke();
  ctx.restore();
  ctx.restore();
}
// horns for an oni: two curved, tapering horns from the top of the head, leaning outwards with the head
export function drawHorns(ctx, head, up, side, size, ink) {
  ctx.save(); ctx.fillStyle = `rgb(${ink.join(",")})`;
  for (const s of [1, -1]) {
    const bx = head[0] + side[0] * s * size * 0.45, by = head[1] + side[1] * s * size * 0.45;
    const tip = [bx + (up[0] * 1.0 + side[0] * s * 0.55) * size, by + (up[1] * 1.0 + side[1] * s * 0.55) * size];
    const mid = [bx + up[0] * size * 0.6 + side[0] * s * size * 0.05, by + up[1] * size * 0.6 + side[1] * s * size * 0.05];
    const w = size * 0.2;
    ctx.beginPath(); ctx.moveTo(bx - side[0] * w, by - side[1] * w); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]);
    ctx.quadraticCurveTo(mid[0] + side[0] * w * 1.6 * s, mid[1] + side[1] * w * 1.6 * s, bx + side[0] * w, by + side[1] * w); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// a sennyo's hagoromo: two long ribbons from the shoulders, following where the shoulders have been (a trail in time),
// carried downwind, thinning to the end
export function drawRibbons(ctx, trails, bw, wind, ink, alpha = 0.85) {
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const tr of trails) {
    if (tr.length < 4) continue;
    const n = tr.length;
    // the newest point is at the shoulder; older points drift downwind and sink a little, like cloth carried by the air
    const pts = tr.map((q, i) => { const age = n - 1 - i; return [q[0] + wind[0] * age * bw * 0.014, q[1] + wind[1] * age * bw * 0.014 + age * age * bw * 0.0004]; }).reverse();
    for (let i = 1; i < n - 1; i++) {
      const f = i / (n - 1), a = pts[i - 1], b = pts[i], c = pts[i + 1];
      ctx.strokeStyle = `rgba(${ink.join(",")},${alpha * (1 - f * 0.85)})`; ctx.lineWidth = bw * 0.028 * (1 - f * 0.8);
      ctx.beginPath(); ctx.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); ctx.quadraticCurveTo(b[0], b[1], (b[0] + c[0]) / 2, (b[1] + c[1]) / 2); ctx.stroke();
    }
  }
  ctx.restore();
}
