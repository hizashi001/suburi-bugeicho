
/* ---------- effects (PixelLab VFX sheets) ----------
   fx(key, x, y, o): one-shot or timed effect. x,y are screen pixels unless o.world, then x is a road position.
   o: sc (scale), sx/sy (extra stretch), rot, flipX, flipY, a (alpha), sp (speed), delay, loop (seconds to keep looping),
      grow (scale added per second), back (draw behind the figures), add (light blend) */
const FXIMG = new Image(); FXIMG.src = 'fx.png';
function fx(key, x, y, o){
  const m = FXATLAS[key]; if (!m) return null; o = o || {};
  const e = { k: key, m, x, y, t: -(o.delay || 0), sc: o.sc || 1, sx: o.sx || 1, sy: o.sy || 1, rot: o.rot || 0, flipX: !!o.flipX, flipY: !!o.flipY,
    a: o.a == null ? 1 : o.a, sp: o.sp || 1, world: !!o.world, back: !!o.back, add: !!o.add, grow: o.grow || 0, fade: o.fade || 0, vx: o.vx || 0, vy: o.vy || 0,
    life: o.loop || m.f.length * m.fd };
  G.fx.push(e); return e;
}
function fxFrame(m, t, loop){ const n = m.f.length, i = Math.floor(t / m.fd); return loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i)); }
// draw one frame of an effect; (x, y) is the effect's anchor
function fxDraw(c, key, i, x, y, o){
  const m = FXATLAS[key]; if (!m || !FXIMG.complete || !FXIMG.naturalWidth) return;
  const f = m.f[i]; o = o || {};
  const sc = o.sc || 1, sx = sc * (o.sx || 1) * (o.flipX ? -1 : 1), sy = sc * (o.sy || 1) * (o.flipY ? -1 : 1);
  c.save(); c.globalAlpha = o.a == null ? 1 : o.a; if (o.add) c.globalCompositeOperation = 'lighter';
  c.translate(Math.round(x), Math.round(y)); if (o.rot) c.rotate(o.rot); c.scale(sx, sy);
  c.drawImage(FXIMG, f[0], f[1], m.w, m.h, -m.ax, -m.ay, m.w, m.h);
  c.restore();
}
function stepFx(dt){ for (const e of G.fx){ e.t += dt * e.sp; if (e.t > 0){ e.x += e.vx * dt; e.y += e.vy * dt; } } G.fx = G.fx.filter(e => e.t < e.life); }
function drawFxList(c, back){
  for (const e of G.fx){
    if (e.t < 0 || e.back !== back) continue;
    const loop = e.life > e.m.f.length * e.m.fd + 1e-6, i = fxFrame(e.m, e.t, loop);
    const fadeA = e.fade && e.t > e.life - e.fade ? (e.life - e.t) / e.fade : 1;
    fxDraw(c, e.k, i, e.world ? SX(e.x) : e.x, e.y, { sc: e.sc + e.grow * e.t, sx: e.sx, sy: e.sy, rot: e.rot, flipX: e.flipX, flipY: e.flipY, a: e.a * fadeA, add: e.add });
  }
}
// the blade trail for each kind of cut, laid over the yokai that was struck
function slashFx(c, x, y, big){
  const s = big ? 1.35 : 1;
  if (c.range === 'around') fx('moon', HXS + 26, y, { sc: 1.25 * s, sy: 0.7, add: true });
  else if (c.arc === 'h') fx('moon', x - 8, y, { sc: s, sx: 1.25, sy: 0.55, rot: rnd(-0.12, 0.12), add: true });
  else if (c.arc === 'down') fx('wind', x - 6, y, { sc: 1.25 * s, rot: rnd(-0.35, -0.1), add: true });
  else if (c.arc === 'up') fx('wind', x - 6, y - 10, { sc: 1.25 * s, flipY: true, rot: rnd(0.1, 0.35), add: true });
  else if (c.arc === 'thrust') fx('moon', x - 10, y, { sc: 0.8 * s, sx: 1.6, sy: 0.22, add: true });
}
// ittan-momen: the cloth ripples along its length, the face stays steady
function drawRipple(c, img, fr, dx, dy, flip){
  const W = fr.w, y = Math.round(dy + fr.oy);
  c.save();
  let x0;
  if (flip){ c.translate(Math.round(dx), 0); c.scale(-1, 1); x0 = -fr.ox - W; } else x0 = Math.round(dx + fr.ox);
  for (let sx = 0; sx < W; sx += 2){
    const u = sx / W, w = Math.max(0, u - 0.22) / 0.78;          // the face sits at the left of the drawing
    const off = Math.round(Math.sin(u * 8 - G.time * 7) * 4 * w + Math.sin(u * 3 + G.time * 3) * 1.5 * w);
    c.drawImage(img, fr.x + sx, fr.y, Math.min(2, W - sx), fr.h, x0 + sx, y + off, Math.min(2, W - sx), fr.h);
  }
  c.restore();
}

/* ---------- breathing between strikes ----------
   each time the shadow comes back to its middle guard it lets out one long breath: a thin stream of white mist from the mouth
   and a pale spirit glow that rises off the body, so the pause reads as gathering strength instead of standing still */
function breathe(strong){
  const fl = ATLAS[G.pose[0]], fr = fl && fl[G.pose[1]]; if (!fr || fr.mx == null) return;
  const x = HXS + fr.mx + 2, y = FEET + Math.round(G.lift) + fr.my;
  fx('puff', x + 8, y + 1, { sc: 0.5, sx: 1.4, a: 0.75, vx: 40, vy: -12, sp: 0.7 });
  for (let i = 0; i < (strong ? 12 : 7); i++)
    G.parts.push({ x: x + rnd(0, 3), y: y + rnd(-1, 2), vx: rnd(40, 90), vy: rnd(-22, 4), g: -18, life: rnd(0.35, 0.6), t: -i * 0.025, c: Math.random() < 0.6 ? '#e9f0ff' : '#a9c8ff', s: Math.random() < 0.4 ? 2 : 1 });
  G.aura = strong ? 0.55 : 0.4;
}
