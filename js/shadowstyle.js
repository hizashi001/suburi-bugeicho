// 影の見た目の試作 (look prototypes for the shadow, 2026-11-16): three finishes over one samurai figure,
// to be compared in shadowlab.html before the puppet of stage 2 is built. Nothing here is used by the game yet.
//   "kiri"   鋭い切り絵: one sharp black cut-out, light on one edge only, glowing eyes and blade
//   "sumi"   墨絵: ink on lit paper, dry-brush grain, smoke, a brush-stroke blade trail, ink drops after a fast cut
//   "kasane" 濃淡の重ね: the far limbs paler, the near ones black, each layer with its own lit edge
// All three share the figure: a torso that turns with the shoulders and hips, stiff shoulder wings, hanging sleeves,
// a wide hakama with a split hem, a topknot that swings behind the head, and a long curved sword.
// Called like the other renderers: draw(ctx, pose, box, { aspect, t, meta }); meta is motion.metaAt(t) when there is one.
import { facingOf } from "./shadowmotion.js";

const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]), unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const perp = (a) => [-a[1], a[0]], clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LIGHT = unit([-0.6, -0.8]);                                   // the light comes from the upper left of the screen

function poly(o, pts) { o.beginPath(); pts.forEach((p, i) => (i ? o.lineTo(p[0], p[1]) : o.moveTo(p[0], p[1]))); o.closePath(); o.fill(); }
function disc(o, c, r) { o.beginPath(); o.arc(c[0], c[1], Math.max(0.1, r), 0, Math.PI * 2); o.fill(); }
// a limb that narrows (or widens) from a to b, with round ends
function taper(o, a, b, wa, wb, flatEnd = false) {
  const n = perp(unit(sub(b, a)));
  poly(o, [add(a, mul(n, wa / 2)), add(b, mul(n, wb / 2)), sub(b, mul(n, wb / 2)), sub(a, mul(n, wa / 2))]);
  disc(o, a, wa / 2); if (!flatEnd) disc(o, b, wb / 2);
}
let grainTile = null;
function grain() {                                                  // dry-brush streaks, made once
  if (grainTile) return grainTile;
  grainTile = document.createElement("canvas"); grainTile.width = grainTile.height = 256;
  const g = grainTile.getContext("2d"); let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 170; i++) {
    g.strokeStyle = `rgba(0,0,0,${0.18 + rnd() * 0.5})`; g.lineWidth = 0.6 + rnd() * 1.6;
    const x = rnd() * 256, y = rnd() * 256, l = 14 + rnd() * 70, tilt = (rnd() - 0.5) * 10;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + tilt); g.stroke();
    if (x + l > 256) { g.beginPath(); g.moveTo(x - 256, y); g.lineTo(x + l - 256, y + tilt); g.stroke(); }
  }
  return grainTile;
}

export function createStyleRenderer(kind = "kiri", { aura = [120, 175, 255] } = {}) {
  const mk = () => { const c = document.createElement("canvas"); return [c, c.getContext("2d")]; };
  const [lay, lo] = mk(), [aux, ao] = mk(), [body, bo] = mk();
  const A = (a) => `rgba(${aura[0]},${aura[1]},${aura[2]},${a})`;
  let lastT = null, trail = [], puffs = [], drops = [], eyesTrail = [];
  let armDz = 0, legDz = 0, nearArm = "R", nearLeg = "R", tipPrev = null, hot = 0, backSm = 0;

  // one layer: `paint` draws black shapes; they are tinted `tone`, and the edge facing the light gets `rim`
  function layer(ctx, U, paint, tone, rim = 0, rimW = 0.045) {
    lo.globalCompositeOperation = "source-over"; lo.clearRect(0, 0, lay.width, lay.height); lo.fillStyle = "#000"; paint(lo);
    if (rim > 0) {
      ao.globalCompositeOperation = "source-over"; ao.clearRect(0, 0, aux.width, aux.height); ao.drawImage(lay, 0, 0);
      ao.globalCompositeOperation = "destination-out"; ao.drawImage(lay, -LIGHT[0] * U * rimW, -LIGHT[1] * U * rimW);
      ao.globalCompositeOperation = "source-in"; ao.fillStyle = A(1); ao.fillRect(0, 0, aux.width, aux.height);
    }
    lo.globalCompositeOperation = "source-in"; lo.fillStyle = tone; lo.fillRect(0, 0, lay.width, lay.height);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.drawImage(lay, 0, 0);
    if (rim > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = rim; ctx.drawImage(aux, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
  }

  return {
    draw(ctx, pose, box, { aspect = 0.75, t = performance.now(), meta = null } = {}) {
      const jump = lastT == null || t < lastT || t - lastT > 400;
      const dt = jump ? 0 : (t - lastT) / 1000; lastT = t;
      if (jump) { trail = []; puffs = []; drops = []; eyesTrail = []; tipPrev = null; hot = 0; }
      if (!pose) return;
      const bw = Math.min(box.w, box.h * aspect), bh = bw / aspect, ox = box.x + (box.w - bw) / 2, oy = box.y + (box.h - bh) / 2;
      const P = (i) => pose[i] && [ox + (1 - pose[i][0]) * bw, oy + pose[i][1] * bh];
      const Z = (i) => (pose[i] && pose[i].length > 2 ? pose[i][2] : null);
      const sL = P(11), sR = P(12), hL = P(23), hR = P(24);
      if (!sL || !sR || !hL || !hR) return;
      for (const c of [lay, aux, body]) if (c.width !== ctx.canvas.width || c.height !== ctx.canvas.height) { c.width = ctx.canvas.width; c.height = ctx.canvas.height; }

      // ---- the body's own directions ----
      const sc = mix(sL, sR, 0.5), hc = mix(hL, hR, 0.5);
      const U = Math.max(len(sub(hc, sc)) / 1.5, bw / 14);              // the body's ruler: about the width of the shoulders
      const down = len(sub(hc, sc)) > 1 ? unit(sub(hc, sc)) : [0, 1], up = mul(down, -1), right = [down[1], -down[0]];
      const facing = (meta && meta.facing) || facingOf(pose);
      const yawS = facing ? (facing.shoulders * Math.PI) / 180 : 0, yawH = facing && facing.hips != null ? (facing.hips * Math.PI) / 180 : yawS;
      const back = facing ? facing.side === "back" : false;
      backSm += ((back ? 1 : 0) - backSm) * (jump ? 1 : clamp(dt * 12, 0, 1));
      // which arm and which leg is nearer the camera: depth is very noisy on the limbs, so it is averaged over time
      // and only changes sides when the difference is clear
      const ease = jump ? 1 : 1 - Math.exp(-dt / 0.25);
      if (Z(15) != null && Z(16) != null) {
        armDz += ((Z(15) + (Z(13) ?? Z(15))) - (Z(16) + (Z(14) ?? Z(16))) - armDz) * ease;
        if (armDz < -0.08) nearArm = "L"; else if (armDz > 0.08) nearArm = "R";
      }
      if (Z(27) != null && Z(28) != null) {
        legDz += ((Z(27) + (Z(25) ?? Z(27))) - (Z(28) + (Z(26) ?? Z(28))) - legDz) * ease;
        if (legDz < -0.08) nearLeg = "L"; else if (legDz > 0.08) nearLeg = "R";
      }

      // ---- torso: the shoulder line and the hip line, each with its own turn, never thinner than the body is deep ----
      const line = (a, b, c, thick, yaw, wide) => {
        const d = sub(b, a), dir = len(d) > U * 0.3 ? unit(dot(d, right) < 0 ? mul(d, -1) : d) : right;
        const half = Math.max((Math.abs(dot(d, right)) / 2) * wide, thick * Math.abs(Math.sin(yaw)) + thick * 0.55);
        return [sub(c, mul(dir, half)), add(c, mul(dir, half)), dir, half];
      };
      const [shA, shB, shDir] = line(sL, sR, sc, U * 0.34, yawS, 1.25);
      const [hpA, hpB] = line(hL, hR, hc, U * 0.30, yawH, 1.2);
      const frontness = 0.3 + 0.7 * Math.abs(Math.cos(yawS));
      const torso = (o) => {
        poly(o, [shA, shB, hpB, hpA]);
        // shoulder wings (kataginu): stiff points that stand out past the shoulders
        for (const [e, s] of [[shA, -1], [shB, 1]]) {
          poly(o, [add(sc, mul(up, U * 0.2)), add(add(e, mul(shDir, s * U * 0.34 * frontness)), mul(up, U * 0.14)), add(e, mul(down, U * 0.55)), add(sc, mul(down, U * 0.5))]);
        }
        // sash: a slightly wider band at the waist
        poly(o, [add(hpA, mul(up, U * 0.22)), add(hpB, mul(up, U * 0.22)), add(add(hpB, mul(right, U * 0.06)), mul(down, U * 0.02)), add(sub(hpA, mul(right, U * 0.06)), mul(down, U * 0.02))]);
      };

      // ---- legs and hakama ----
      const legs = [{ id: "L", h: hL, k: P(25), a: P(27) }, { id: "R", h: hR, k: P(26), a: P(28) }].filter((l) => l.k && l.a);
      const leg = (o, l) => {
        taper(o, l.h, l.k, U * 0.38, U * 0.36); taper(o, l.k, l.a, U * 0.36, U * 0.5, true);
        const out = unit(sub(l.a, l.k)), side = perp(out);             // the hem: cut straight, with a sharp point on each side of the ankle
        poly(o, [add(l.a, mul(side, U * 0.34)), add(add(l.a, mul(side, U * 0.1)), mul(out, U * 0.09)), add(sub(l.a, mul(side, U * 0.1)), mul(out, U * 0.03)), sub(l.a, mul(side, U * 0.34)), sub(l.a, mul(out, U * 0.2))]);
      };
      const bell = (o) => {                                             // the cloth between and around the legs
        if (legs.length < 2) return;
        const [l, r] = dot(legs[0].a, right) <= dot(legs[1].a, right) ? legs : [legs[1], legs[0]];
        const notch = clamp(len(sub(r.a, l.a)) * 0.55, U * 0.18, U * 0.95), mid = mix(l.a, r.a, 0.5);
        o.beginPath();
        o.moveTo(...sub(hpA, mul(right, U * 0.08)));
        o.quadraticCurveTo(...sub(l.k, mul(right, U * 0.36)), ...add(sub(l.a, mul(right, U * 0.4)), mul(down, U * 0.1)));
        o.lineTo(...add(add(l.a, mul(right, U * 0.3)), mul(down, U * 0.04)));
        o.lineTo(...sub(mid, mul(down, notch)));
        o.lineTo(...add(sub(r.a, mul(right, U * 0.3)), mul(down, U * 0.04)));
        o.lineTo(...add(add(r.a, mul(right, U * 0.4)), mul(down, U * 0.1)));
        o.quadraticCurveTo(...add(r.k, mul(right, U * 0.36)), ...add(hpB, mul(right, U * 0.08)));
        o.closePath(); o.fill();
      };

      // ---- arms with hanging sleeves ----
      const arms = [{ id: "L", s: sL, e: P(13), w: P(15) }, { id: "R", s: sR, e: P(14), w: P(16) }].filter((a) => a.e && a.w);
      const arm = (o, a) => {
        taper(o, a.s, a.e, U * 0.24, U * 0.19); taper(o, a.e, a.w, U * 0.17, U * 0.11); disc(o, a.w, U * 0.075);
        const sag = add(mix(a.e, a.w, 0.6), [0, U * 0.46]);            // the sleeve hangs straight down, whatever the arm does
        poly(o, [a.e, a.w, add(a.w, [0, U * 0.1]), sag, add(a.e, [0, U * 0.12])]);
      };

      // ---- head, topknot ----
      const nose = P(0), hd = nose ? add(nose, mul(up, U * 0.05)) : add(sc, mul(up, U * 0.62));
      const look = nose ? clamp(dot(sub(nose, sc), right) / (U * 0.25), -1, 1) : 0;   // −1…1: which way the face points on screen
      const head = (o) => {
        taper(o, add(sc, mul(up, U * 0.05)), hd, U * 0.24, U * 0.2);
        o.beginPath(); o.ellipse(hd[0], hd[1], U * 0.27, U * 0.32, Math.atan2(down[1], down[0]) - Math.PI / 2, 0, Math.PI * 2); o.fill();
        const base = add(hd, mul(up, U * 0.28)), tip = add(add(base, mul(up, U * 0.3)), mul(right, -look * U * 0.36)), n = perp(unit(sub(tip, base)));
        disc(o, base, U * 0.1); poly(o, [add(base, mul(n, U * 0.085)), tip, sub(base, mul(n, U * 0.085))]);
      };

      // ---- sword: from the hands along the forearms; long, curved, with a guard ----
      const wM = arms.length === 2 ? mix(arms[0].w, arms[1].w, 0.5) : arms[0] && arms[0].w, eM = arms.length === 2 ? mix(arms[0].e, arms[1].e, 0.5) : arms[0] && arms[0].e;
      let blade = null;
      if (wM && eM) {
        const u = len(sub(wM, eM)) > 1 ? unit(sub(wM, eM)) : up, n = perp(u);
        const guard = add(wM, mul(u, U * 0.16)), tip = add(wM, mul(u, U * 2.75)), ctrl = add(add(wM, mul(u, U * 1.5)), mul(n, U * 0.2));
        blade = { hilt: sub(wM, mul(u, U * 0.34)), guard, tip, ctrl, u, n };
      }
      const sword = (o) => {
        if (!blade) return;
        const { hilt, guard, tip, ctrl, u, n } = blade, w = U * 0.05;
        taper(o, hilt, guard, U * 0.075, U * 0.075);
        o.beginPath(); o.moveTo(...add(guard, mul(n, w))); o.quadraticCurveTo(...add(ctrl, mul(n, w)), ...tip); o.quadraticCurveTo(...sub(ctrl, mul(n, w * 0.6)), ...sub(guard, mul(n, w))); o.closePath(); o.fill();
        o.beginPath(); o.ellipse(guard[0], guard[1], U * 0.17, U * 0.055, Math.atan2(u[1], u[0]) + Math.PI / 2, 0, Math.PI * 2); o.fill();
      };
      const edge = (o, wd, style) => { if (!blade) return; o.strokeStyle = style; o.lineWidth = wd; o.lineCap = "round"; o.beginPath(); o.moveTo(...blade.guard); o.quadraticCurveTo(...blade.ctrl, ...blade.tip); o.stroke(); };

      // ---- things that live over time: the blade's trail, how fast the tip is ----
      let tipSpeed = 0;
      if (blade) {
        if (tipPrev && dt > 0) tipSpeed = len(sub(blade.tip, tipPrev.tip)) / dt / U;      // in body-rulers a second
        if (dt > 0 || !trail.length) trail.push({ ctrl: blade.ctrl, tip: blade.tip, guard: blade.guard, t });
      }
      trail = trail.filter((b) => t - b.t < 230);
      // the swept area between one blade position and the next, from `from` to `to` along the blade (0 = guard, 1 = tip)
      const sweep = (o, from, to, style, alpha) => {
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1], b = trail[i], k = 1 - (t - a.t) / 230;
          if (k <= 0 || len(sub(a.tip, b.tip)) < U * 0.04) continue;
          const at = (q, f) => { const m = 1 - f; return [m * m * q.guard[0] + 2 * m * f * q.ctrl[0] + f * f * q.tip[0], m * m * q.guard[1] + 2 * m * f * q.ctrl[1] + f * f * q.tip[1]]; };
          o.globalAlpha = alpha * k * k; o.fillStyle = style; poly(o, [at(a, from), at(a, to), at(b, to), at(b, from)]);
        }
        o.globalAlpha = 1;
      };
      const feet = legs.length ? mix(legs[0].a, legs[legs.length - 1].a, 0.5) : add(hc, mul(down, U * 2.6));
      const farArm = arms.find((a) => a.id !== nearArm), nrArm = arms.find((a) => a.id === nearArm);
      const farLeg = legs.find((l) => l.id !== nearLeg), nrLeg = legs.find((l) => l.id === nearLeg);
      const whole = (o) => { arms.forEach((a) => arm(o, a)); bell(o); legs.forEach((l) => leg(o, l)); torso(o); head(o); sword(o); };
      const eyes = (o, alpha) => {                                       // two slits of light; none when the back is turned
        if (alpha <= 0.02) return;
        const across = Math.max(0.25, Math.abs(Math.cos(yawS)));
        o.strokeStyle = A(alpha); o.lineWidth = Math.max(1.2, U * 0.035); o.lineCap = "round";
        for (const s of [-1, 1]) {
          const c = add(add(hd, mul(right, look * U * 0.1 + s * U * 0.105 * across)), mul(up, U * 0.01));
          o.beginPath(); o.moveTo(...sub(c, mul(right, U * 0.05 * across))); o.lineTo(...add(add(c, mul(right, U * 0.05 * across)), mul(up, U * 0.025 * -s * (look || 0.4)))); o.stroke();
        }
      };

      ctx.save();
      if (kind === "kiri") {
        // light on the ground, a faint glow behind, the cut-out, one lit edge, eyes and blade
        const g = ctx.createRadialGradient(feet[0], feet[1], 0, feet[0], feet[1], U * 1.7);
        g.addColorStop(0, A(0.3)); g.addColorStop(1, A(0));
        ctx.globalCompositeOperation = "lighter"; ctx.save(); ctx.translate(feet[0], feet[1] + U * 0.1); ctx.scale(1, 0.16); ctx.translate(-feet[0], -feet[1]); ctx.fillStyle = g; ctx.fillRect(feet[0] - U * 2, feet[1] - U * 2, U * 4, U * 4); ctx.restore();
        bo.globalCompositeOperation = "source-over"; bo.clearRect(0, 0, body.width, body.height); bo.fillStyle = A(1); whole(bo);
        const far = body.width + 50; ctx.shadowOffsetX = far; ctx.shadowColor = A(0.5); ctx.shadowBlur = U * 0.9; ctx.drawImage(body, -far, 0);
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;
        sweep(ctx, 0.35, 1, A(1), 0.55); sweep(ctx, 0.8, 1, "#fff", 0.5);
        layer(ctx, U, whole, "rgb(5,7,12)", 0.95, 0.05);
        ctx.globalCompositeOperation = "lighter"; edge(ctx, Math.max(1, U * 0.028), A(0.6 + Math.min(0.4, tipSpeed / 20))); eyes(ctx, (1 - backSm) * 0.95);
      } else if (kind === "sumi") {
        // lit paper behind, smoke, the inked figure with dry-brush grain, a brush-stroke trail, ink drops
        const m = ctx.createRadialGradient(sc[0], hc[1], U * 0.3, sc[0], hc[1], U * 3.6);
        m.addColorStop(0, "rgba(226,222,208,0.5)"); m.addColorStop(0.6, "rgba(226,222,208,0.18)"); m.addColorStop(1, "rgba(226,222,208,0)");
        ctx.fillStyle = m; ctx.fillRect(box.x, box.y, box.w, box.h);
        if (dt > 0) {
          let n = dt * 9; while (n-- > Math.random()) { const from = Math.random() < 0.6 ? feet : (blade ? blade.tip : sc); puffs.push({ x: from[0] + (Math.random() - 0.5) * U * 1.1, y: from[1], vx: (Math.random() - 0.5) * U * 0.25, vy: -U * (0.25 + Math.random() * 0.4), r: U * (0.18 + Math.random() * 0.22), life: 0, max: 1.2 + Math.random() }); }
          hot = tipSpeed > 9 ? 1 : hot;
          if (hot && tipSpeed < 4 && blade && tipPrev) {                 // a fast cut has just stopped: ink flies on
            const d = unit(sub(blade.tip, tipPrev.tip)); hot = 0;
            for (let i = 0; i < 9; i++) drops.push({ x: blade.tip[0], y: blade.tip[1], vx: (d[0] + (Math.random() - 0.5) * 0.9) * U * (2 + Math.random() * 5), vy: (d[1] + (Math.random() - 0.5) * 0.9) * U * (2 + Math.random() * 5), r: U * (0.02 + Math.random() * 0.05), life: 0, max: 0.35 + Math.random() * 0.4 });
          }
        }
        puffs = puffs.filter((p) => (p.life += dt) < p.max);
        for (const p of puffs) {
          p.x += p.vx * dt; p.y += p.vy * dt; const k = p.life / p.max, r = p.r * (1 + k * 1.6);
          const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, `rgba(8,10,16,${0.34 * (1 - k)})`); gr.addColorStop(1, "rgba(8,10,16,0)");
          ctx.fillStyle = gr; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        }
        for (const [from, to, al] of [[0.3, 0.52, 0.5], [0.57, 0.8, 0.75], [0.84, 0.93, 0.6], [0.95, 1, 0.9]]) sweep(ctx, from, to, "rgb(8,10,16)", al);
        lo.globalCompositeOperation = "source-over"; lo.clearRect(0, 0, lay.width, lay.height); lo.fillStyle = "#000"; whole(lo);
        lo.globalCompositeOperation = "destination-out"; lo.globalAlpha = 0.55; lo.fillStyle = lo.createPattern(grain(), "repeat"); lo.fillRect(0, 0, lay.width, lay.height); lo.globalAlpha = 1;
        lo.globalCompositeOperation = "source-in"; lo.fillStyle = "rgb(8,10,16)"; lo.fillRect(0, 0, lay.width, lay.height);
        ctx.globalCompositeOperation = "source-over"; ctx.drawImage(lay, 0, 0);
        drops = drops.filter((p) => (p.life += dt) < p.max);
        ctx.fillStyle = "rgb(8,10,16)";
        for (const p of drops) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += U * 9 * dt; ctx.globalAlpha = 1 - p.life / p.max; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 1.8, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "lighter"; edge(ctx, Math.max(1, U * 0.02), A(0.55)); eyes(ctx, (1 - backSm) * 0.8);
      } else {
        // kasane: far → near, paler → black, every layer lit on the same side
        const TONE = ["rgb(26,34,56)", "rgb(14,18,30)", "rgb(4,5,9)"];
        bo.globalCompositeOperation = "source-over"; bo.clearRect(0, 0, body.width, body.height); bo.fillStyle = A(1); whole(bo);
        const far = body.width + 50; ctx.shadowOffsetX = far; ctx.shadowColor = A(0.35); ctx.shadowBlur = U * 1.2; ctx.drawImage(body, -far, 0);
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;
        sweep(ctx, 0.35, 1, A(1), 0.45);
        const behind = backSm > 0.5;                                    // with the back turned, both arms are beyond the body
        layer(ctx, U, (o) => { bell(o); if (farLeg) leg(o, farLeg); if (farArm) arm(o, farArm); if (behind && nrArm) arm(o, nrArm); }, TONE[0], 0.5, 0.04);
        layer(ctx, U, (o) => { torso(o); head(o); }, TONE[1], 0.75, 0.045);
        layer(ctx, U, (o) => { if (nrLeg) leg(o, nrLeg); if (!behind && nrArm) arm(o, nrArm); sword(o); }, TONE[2], 0.95, 0.05);
        ctx.globalCompositeOperation = "lighter"; edge(ctx, Math.max(1, U * 0.028), A(0.6 + Math.min(0.4, tipSpeed / 20))); eyes(ctx, (1 - backSm) * 0.95);
      }
      ctx.restore();
      if (blade && dt > 0) tipPrev = { tip: blade.tip };
      else if (blade && !tipPrev) tipPrev = { tip: blade.tip };
    },
  };
}
