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
export function drawEyes(ctx, trails, bw, rgb, k) {
  if (k <= 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const tr of trails) {
    if (!tr.length) continue;
    // the streak
    ctx.lineCap = "round";
    for (let i = 1; i < tr.length; i++) {
      const a = (i / tr.length) * 0.5 * k;
      ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; ctx.lineWidth = bw * 0.006 * (i / tr.length);
      ctx.beginPath(); ctx.moveTo(...tr[i - 1]); ctx.lineTo(...tr[i]); ctx.stroke();
    }
    const [x, y] = tr[tr.length - 1], R = bw * 0.03;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, `rgba(255,235,225,${0.95 * k})`); gr.addColorStop(0.12, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.9 * k})`); gr.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.25 * k})`); gr.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- the blade's eerie light: a flickering glow along the dark blade ----------
export function drawBladeGlow(ctx, h, tip, bw, rgb, time, strength) {
  const flick = 0.75 + 0.15 * Math.sin(time / 47) + 0.1 * Math.sin(time / 13.3);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (const [w, a] of [[0.03, 0.12], [0.014, 0.28], [0.005, 0.7]]) {
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * flick * strength})`; ctx.lineWidth = bw * w;
    ctx.beginPath(); ctx.moveTo(h[0] + (tip[0] - h[0]) * 0.12, h[1] + (tip[1] - h[1]) * 0.12); ctx.lineTo(...tip); ctx.stroke();
  }
  ctx.restore();
}
