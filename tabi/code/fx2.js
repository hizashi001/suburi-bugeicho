
/* ---------- effects (PixelLab VFX sheets) ----------
   fx(key, x, y, o): one-shot or timed effect. x,y are screen pixels unless o.world, then x is a road position.
   o: sc (scale), sx/sy (extra stretch), rot, flipX, flipY, a (alpha), sp (speed), delay, loop (seconds to keep looping),
      grow (scale added per second), back (draw behind the figures), add (light blend) */
const FXIMG = new Image(); FXIMG.src = 'fx.png';
/* the VFX pack (vfx.png / VFXATLAS, built by build/vfxbuild.py). Each frame is [x, y, w, h, ox, oy] around the anchor;
   k: the frames were shrunk for the atlas and are drawn k times bigger. The same fx() / fxDraw() play both sheets. */
const VFXIMG = new Image(); VFXIMG.src = 'vfx.png';
const fxMeta = key => FXATLAS[key] || VFXATLAS[key];
// what each VFX key is for (shown in the sample list on the 試し tab; the full list of all 214 is VFX_CATALOG.md)
const VFX_ROLE = {
  sl_h: '横の斬撃', sl_wide: '太い斬撃（技）', sl_cres: '三日月の斬撃', sl_cres2: '斬り上げの三日月', sl_hook: '返しの斬撃', sl_thin: '細い剣筋',
  sl_diag: '斜めの二重斬撃（斬り下ろし）', sl_x: '斬撃の×（当たり）', sl_ring: '回転の輪', sl_ring2: '回転の輪（2）', sl_swirl: '大きな渦の斬撃（旋風）',
  dash: '突進・突き', comet: '駆け抜けの彗星', wind_shot: '飛ぶ斬撃（風刃）', sl_red: '赤い交差斬撃（会心・鬼神斬）', sl_cross: '橙の交差斬撃（重い当たり）',
  hit_b1: '当たり（青）', hit_b2: '当たり（青い星）', hit_b3: '当たり（青い星2）', hit_o1: '重い当たり（火花）', hit_o2: '重い当たり（橙の星）',
  hit_red: '会心の当たり（赤）', hit_big: '大きな当たり（白い星）', hit_star: '会心の光線', hit_w: '打撃の渦', hit_el: '雷の当たり', burst_w: '決着の大爆発（白と雷）',
  bolt_v: '落雷（縦）', bolt_g: '地を走る雷', bolt_web: '稲妻の網', bolt_s: '小さな稲妻', bolt_claw: '雷の爪', bolt_big: '大きな稲妻',
  fire_burst: '炎の噴き上がり', fire_big: '大きな炎', fire_col: '火柱', fire_col2: '火柱（平たい）', expl: '爆発', expl_ring: '輪の爆発',
  expl_mush: 'きのこ雲（赤）', expl_mush2: 'きのこ雲（橙）', expl_line: '地上の大爆発', fire_ring: '地面の炎の輪', fire_line: '地を走る炎', flame_s: '燃え残り',
  dust_land: '着地の土煙', dust_puff: '煙の玉（雑魚が消える）', dust_wide: '横長の土煙', dust_dash: '踏み込みの土煙', smoke: '灰色の煙', smoke_col: '煙の柱',
  cloud_w: '白い煙の爆発', gnd_crack: '地割れの電光', gnd_geyser: '光の噴き上がり（打ち上げ）', gnd_dust: '土ぼこりの噴出', gnd_dome: '着地の衝撃（王冠）',
  gnd_splash: '光の噴き上がり（着地）', aura_b: '青い霊気（気が満ちる）', aura_red: '赤い気（鬼神斬）', orb_charge: '溜めの光の球', ring_charge: '溜めの輪',
  beam: '細い光の柱（封・位上げ・座敷童）', barrier: '結界', motes: '霊気の粒', spirit: '霊の渦', speed: '速さの線（全面）',
  ring_w: '閃光の輪', twinkle: 'きらめき（取得）', spark_y: '報酬のきらめき', ring_y: '報酬の輪', gold_swirl: '幸運の金の渦',
  ink_spray: '墨しぶき', red_swirl: '赤い渦（鬼神斬）', red_pop: '赤い爆ぜ'
};
function fx(key, x, y, o){
  const m = fxMeta(key); if (!m) return null; o = o || {};
  const e = { k: key, m, x, y, t: -(o.delay || 0), sc: o.sc || 1, sx: o.sx || 1, sy: o.sy || 1, rot: o.rot || 0, flipX: !!o.flipX, flipY: !!o.flipY,
    a: o.a == null ? 1 : o.a, sp: o.sp || 1, world: !!o.world, back: !!o.back, add: !!o.add, grow: o.grow || 0, fade: o.fade || 0, vx: o.vx || 0, vy: o.vy || 0,
    life: o.loop || m.f.length * m.fd };
  G.fx.push(e); return e;
}
function fxFrame(m, t, loop){ const n = m.f.length, i = Math.floor(t / m.fd); return loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i)); }
// draw one frame of an effect; (x, y) is the effect's anchor
function fxDraw(c, key, i, x, y, o){
  const m = fxMeta(key), v = !FXATLAS[key], img = v ? VFXIMG : FXIMG; if (!m || !img.complete || !img.naturalWidth) return;
  const f = m.f[i]; o = o || {};
  const sc = (o.sc || 1) * (m.k || 1), sx = sc * (o.sx || 1) * (o.flipX ? -1 : 1), sy = sc * (o.sy || 1) * (o.flipY ? -1 : 1);
  c.save(); c.globalAlpha = o.a == null ? 1 : o.a; if (o.add) c.globalCompositeOperation = 'lighter';
  c.translate(Math.round(x), Math.round(y)); if (o.rot) c.rotate(o.rot); c.scale(sx, sy);
  if (v) c.drawImage(img, f[0], f[1], f[2], f[3], f[4], f[5], f[2], f[3]);
  else c.drawImage(img, f[0], f[1], m.w, m.h, -m.ax, -m.ay, m.w, m.h);
  c.restore();
}
// pick one of several keys at random (variety in repeated hits)
const vpick = (...keys) => keys[Math.floor(Math.random() * keys.length)];
function stepFx(dt){ for (const e of G.fx){ e.t += dt * e.sp; if (e.t > 0){ e.x += e.vx * dt; e.y += e.vy * dt; } } G.fx = G.fx.filter(e => e.t < e.life); }
function drawFxList(c, back){
  for (const e of G.fx){
    if (e.t < 0 || e.back !== back) continue;
    const loop = e.life > e.m.f.length * e.m.fd + 1e-6, i = fxFrame(e.m, e.t, loop);
    const fadeA = e.fade && e.t > e.life - e.fade ? (e.life - e.t) / e.fade : 1;
    fxDraw(c, e.k, i, e.world ? SX(e.x) : e.x, e.y, { sc: e.sc + e.grow * e.t, sx: e.sx, sy: e.sy, rot: e.rot, flipX: e.flipX, flipY: e.flipY, a: e.a * fadeA, add: e.add });
  }
}
// the blade trail for each kind of cut, laid over the yokai that was struck (the VFX pack's spirit-blue blades)
function slashFx(c, x, y, big){
  const s = big ? 1.0 : 0.72;
  if (c.range === 'around') fx(vpick('sl_ring', 'sl_ring2'), HXS + 30, y, { sc: 0.9 * s + 0.2, sy: 0.75, add: true, sp: 1.4 });
  else if (c.arc === 'h') fx(vpick('sl_h', 'sl_cres', 'sl_thin'), x - 6, y, { sc: s, rot: rnd(-0.15, 0.15), add: true, sp: 1.5 });
  else if (c.arc === 'down') fx(vpick('sl_diag', 'sl_cres2'), x - 4, y, { sc: s, rot: rnd(0.2, 0.5), flipY: true, add: true, sp: 1.5 });
  else if (c.arc === 'up') fx(vpick('sl_hook', 'sl_cres2'), x - 4, y - 10, { sc: s, rot: rnd(-0.5, -0.2), add: true, sp: 1.5 });
  else if (c.arc === 'thrust') fx('dash', x - 10, y, { sc: 0.8 * s, add: true, sp: 1.4 });
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
