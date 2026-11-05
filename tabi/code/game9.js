/* ---------- 逢魔が時: one hour around today's sunset ----------
   no location access here, so the longitude comes from the device's standard time zone and the latitude is fixed near Tokyo */
function sunsetMinutes(d){
  const lat = 35.7 * Math.PI / 180, tz = -d.getTimezoneOffset(), lon = (Math.round(tz / 60) * 15);
  const start = new Date(d.getFullYear(), 0, 0), doy = Math.floor((d - start) / 86400000);
  const g = 2 * Math.PI / 365 * (doy - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) * 180 / Math.PI;
  return 720 - 4 * (lon - ha) - eq + tz;
}
const hm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
let OUMA_MODE = 'auto';
try { const v = localStorage.getItem('ghost-ouma'); if (['auto', 'on', 'off'].includes(v)) OUMA_MODE = v; } catch (e) {}
function oumaNow(){
  if (OUMA_MODE === 'on') return true; if (OUMA_MODE === 'off') return false;
  const d = new Date(), ss = sunsetMinutes(d), now = d.getHours() * 60 + d.getMinutes();
  return now >= ss - 30 && now <= ss + 30;
}

/* ---------- game state ----------
   G.x is the shadow's place on the road; G.cam is where the view looks. They match except while the view catches up
   after 駆け抜け一閃. */
const G = {
  mode: 'walk', t: 0, x: 0, cam: 0, wf: 0, wt: 0, drawn: false, clear: 0, stepT: 0,
  clip: null, clipKey: '', ci: 0, ct: 0, hub: '中', pose: ['walk', 0], buf: false, wait: 0, last: '', fast: false, lift: 0, queue: [],
  foes: [], target: null, spawnT: 1.5, sinceClear: 0, kills: 0, soul: 0, combo: 0, best: 0, lastHit: -9, stop: 0, time: 0,
  hp: HP_MAX, setbacks: 0, luck: 0, ouma: false, hyakki: null, nextBig: 25, nextGate: GATE, arena: null, ki: 0, kake: null,
  parts: [], texts: [], slashes: [], arcs: [], ghosts: [], corpses: [], waves: [], souls: [], taps: [], lines: [], flash: 0,
  gleam: 0, mark: 0, moveName: '―', tapHit: false, fx: [], inv: 0, aura: 0, breathT: 0,
  // phase 2: screen shake (time left, length, strength in pixels), slow motion, rewards, criticals, idle animation clock
  shake: 0, shakeDur: 1, shakeMag: 0, slow: null, bars: 0, drops: [], gear: 0, pickN: 0, pickT: 0, pop: 0, crits: 0, idleT: 0,
  // v12: rank, coins and scrolls, flying slashes, extra thrusts, 鬼神斬, equipment levels, skill set (see skills1.js)
  lv: 1, xp: 0, koban: 0, maki: 0, shots: [], echo: [], red: 0, kishin: null, noHit: false, eq: {},
  sk: { slots: ['shoryu', 'kazeba', 'raikiri', 'ibuki'], ougi: 'kake', cd: {}, uses: {}, sel: 0, pick: 'shoryu' }
};
let HXS = 0;                                       // the shadow's x on screen, set every frame
// where rewards fly to (the counters at the top of the screen), in game pixels
const TGT = { tama: { x: 0, y: 10 }, koban: { x: 0, y: 10 }, gear: { x: 0, y: 10 } };
let SOUL_T = TGT.tama;
const SX = wx => HX + (wx - G.cam);                // road position -> screen x
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const alive = () => G.foes.filter(f => !f.dead && !f.pending && !f.flee);
const edge = f => f.x - G.x - f.w * 0.3;            // distance from the shadow to the yokai's front edge
// the middle of a yokai's body on screen (fliers drawn around their middle, the rest standing on their feet)
const bodyY = f => FEET + f.y - (f.center ? 0 : f.h * 0.55);
// equipment: the sum of a kind of bonus over the pieces (see EQUIP), the shadow's damage and full strength
const eqAdd = kind => EQUIP.reduce((a, e) => a + (e.eff === kind ? e.per * (G.eq[e.id] || 0) : 0), 0);
const eqMul = kind => 1 + eqAdd(kind);
const heroDmg = () => BASE_DMG * lvMul(G.lv) * eqMul('atk');
const hpMax = () => Math.round(HP_MAX * (1 + 0.05 * (G.lv - 1)) * eqMul('hp'));
function gainXp(n){
  G.xp += n;
  while (G.xp >= xpNext(G.lv)){ G.xp -= xpNext(G.lv); G.lv++; G.hp = hpMax(); G.texts.push({ x: HXS + 4, y: FEET - 170, s: '位 ' + G.lv, t: 0, dur: 1.2, c: '#9fe0ff', big: true }); play('draw', 0.5, 2.4); }
}
function setMode(m){ G.mode = m; G.t = 0; }
function weighted(list){ const tot = list.reduce((a, l) => a + l[1], 0); let r = Math.random() * tot; for (const l of list){ if ((r -= l[1]) < 0) return l[0]; } return list[0][0]; }

/* ---------- 手応え: shake, hit stop, slow motion, vibration ----------
   shake(dur, mag): the whole picture trembles for dur seconds, up to mag game pixels, fading out.
   slowmo(dur, scale): after any hit stop ends, time runs at `scale` for dur real seconds, then snaps back to full speed.
   feel(kind): the bundle for each kind of moment. 'crit' is also what the camera mode's S判定 should call. */
function shake(dur, mag){
  if (reduceMotion) return;
  const now = G.shake > 0 ? G.shakeMag * G.shake / G.shakeDur : 0;
  G.shake = Math.max(G.shake, dur); G.shakeDur = G.shake; G.shakeMag = Math.max(now, mag || 2);
}
function slowmo(dur, scale){
  if (!G.slow || scale <= G.slow.scale) G.slow = { t: Math.max(dur, G.slow ? G.slow.t : 0), scale };
  else G.slow.t = Math.max(G.slow.t, dur);
}
function feel(kind){
  if (kind === 'crit'){ G.stop = Math.max(G.stop, 0.06); slowmo(0.12, 0.15); shake(0.22, 4); buzz('crit'); }
  else if (kind === 'rare'){ G.stop = Math.max(G.stop, 0.08); slowmo(0.3, 0.3); shake(0.2, 2); buzz('rare'); }
  else if (kind === 'kill'){ G.stop = Math.max(G.stop, 0.14); slowmo(0.35, 0.2); shake(0.45, 5); buzz('kill'); }
  else if (kind === 'finish'){ G.stop = Math.max(G.stop, 0.18); slowmo(0.55, 0.1); shake(0.7, 8); buzz('finish'); G.bars = 1; }
}

function makeFoe(key, x, opt){
  const k = KINDS[key], o = opt || {}, boost = G.ouma ? 1.5 : 1;
  const f = { key, ...k, h: k.spr ? YATLAS[k.spr][0].h : k.h, x, y: k.fly ? -k.fly : 0, atkAnim: -1, post: 0, vy: 0, kb: 0, flash: 0, ph: Math.random() * 6, dead: false, pending: false, flee: false,
    atkT: rnd(1.4, 2.6), wind: 0, state: 'come', gold: !!o.gold, lane: Math.round(rnd(0, 7)), slot: k.tier === 'fodder' ? rnd(0, 34) : rnd(0, 16) };
  // the road decides how tough the yokai are (its recommended rank); the shadow's rank decides how hard it cuts
  const st = STAGES[STAGE], sm = lvMul(st.rec);
  f.hp = Math.max(1, Math.round(k.hp * boost * sm * (f.gold ? 2 : 1) * (o.weak ? 0.45 : 1))); f.hpMax = f.hp; f.kvx = 0;
  f.dmg = Math.round(k.dmg * (G.ouma ? 1.3 : 1) * (1 + 0.15 * STAGE)); f.soul = Math.round(k.soul * (G.ouma ? 1.5 : 1) * (f.gold ? 10 : 1) * (1 + 0.3 * STAGE));
  if (f.gold) f.name = '金の' + k.name;
  G.foes.push(f); return f;
}
// normally about one yokai on screen; the longer the fight drags on, the more gather
function updateSpawns(dt){
  const n = alive().length;
  G.sinceClear = n === 0 ? 0 : G.sinceClear + dt;
  if (G.arena) return;
  if (G.hyakki){
    const h = G.hyakki; h.t += dt; h.gap -= dt;
    // a safety net: if ぬらりひょん is gone without being cut (left behind the shadow), or the night drags on too long, it ends
    if ((h.boss && !G.foes.some(f => f.key === 'nura' && !f.dead)) || h.t > 150){ endHyakki('百鬼夜行は去った'); return; }
    if (h.left > 0 && h.gap <= 0 && n < 16){ h.gap = rnd(0.16, 0.3); h.left--; makeFoe(pick(FODDER.concat(['kappa', 'tanuki'])), G.x + LW + 20 + Math.random() * 40, { weak: true }); }
    if (h.left <= 0 && !h.boss && n < 4){ h.boss = true; makeFoe('nura', G.x + LW + 60); G.texts.push({ x: LW / 2, y: LH * 0.28, s: 'ぬらりひょん', t: 0, dur: 1.6, c: '#d6ff7a', big: true }); }
    return;
  }
  G.spawnT -= dt * (G.ouma ? 1.6 : 1);
  if (G.spawnT > 0) return;
  G.spawnT = rnd(1.6, 2.8);
  const cap = Math.min(8, 1 + Math.floor(G.sinceClear / 4) + (G.ouma ? 2 : 0));
  if (n >= cap) return;
  const edgeX = G.x + LW + 30;
  if (G.kills >= G.nextBig){ G.nextBig += 25; makeFoe(pick(TAISHO), edgeX + 40); makeFoe(pick(FODDER), edgeX); return; }
  if (n === 0 && Math.random() < 0.05){ makeFoe('zashiki', edgeX); return; }
  if (Math.random() < 0.01){ startHyakki(); return; }
  if (Math.random() < 0.35) makeFoe(pick(NORMALS), edgeX, { gold: Math.random() < 0.07 });
  else { makeFoe(pick(FODDER), edgeX); if (Math.random() < 0.18) makeFoe(pick(FODDER), edgeX + 26); }
}
function endHyakki(msg){
  G.hyakki = null; G.spawnT = 3;
  for (const f of G.foes) if (!f.dead && !f.pending && f.key === 'nura') f.flee = true;
  if (msg) G.texts.push({ x: LW / 2, y: LH * 0.42, s: msg, t: 0, dur: 1.8, c: '#c9a7ff', big: true });
}
function startHyakki(){
  if (G.hyakki || G.arena) return;
  G.hyakki = { t: 0, left: 70, boss: false, gap: 0 }; G.flash = 0.25;
  showBanner('百鬼夜行', true);
}
// a boss gate: the road stops, the small fry scatter, only the boss remains
function startArena(key){
  if (G.arena || G.hyakki) return;
  G.arena = { key, t: 0 };
  for (const f of alive()) if (f.tier !== 'boss') f.flee = true;
  const b = makeFoe(key || 'shuten', G.x + LW * 0.85); b.arena = true;
  G.flash = 0.2; showBanner(b.name + 'の関', true);
}

/* ---------- hero clips ---------- */
// over: a skill's changes to the move (damage, reach, effects); see castSkill in skills1.js
function playClip(key, fast, over){
  const c = over ? Object.assign({}, CLIPS[key], over) : CLIPS[key]; G.clip = c; G.clipKey = key; G.ci = 0; G.ct = 0; G.fast = !!fast;
  G.pose = [c.a, c.frames[0]];
  if (c.hit != null){ G.moveName = c.name; play('swing', 0.5, 1.05); if (!c.skill && G.mode !== 'kishin') G.texts.push({ x: HXS + 4, y: FEET - 150 + G.lift, s: c.name, t: 0, dur: 0.55, c: '#e9eeff', small: true }); }
  if (c.hit === 0) doHit();
}
function frontFoe(){ let best = null; for (const f of alive()){ const dx = edge(f); if (dx > -40 && (!best || dx < edge(best))) best = f; } return best; }
function inReach(extra){ const f = frontFoe(); return f && edge(f) <= REACH_HIT + (extra || 10); }
// a yokai flying at or above head height in front of the shadow
const airFoe = () => { const f = frontFoe(); return f && f.fly && f.y < -45 && edge(f) <= REACH_HIT + 40 ? f : null; };
function nextAttackFrom(hub){
  const list = ATTACKS[hub]; if (!list) return null;
  // against a flier the shadow goes up first: a leap, a rising dragon or a rising cut, never a cut into empty air
  if (airFoe()){
    if (hub === '中') return weighted([['leap', 3], ['shoryu', 3], ['kiriage', 2]]);
    if (hub === '屈') return Math.random() < 0.5 ? 'shoryu' : 'leap';
    if (hub === '昇') return 'shoryu';
  }
  let k = weighted(list);
  if (k === G.last && list.length > 1 && Math.random() < 0.6) k = weighted(list);
  return k;
}
function onClipEnd(){
  const c = G.clip; G.hub = c.to; G.clip = null; G.last = G.clipKey; G.lift = 0; G.idleT = 0;
  if (c.chin != null) chin();
  if (G.mode === 'iai') setMode('fight');
  if (G.mode !== 'fight') return;
  if (G.hub === '傷'){
    if (G.hp <= 0){ setMode('down'); playClip('down'); return; }
    playClip('hurtBack', G.buf); return;
  }
  // a two-part skill goes straight into its second part
  if (c.then){ playClip(c.then, false, Object.assign({ name: c.name, skill: c.skill, heavy: true }, c.thenOver || {})); return; }
  const near = inReach(30);
  if (G.buf && near){
    const a = nextAttackFrom(G.hub);
    if (a){ G.buf = false; playClip(a); return; }
    playClip(RETURNS[G.hub], true); return;
  }
  if (G.hub === '中'){ G.wait = 0; G.breathT = 0; G.pose = ['b01', 0]; breathe(G.combo >= 10); return; }
  if (FLOW.has(G.hub) && near){ playClip(nextAttackFrom(G.hub)); return; }
  if (G.hub === '昇' && near && Math.random() < 0.4){ playClip('shoFuri'); return; }
  if (RETURNS[G.hub]){ playClip(RETURNS[G.hub], !near); return; }
  if (G.hub === '上'){ playClip('kesa', true); return; }
  if (G.hub === '脇'){ playClip('oroshiA', true); return; }
  if (G.hub === '屈'){ playClip('ageTsuki', true); return; }
  if (G.hub === '空'){ playClip('kabuto', true); return; }
}
function requestStrike(){
  G.tapHit = true;
  if (G.mode === 'fight'){
    const near = inReach(30);
    if (!G.clip){ if (near){ const a = nextAttackFrom(G.hub); if (a) playClip(a); } else G.buf = true; return; }
    const c = G.clip;
    // cancel: a return, or a strike that has already landed, gives way to the next strike at once
    if (near && c.hit == null && c.name === '戻り'){ const a = nextAttackFrom('中'); if (a){ G.hub = '中'; G.buf = false; G.ghosts.push({ a: G.pose[0], f: G.pose[1], t: 0, lift: G.lift, wx: G.x }); playClip(a); return; } }
    if (near && c.hit != null && G.ci > c.hit && ATTACKS[c.to]){ G.ghosts.push({ a: G.pose[0], f: G.pose[1], t: 0, lift: G.lift, wx: G.x }); G.hub = c.to; G.lift = 0; const a = nextAttackFrom(c.to); if (a){ playClip(a); return; } }
    G.buf = true;
  } else if (G.mode === 'iai' || G.mode === 'dash' || G.mode === 'notice') G.buf = true;
}
// the click of the guard: generals and bosses whose strength ran out fall now
function chin(){
  play('draw', 0.8, 1.7);
  if (G.mode === 'kake'){ G.kake.cutT = 0; return; }
  if (G.mode === 'kishin'){ kishinRelease(); return; }
  const pend = G.foes.filter(f => f.pending && !f.dead);
  for (const f of pend) killFoe(f, 'h', true);
  if (pend.length){
    const boss = pend.some(f => f.tier === 'boss');
    feel(boss ? 'finish' : 'kill');
    G.flash = boss ? 0.22 : 0.12; play('burst', 0.9); play('slashH', 0.8, 0.85);
    G.texts.push({ x: LW / 2, y: LH * 0.3, s: '退治', t: 0, dur: 1.2, c: '#e6bb55', big: true });
    if (pend.some(f => f.arena)){ G.arena = null; G.nextGate = G.x + GATE; G.spawnT = 3; G.texts.push({ x: LW / 2, y: LH * 0.42, s: '関を越えた', t: 0, dur: 1.6, c: '#e6bb55', big: true }); }
  }
}

/* ---------- striking ---------- */
// where a cut lands, measured from the shadow to the yokai's front edge. A skill can give its own [near, far] (added to the reach)
function rangeOf(c){
  if (Array.isArray(c.range)) return [c.range[0], REACH_HIT + c.range[1]];
  const r = c.range || 'front';
  if (r === 'around') return [-50, REACH_HIT + 40];
  if (r === 'thrust') return [-30, REACH_HIT + 34];
  if (r === 'iai') return [-30, REACH_HIT + 30];
  return [-30, REACH_HIT + 12];
}
function hurtFoe(f, c, dmg, arc, crit){
  f.hp = Math.max(0, f.hp - dmg); f.flash = crit ? 0.1 : 0.06;
  const react = c ? c.react : null, air = f.y < -4 && !f.fly, heavy = c && c.heavy;
  // every strike drives the yokai back (a slide, see KNOCK_V), so the shadow cuts its way forward and nothing walks through it
  const push = (react === 'push' ? 26 : heavy ? 20 : 12) * (crit ? 1.6 : 1) + ((c && c.knock) || 0);
  if (!f.poise){
    f.kvx = Math.max(f.kvx || 0, push * KNOCK_V);
    if (react === 'launch'){ f.vy = air ? -200 : -360; f.y = Math.min(f.y, -2); }
    else if (react === 'slam' && (air || f.fly)){ f.vy = 620; f.downT = f.fly ? 1.4 : 0; }
    else if (air) f.vy = Math.min(f.vy, -140);
    f.kb = crit ? 7 : 4;
  } else { if (!G.arena) f.kvx = Math.max(f.kvx || 0, push * KNOCK_V * POISE_KNOCK); f.kb = crit ? 5 : 3; }
  f.atkT = Math.max(f.atkT, 0.5); f.wind = 0;
  const sx = SX(f.x), sy = bodyY(f);
  if (crit){
    G.texts.push({ x: sx + rnd(-4, 4), y: sy - f.h * 0.35, s: String(dmg), t: 0, dur: 0.8, c: '#ffd66b', crit: true });
    G.texts.push({ x: sx, y: sy - f.h * 0.35 - 16, s: '会心', t: 0, dur: 0.8, c: '#ff7a4a', crit: true });
    fx('ringB', sx, sy, { sc: 0.35, grow: 2.2, a: 0.9, add: true, sp: 1.6 });
    fx('spark', sx, sy, { sc: 1.8, rot: rnd(0, 6.28), add: true });
  } else G.texts.push({ x: sx + (Math.random() * 10 - 5), y: sy - f.h * 0.35, s: String(dmg), t: 0, dur: 0.65, c: G.combo >= 10 ? '#ffd66b' : '#ffffff' });
  burst(sx, sy, 6 + Math.min(G.combo, 8) + (crit ? 10 : 0), !!crit);
  fx('spark', sx + rnd(-6, 6), sy + rnd(-8, 8), { sc: heavy ? 1.15 : 0.8, rot: rnd(0, 6.28), add: true });
  if (f.hp <= 0){
    if (f.tier === 'taisho' || f.tier === 'boss'){ f.pending = true; f.flash = 0; f.kb = 0; f.vy = 0; G.texts.push({ x: sx, y: sy - f.h * 0.6, s: '…', t: 0, dur: 1.2, c: '#ffffff' }); }
    else killFoe(f, arc || 'h', false);
  }
}
function critChance(){ return (G.tapHit ? CRIT_TAP : CRIT_AUTO) + Math.min(CRIT_COMBO_MAX, G.combo * CRIT_COMBO) + eqAdd('crit'); }
function doHit(){ const c = G.clip; if (c) strike(c, false); }
// one landing of the blade. echo: an extra thrust of 五月雨突き (no new blade flash, no new wave)
function strike(c, echo){
  const [r0, r1] = rangeOf(c), heavy = !!c.heavy;
  if (!echo && c.arc) G.arcs.push({ type: c.arc, t: 0, dur: c.arc === 'thrust' ? 0.12 : 0.15, lift: G.lift });
  if (echo) G.arcs.push({ type: 'thrust', t: 0, dur: 0.08, lift: G.lift + rnd(-10, 10) });
  // 鬼神斬's flurry only shows the blade; its hits all come at the click of the guard
  if (G.noHit){ play('swing', 0.35, 1.5, 0.15); return; }
  const targets = alive().filter(f => { const dx = edge(f); if (dx < r0 || dx > r1 + (f.tier === 'rare' ? 50 : 0)) return false; if (!c.air && f.y < -70 && c.arc !== 'up' && G.lift > -30) return false; return true; });
  if (!echo){
    if (c.range === 'wave' || c.wave) G.waves.push({ x: G.x + REACH * 0.5, t: 0, hit: new Set(targets), life: c.wave ? 1.1 : 0.6, v: c.wave ? 520 : 380, mul: c.wave ? c.mul : 0.7, react: c.wave ? 'launch' : 'slam', big: !!c.wave });
    if (c.shot) spawnShot(c);
    if (c.multi) for (let i = 1; i <= c.multi; i++) G.echo.push({ t: i * 0.055, c });
    if (c.ki) G.ki = Math.min(KI_MAX, G.ki + c.ki);
    skillFx(c, targets[0] || null);
  }
  if (!targets.length){ if (!echo && c.range !== 'wave' && !c.wave && !c.shot) play('swing', 0.35, 1.3); return; }
  // the strike carries the shadow forward with it
  if (!G.arena && !echo) G.x += heavy ? 14 : 9;     // at a boss gate the road does not move
  const chained = G.time - G.lastHit < CHAIN;
  G.combo = (chained ? G.combo : 0) + targets.length; G.lastHit = G.time; G.best = Math.max(G.best, G.combo);
  G.ki = Math.min(KI_MAX, G.ki + targets.length);
  const crit = targets.length && Math.random() < critChance();
  for (const f of targets){
    const dmg = Math.round(heroDmg() * (heavy ? 1.5 : 1) * (c.mul || 1) * (1 + 0.06 * Math.min(G.combo - 1, 20)) * (0.9 + Math.random() * 0.2) * (crit ? 2 : 1));
    hurtFoe(f, c, dmg, c.arc, crit);
  }
  const f0 = targets[0], ex = SX(f0.x), ey = bodyY(f0);
  if (echo){ fx('spark', ex + rnd(-8, 8), ey + rnd(-10, 10), { sc: 0.9, rot: rnd(0, 6.28), add: true }); play('slashL', 0.6, comboRate(G.combo) * 1.1, 0.02); if (crit){ G.crits++; feel('crit'); } return; }
  slashFx(c, ex, ey, heavy || G.combo >= 10 || crit);
  G.stop = Math.max(G.stop, Math.min(0.14, (heavy ? 0.08 : 0.05) + targets.length * 0.008 + Math.min(G.combo, 10) * 0.003));
  shake(Math.min(0.2, (heavy ? 0.12 : 0.07) + targets.length * 0.01), c.skill ? 3 : 2);
  // the cut's pitch climbs with the chain (see comboRate)
  play(G.combo >= 10 || heavy || crit ? 'slashH' : 'slashL', 0.85, comboRate(G.combo), 0.02);
  if (crit){ G.crits++; play('draw', 0.55, 2.2 * comboRate(G.combo), 0.02); feel('crit'); }
  else if (G.tapHit) buzz('hit');
  G.tapHit = false;
}
// the corpse splits along the cut and dissolves into ink; souls fly to the counter (or rewards burst out, see spawnLoot)
function killFoe(f, arc, big){
  f.dead = true; G.kills++;
  const sx = SX(f.x), my = bodyY(f) + f.h * 0.05, sy = my + f.h * 0.5;   // sy: the yokai's lowest point on screen
  const fw = f.spr ? Math.max(...YATLAS[f.spr].map(r => r.w)) : f.w;
  const cv = mk(fw * 2 + 40, f.h * 2 + 40), cc = cv.getContext('2d');
  drawFoe(cc, f, cv.width / 2, cv.height - 10 - (f.center ? Math.round(f.h / 2) : 0), true);
  const side = Math.random() < 0.5 ? -1 : 1;
  const ang = arc === 'up' ? -0.6 : arc === 'down' ? 0.65 : arc === 'thrust' ? 0.12 * side : 0.55 * side;
  G.corpses.push({ cv, wx: f.x, y: f.y + f.lane + (f.center ? Math.round(f.h / 2) : 0), fh: f.h, ang, t: 0, dur: big ? 1.0 : 0.75, big, inked: false });
  burst(sx, my, big ? 60 : 16 + Math.min(G.combo, 12), big);
  if (f.key === 'chochin'){ fx('explode', sx, my, { sc: 1.1 }); fx('flame', f.x, FEET + f.lane - 2, { world: true, loop: 0.9, fade: 0.35 }); }
  else if (f.key === 'hibi') fx('explode', sx, my, { sc: 0.7 });
  else if (big){ fx('explode', sx, my, { sc: Math.max(1.4, f.w / 55) }); if (f.tier === 'boss') fx('thunder', sx, FEET + 4, { sc: 1.5, add: true }); }
  else fx('puff', sx, my + f.h * 0.05, { sc: f.tier === 'fodder' ? 1.5 : 2.0, a: 0.85 });
  if (f.tier === 'rare') fx('pillarG', f.x, FEET + f.lane, { world: true, loop: 1.6, fade: 0.5, add: true });
  // generals, bosses, zashiki-warashi and golden yokai burst into rewards; the rest send their souls straight to the counter
  if (!spawnLoot(f, sx, my)){
    const n = Math.min(24, 2 + Math.round(Math.sqrt(f.soul) * 2));
    for (let i = 0; i < n; i++) G.souls.push({ x: sx, y: my, vx: rnd(-80, 80), vy: rnd(-160, -40), t: 0, gold: f.gold || f.tier === 'rare' });
    G.soul += Math.round(f.soul * eqMul('soul'));
  }
  gainXp(f.tier === 'rare' ? 12 : f.soul);   // zashiki-warashi's luck is in its rewards, not in experience
  if (f.tier === 'rare'){ G.luck = 300; G.texts.push({ x: LW / 2, y: LH * 0.3, s: '幸運', t: 0, dur: 1.4, c: '#e6bb55', big: true }); play('burst', 0.6, 1.4); feel('rare'); }
  if (f.key === 'nura' && G.hyakki){ G.soul += 500; endHyakki('百鬼夜行 退治'); }
  if (!big) play(f.tier === 'fodder' ? 'slashL' : 'slashH', 0.5, 1.2);
}

/* ---------- rewards that burst out ----------
   Each reward is thrown up from the body, falls under gravity, bounces on the road a few times, rests a moment,
   then hops and is pulled into its counter at the top of the screen. Spirit orbs (霊玉) carry the yokai's souls between them,
   so the counter ticks up as they arrive; coins (小判), gear (装具) and scrolls (巻物) are counted one by one.
   While they lie on the road they belong to the road (they scroll with it); once pulled they belong to the screen. */
const LOOT_G = 1300;   // gravity on the rewards (stronger than the yokai's 900, so the burst is quick and snappy)
function spawnLoot(f, sx, sy){
  const tab = f.tier === 'boss' ? LOOT.boss : f.tier === 'taisho' ? LOOT.taisho : f.tier === 'rare' ? LOOT.rare : f.gold ? LOOT.gold : null;
  if (!tab) return false;
  const [n, coins, chance, sure, makiChance] = tab, luck = G.luck > 0 ? 2 : 1;
  let gear = sure; for (let i = 0; i < 2; i++) if (Math.random() < chance * luck) gear++;
  const maki = Math.random() < makiChance * luck ? 1 : 0;
  const soul = Math.round(f.soul * eqMul('soul')), orbs = Math.max(1, n - gear - maki - coins), each = Math.floor(soul / orbs); let extra = soul - each * orbs;
  const ground = FEET - 2 + f.lane * 0.5;
  for (let i = 0; i < n; i++){
    const type = i < gear ? 'gear' : i < gear + maki ? 'maki' : i < gear + maki + coins ? 'koban' : 'tama';
    const val = type === 'tama' ? each + (extra-- > 0 ? 1 : 0) : 1;
    const special = type === 'gear' || type === 'maki';
    const up = special ? rnd(700, 860) : rnd(380, 760);
    G.drops.push({ type, val, rare: special && f.tier === 'rare', st: 'air', t: -i * 0.008 - (special ? 0.1 : 0), b: 0,
      wx: f.x + rnd(-f.w * 0.25, f.w * 0.25), y: sy + rnd(-10, 10), vx: rnd(-260, 330), vy: -up, gy: ground + rnd(-4, 7), spin: rnd(0, 6.28), x: 0, px: 0, py: 0 });
  }
  // the burst itself: a ring on the ground, a column of light and a spray of sparks
  fx('pillarG', f.x, FEET + f.lane, { world: true, loop: 0.9, fade: 0.4, add: true, a: 0.8 });
  fx('ringO', sx, FEET - 2, { sc: 1.6, add: true });
  for (let i = 0; i < 26; i++){ const a = rnd(-3.0, -0.15), v = rnd(120, 340); G.parts.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420, life: rnd(0.4, 0.8), t: 0, c: Math.random() < 0.5 ? '#fff0a0' : '#ffffff', s: 2 }); }
  return true;
}
function stepDrops(dt){
  for (const d of G.drops){
    d.t += dt; if (d.t < 0) continue;
    d.spin += dt * 9;
    if (d.st === 'air'){
      d.vy += LOOT_G * dt; d.wx += d.vx * dt; d.y += d.vy * dt;
      if (d.type !== 'tama' && Math.random() < dt * 25) G.parts.push({ x: SX(d.wx), y: d.y, vx: rnd(-10, 10), vy: rnd(-10, 10), g: 0, life: 0.25, t: 0, c: d.rare ? '#9cff9c' : '#fff0a0', s: 1 });
      if (d.y >= d.gy){
        d.y = d.gy;
        if (d.vy > 90 && d.b < 3){ d.vy = -d.vy * 0.48; d.vx *= 0.6; d.b++; if (d.b === 1 && d.type === 'koban' && Math.random() < 0.3) play('draw', 0.1, 2.6, 0.1); }
        else { d.vy = 0; d.vx = 0; d.st = 'rest'; d.rt = rnd(0.05, 0.35) + (d.type === 'gear' || d.type === 'maki' ? 0.3 : 0); }
      }
    } else if (d.st === 'rest'){
      d.rt -= dt;
      if (d.rt <= 0){ d.st = 'suck'; d.x = SX(d.wx); d.vx = rnd(-50, 50); d.vy = -rnd(160, 240); d.ts = 0; d.px = d.x; d.py = d.y; }
    } else if (d.st === 'suck'){
      d.ts += dt;
      const T = d.type === 'koban' ? TGT.koban : d.type === 'tama' ? TGT.tama : TGT.gear;
      const dx = T.x - d.x, dy = T.y - d.y, dist = Math.hypot(dx, dy) || 1;
      const sp = 220 + 3600 * d.ts * d.ts, k = Math.min(1, dt * (5 + d.ts * 18));
      d.vx += (dx / dist * sp - d.vx) * k; d.vy += (dy / dist * sp - d.vy) * k;
      d.px = d.x; d.py = d.y; d.x += d.vx * dt; d.y += d.vy * dt;
      if (dist < 9 || (d.ts > 0.2 && (T.x - d.x) * dx + (T.y - d.y) * dy < 0)) absorb(d, T);
    }
  }
  G.drops = G.drops.filter(d => !d.done);
  if (G.pickT > 0) G.pickT -= dt;
  if (G.pop > 0) G.pop -= dt;
}
function absorb(d, T){
  d.done = true;
  G.pickN = G.pickT > 0 ? G.pickN + 1 : 0; G.pickT = 0.35;
  pickSound(G.pickN, d.type === 'maki' ? 'gear' : d.type);
  let el = ui.soul;
  if (d.type === 'gear'){ G.gear++; el = ui.gear; G.texts.push({ x: T.x - 6, y: T.y + 18, s: d.rare ? '珍しい装具' : '装具', t: 0, dur: 0.9, c: d.rare ? '#9cff9c' : '#e6bb55', small: true }); }
  else if (d.type === 'maki'){ G.maki++; el = ui.gear; G.texts.push({ x: T.x - 6, y: T.y + 18, s: '巻物', t: 0, dur: 0.9, c: '#c9a7ff', small: true }); }
  else if (d.type === 'koban'){ G.koban += d.val; el = ui.koban; }
  else G.soul += d.val;
  for (let i = 0; i < (d.type === 'tama' || d.type === 'koban' ? 3 : 10); i++) G.parts.push({ x: T.x, y: T.y, vx: rnd(-60, 60), vy: rnd(-50, 40), g: 0, life: 0.25, t: 0, c: d.type === 'tama' ? '#9fe0ff' : '#fff0a0', s: 1 });
  if (G.pop <= 0 && el){ G.pop = 0.06; try { el.animate([{ transform: 'scale(1.55)', color: '#ffffff' }, { transform: 'scale(1)' }], { duration: 170 }); } catch (e) {} }
}
function drawDrop(c, d){
  if (d.t < 0) return;
  const x = Math.round(d.st === 'suck' ? d.x : SX(d.wx)), y = Math.round(d.y);
  if (d.st !== 'suck'){ const s = d.type === 'tama' || d.type === 'koban' ? 7 : 11; px(c, x - s / 2, d.gy + 2, s, 2, 'rgba(4,3,12,0.5)'); }
  else { c.globalAlpha = 0.55; c.strokeStyle = d.type === 'tama' ? '#9fe0ff' : d.rare ? '#9cff9c' : d.type === 'maki' ? '#c9a7ff' : '#f2d27a'; c.lineWidth = d.type === 'tama' || d.type === 'koban' ? 2 : 3; c.beginPath(); c.moveTo(d.px, d.py); c.lineTo(d.x, d.y); c.stroke(); c.globalAlpha = 1; }
  if (d.type === 'tama'){
    // a spirit orb: soft blue halo, pale core, white heart
    c.globalAlpha = 0.3; px(c, x - 4, y - 3, 9, 7, '#5aa8ff'); px(c, x - 3, y - 4, 7, 9, '#5aa8ff'); c.globalAlpha = 1;
    px(c, x - 2, y - 2, 5, 5, '#9fe0ff'); px(c, x - 3, y - 1, 7, 3, '#9fe0ff'); px(c, x - 1, y - 3, 3, 7, '#9fe0ff');
    px(c, x - 1, y - 1, 2, 2, '#ffffff');
  } else if (d.type === 'koban'){
    // a gold oval coin that turns as it flies
    const w = Math.max(1, Math.round(7 * Math.abs(Math.cos(d.spin)))), l = x - Math.floor(w / 2);
    px(c, l, y - 4, w, 9, '#a8812a'); px(c, l + (w > 2 ? 1 : 0), y - 5, Math.max(1, w - 2), 11, '#a8812a');
    if (w > 2) px(c, l + 1, y - 3, w - 2, 7, '#f2d27a');
    if (w > 4){ px(c, l + 1, y - 3, 1, 3, '#fff6c8'); px(c, x, y - 2, 1, 5, '#c9a03a'); }
  } else if (d.type === 'gear'){
    // gear: a small gold sword guard with its hole, glinting; the rare kind glows green
    const glow = d.rare ? '#9cff9c' : '#ffe9a0';
    c.globalAlpha = 0.28 + 0.2 * Math.sin(d.spin); px(c, x - 8, y - 8, 17, 17, glow); c.globalAlpha = 1;
    px(c, x - 4, y - 6, 9, 13, '#a8812a'); px(c, x - 6, y - 4, 13, 9, '#a8812a'); px(c, x - 5, y - 5, 11, 11, '#a8812a');
    px(c, x - 4, y - 4, 9, 9, '#f2d27a'); px(c, x - 3, y - 5, 7, 11, '#f2d27a'); px(c, x - 5, y - 3, 11, 7, '#f2d27a');
    px(c, x - 1, y - 3, 3, 7, '#2a1c10'); px(c, x - 4, y - 3, 1, 2, '#fff6c8');
    if (Math.sin(d.spin * 1.7) > 0.75){ px(c, x + 5, y - 10, 1, 5, '#ffffff'); px(c, x + 3, y - 8, 5, 1, '#ffffff'); }
  } else {
    // scroll (巻物): paper with gold rollers and a purple cord
    c.globalAlpha = 0.28 + 0.2 * Math.sin(d.spin); px(c, x - 9, y - 6, 19, 13, '#c9a7ff'); c.globalAlpha = 1;
    px(c, x - 6, y - 3, 13, 7, '#ece0c2'); px(c, x - 8, y - 4, 3, 9, '#c9a03a'); px(c, x + 6, y - 4, 3, 9, '#c9a03a');
    px(c, x - 8, y - 4, 1, 9, '#8a6a2a'); px(c, x + 8, y - 4, 1, 9, '#8a6a2a');
    px(c, x - 1, y - 3, 2, 7, '#7a3cc8'); px(c, x - 1, y + 4, 1, 3, '#7a3cc8'); px(c, x + 1, y + 4, 1, 2, '#7a3cc8');
    px(c, x - 4, y - 1, 2, 1, '#8a7a5a'); px(c, x + 3, y + 1, 2, 1, '#8a7a5a');
  }
}

/* ---------- flying slashes (風刃) ----------
   a crescent that flies along the road at chest height and cuts every yokai it passes, fliers included */
function spawnShot(c){
  G.shots.push({ x: G.x + 46, y: FEET - 72 + G.lift, t: 0, hit: new Set(), mul: c.mul || 1, v: 560 });
  play('swing', 0.7, 0.8, 0.02);
}
function stepShots(dt){
  for (const s of G.shots){
    s.t += dt; s.x += s.v * dt;
    for (const f of alive()) if (!s.hit.has(f) && Math.abs(f.x - s.x) < f.w * 0.5 + 12){
      s.hit.add(f); G.combo++; G.lastHit = G.time; G.best = Math.max(G.best, G.combo); G.ki = Math.min(KI_MAX, G.ki + 1);
      hurtFoe(f, { react: 'push' }, Math.round(heroDmg() * s.mul * (1 + 0.06 * Math.min(G.combo, 20))), 'h');
      play('slashL', 0.6, comboRate(G.combo), 0.02);
    }
    if (Math.random() < dt * 40) G.parts.push({ x: SX(s.x) - 10, y: s.y + rnd(-10, 10), vx: -rnd(40, 90), vy: rnd(-10, 10), g: 0, life: 0.25, t: 0, c: '#d8f0ff', s: 1 });
  }
  G.shots = G.shots.filter(s => s.t < 1.6 && SX(s.x) < LW + 80);
}
function drawShots(c){
  for (const s of G.shots){
    const i = fxFrame(FXATLAS.moon, 0.08, false), x = SX(s.x);
    fxDraw(c, 'moon', i, x - 18, s.y, { sc: 0.9, sx: 1.2, sy: 0.75, a: 0.35, add: true });
    fxDraw(c, 'moon', i, x, s.y, { sc: 1.1, sx: 1.2, sy: 0.85, add: true });
  }
}
// the extra look of each skill at the moment it lands
function skillFx(c, f){
  if (!c.skill) return;
  const ex = f ? SX(f.x) : HXS + REACH, ey = f ? bodyY(f) : FEET - 70;
  if (c.skill === 'raikiri'){ fx('thunder', ex, FEET + 4, { sc: 1.4, add: true }); fx('bolt', ex, ey, { sc: 1, add: true }); play('burst', 0.6, 1.6); shake(0.25, 4); }
  else if (c.skill === 'shoryu'){ fx('wind', HXS + 40, FEET - 110 + G.lift, { sc: 2.2, flipY: true, add: true }); fx('ringO', HXS + 30, FEET - 2, { sc: 1 }); }
  else if (c.skill === 'tsubame'){ fx('moon', HXS + 40, FEET - 120 + G.lift, { sc: 1.6, rot: -0.9, add: true }); }
  else if (c.skill === 'senpu'){ fx('ringB', HXS + 20, FEET - 60, { sc: 0.6, grow: 4, add: true }); fx('moon', HXS + 20, FEET - 60, { sc: 1.8, sy: 0.8, add: true }); }
  else if (c.skill === 'chiretsu'){ fx('ringO', HXS + 50, FEET - 2, { sc: 1.6 }); fx('thunder', HXS + 60, FEET + 4, { sc: 0.9, add: true }); shake(0.3, 4); play('burst', 0.5, 0.8); }
  else if (c.skill === 'kazeba'){ fx('moon', HXS + 50, FEET - 72 + G.lift, { sc: 1.4, sx: 1.3, sy: 0.6, add: true }); }
}

function enemyStrike(f){
  f.kb = -10; f.wind = 0;
  if (G.inv > 0){ G.texts.push({ x: HXS + 6, y: FEET - 140, s: '結界', t: 0, dur: 0.6, c: '#9fd0ff' }); return; }
  if (G.lift < -25){ G.texts.push({ x: HXS + 6, y: FEET - 140 + G.lift, s: '見切り', t: 0, dur: 0.7, c: '#9fe0ff' }); return; }
  G.hp = Math.max(0, G.hp - f.dmg);
  G.texts.push({ x: HXS + 4, y: FEET - 110, s: '-' + f.dmg, t: 0, dur: 0.7, c: '#ff6a4a' });
  G.stop = Math.max(G.stop, 0.05); shake(0.1, 2); play('slashL', 0.5, 0.7);
  for (let i = 0; i < 10; i++) G.parts.push({ x: HXS + 10, y: FEET - 70, vx: -40 - Math.random() * 90, vy: -40 - Math.random() * 80, g: 240, life: 0.45, t: 0, c: Math.random() < 0.5 ? '#07060f' : '#3b2a5a', s: 2 });
  // light hits from small fry do not break the shadow's stride; heavy ones do
  if (f.dmg >= 8 || G.hp <= 0){ G.buf = false; G.lift = 0; if (G.mode === 'fight' || G.mode === 'calm'){ setMode('fight'); playClip('hurt'); } }
}
function burst(x, y, n, big){
  for (let i = 0; i < n; i++){
    const ink = Math.random() < 0.55, a = (ink ? -0.2 : -1.6) + (Math.random() - 0.5) * (big ? 6.2 : 2.4), sp = (big ? 90 : 60) + Math.random() * (big ? 160 : 90);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (ink ? 20 : 30), g: ink ? 260 : -40, life: 0.4 + Math.random() * (big ? 0.9 : 0.5), t: 0,
      c: ink ? (Math.random() < 0.5 ? '#07060f' : '#1d1938') : (Math.random() < 0.5 ? '#9fb4ff' : '#e9eeff'), s: Math.random() < 0.3 ? 3 : 2 });
  }
}
function impact(){
  shake(0.12, 2); play('slashH', 0.45, 0.6);
  fx('ringO', HXS + 34, FEET - 2, { sc: G.clipKey === 'kabuto' ? 1.2 : 0.8 }); fx('puff', HXS + 26, FEET - 14, { sc: 1.3, a: 0.8 });
  if (G.clipKey === 'kabuto') fx('thunder', HXS + 46, FEET + 4, { sc: 1.1, add: true });
  for (let i = 0; i < 22; i++){ const s = i % 2 ? 1 : -1; G.parts.push({ x: HXS + 30 + s * Math.random() * 10, y: FEET - 2, vx: s * (40 + Math.random() * 120), vy: -20 - Math.random() * 60, g: 220, life: 0.45, t: 0, c: Math.random() < 0.5 ? '#4a4382' : '#6a62a8', s: 2 }); }
}
function stepClip(dt){
  if (!G.clip) return;
  const c = G.clip, sp = G.fast ? 1.8 : 1;
  G.ct += dt * sp;
  while (G.clip === c && G.ct >= c.dt[G.ci]){
    G.ct -= c.dt[G.ci];
    const prev = G.pose.slice();
    G.ci++;
    if (G.ci >= c.frames.length){ onClipEnd(); return; }
    if (c.hit != null) G.ghosts.push({ a: prev[0], f: prev[1], t: 0, lift: G.lift, wx: G.x });
    G.pose = [c.a, c.frames[G.ci]];
    if (c.impact === G.ci) impact();
    if (c.hit === G.ci){ doHit(); if (G.stop > 0) break; }
  }
  if (G.clip === c && c.lift){
    const a = c.lift[G.ci], b = c.lift[Math.min(G.ci + 1, c.lift.length - 1)];
    G.lift = a + (b - a) * Math.min(1, G.ct / c.dt[G.ci]);
  } else if (G.clip === c) G.lift = 0;
}
// between strikes in the middle guard: the breathing loop while waiting, the sliding step while closing in
function idlePose(kind, dt){
  if (G.hub !== '中' || G.clip) return;
  G.idleT += dt;
  if (kind === 'step') G.pose = ['b02', Math.floor(G.idleT / SURI_DT) % ATLAS.b02.length];
  else G.pose = ['b01', Math.floor(G.idleT / BREATH_DT) % ATLAS.b01.length];
}

/* ---------- 駆け抜け一閃 ----------
   a white flash, a cut line across the screen, the shadow stands past them with its back turned, sheathes,
   and at the click of the guard every yokai it passed falls in turn; the survivors stagger out ahead */
function canKake(){ return G.ki >= KI_MAX && alive().some(f => edge(f) < LW * 0.6); }
function startKake(){
  const ahead = alive().filter(f => edge(f) > -40 && edge(f) < LW * 0.75);
  if (!ahead.length) return false;
  const from = G.x, far = Math.max(...ahead.map(f => f.x + f.w / 2)) + 30;
  const to = Math.min(far, G.cam + (LW * 0.86 - HX));
  const passed = alive().filter(f => f.x > from - 40 && f.x < to + 10);
  G.ki = 0; G.clip = null; G.lift = 0; G.buf = false;
  G.kake = { from, to, passed, cutT: -1, idx: 0, gap: 0, done: false, fin: false };
  G.x = to; G.stop = 0.1; G.flash = 0.35; shake(0.15, 2);
  G.lines.push({ x0: SX(from) + 10, x1: SX(to) + 30, y: FEET - 72, t: 0, dur: 0.5 });
  fx('ringB', SX(from) + 10, FEET - 60, { sc: 0.5, grow: 5, loop: 0.4, fade: 0.25, add: true });
  for (let i = 0; i < 6; i++) G.ghosts.push({ a: 'c10', f: 4, t: -i * 0.02, lift: 0, wx: from + (to - from) * (i / 6) });
  play('slashH', 0.9, 0.8); play('draw', 0.7, 1.3);
  showBanner('駆け抜け一閃', true);
  for (const f of passed){ f.frozen = true; f.wind = 0; }
  setMode('kake'); G.pose = ['c10', 4]; G.kakeHold = 0.28;
  return true;
}
function updateKake(dt){
  const k = G.kake;
  if (G.kakeHold > 0){ G.kakeHold -= dt; if (G.kakeHold <= 0) playClip('noto'); return; }
  stepClip(dt);
  if (k.cutT >= 0){
    k.cutT += dt; k.gap -= dt;
    while (k.gap <= 0 && k.idx < k.passed.length){
      const f = k.passed[k.idx++]; k.gap = 0.07;
      if (f.dead) continue;
      f.frozen = false; G.combo++; G.lastHit = G.time; G.best = Math.max(G.best, G.combo);
      const dmg = f.poise ? 120 : 60;
      fx('bolt', SX(f.x), bodyY(f), { sc: Math.max(0.6, f.h / 150), flipX: Math.random() < 0.5, add: true });
      play('slashH', 0.7, comboRate(G.combo) * (1 + k.idx * 0.02), 0.02);
      buzz('hit');
      hurtFoe(f, { react: 'push', heavy: true }, dmg, 'h');
      // a survivor staggers out ahead of the shadow, ready for the next round
      if (!f.dead && !f.pending) f.x = Math.max(f.x, G.x + REACH + f.w * 0.3 + rnd(10, 50));
    }
    // the last of them falls: the heaviest moment of the run
    if (k.idx >= k.passed.length && !k.fin){ k.fin = true; feel('finish'); }
    if (k.idx >= k.passed.length && !G.clip) k.done = true;
  }
  // the view catches up with the shadow
  if (k.done){
    if (G.foes.some(f => f.pending)) chinPending();
    G.kake = null; setMode('fight'); G.drawn = true; G.hub = '中'; playClip('batto'); play('draw', 0.6);
  }
}
function chinPending(){ const m = G.mode; G.mode = 'fight'; chin(); G.mode = m; }


/* ---------- 筆文字の技名 ----------
   the name is stamped one brush character at a time onto a stroke of paper, each landing with a thud and an ink splash;
   time stands still while it is written */
// small: a skill's name, smaller and higher up, quicker, without stopping time
function showBanner(text, freeze, small){
  const chars = [...text], start = small ? 0.04 : 0.12, gap = small ? 0.07 : 0.13;
  G.banner = { chars, small: !!small, t: 0, start, gap, dur: start + chars.length * gap + (small ? 0.45 : 0.8), seed: Math.floor(Math.random() * 9999), hit: -1, splat: [],
    rot: chars.map(() => rnd(-0.09, 0.09)), dy: chars.map(() => rnd(-0.07, 0.07)) };
  if (freeze) G.stop = Math.max(G.stop, start + chars.length * gap + 0.4);
}
function bannerGeom(){ const b = G.banner, W = view.width, H = view.height, n = b.chars.length, size = b.small ? Math.min(W * 0.5 / n, 34 * K) : Math.min(W * 0.8 / n, 66 * K); return { W, H, n, size, cy: H * (b.small ? 0.2 : 0.36), x0: W / 2 - size * n / 2 }; }
function stepBanner(raw){
  const b = G.banner; if (!b) return;
  b.t += raw;
  const i = Math.floor((b.t - b.start) / b.gap);
  if (i > b.hit && i < b.chars.length && b.t >= b.start){
    b.hit = i; if (!b.small){ shake(0.07, 2); play('slashL', 0.75, 0.6 + i * 0.03); } else play('slashL', 0.3, 0.9 + i * 0.05);
    const { size, cy, x0 } = bannerGeom(), x = x0 + size * (i + 0.5);
    for (let k = 0; k < 12; k++){ const a = rnd(0, 6.283), d = rnd(size * 0.3, size * 0.75); b.splat.push({ x: x + Math.cos(a) * size * 0.12, y: cy + Math.sin(a) * size * 0.12, vx: Math.cos(a) * d, vy: Math.sin(a) * d * 0.55, r: rnd(K * 0.6, size * 0.055), t0: b.t }); }
  }
  if (b.t > b.dur) G.banner = null;
}
function drawBanner(){
  const b = G.banner; if (!b) return;
  const { W, n, size, cy, x0 } = bannerGeom();
  const fade = b.t > b.dur - 0.25 ? Math.max(0, (b.dur - b.t) / 0.25) : 1;
  let r = b.seed; const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  // a stroke of washi swept across the screen
  const sweep = Math.min(1, b.t / 0.12), bandH = size * 1.3, bx0 = W * 0.03, bx1 = bx0 + W * 0.94 * sweep, step = Math.max(1, K);
  vctx.globalAlpha = 0.94 * fade; vctx.fillStyle = '#ece0c2';
  for (let y = -bandH / 2; y < bandH / 2; y += step){
    const t = Math.abs(y) / (bandH / 2), jl = rand() * size * 0.5 * t * t * t, jr = rand() * size * 0.9 * t * t;
    if (t > 0.9 && rand() < 0.45) continue;
    vctx.fillRect(bx0 + jl, cy + y, Math.max(0, bx1 - bx0 - jl - jr), step);
  }
  vctx.fillStyle = 'rgba(150,128,92,0.35)';
  for (let k = 0; k < 16; k++){ const yy = cy + (rand() - 0.5) * bandH * 0.85; vctx.fillRect(bx0 + rand() * W * 0.15, yy, (bx1 - bx0) * (0.4 + rand() * 0.55), step); }
  // ink thrown out by each character
  vctx.fillStyle = '#0c0a0a';
  for (const s of b.splat){ const g = Math.min(1, (b.t - s.t0) / 0.07); vctx.globalAlpha = fade; vctx.beginPath(); vctx.arc(s.x + s.vx * g, s.y + s.vy * g, s.r, 0, 6.283); vctx.fill(); }
  // the characters, slammed down one after another
  vctx.textAlign = 'center'; vctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++){
    const ti = b.t - (b.start + i * b.gap); if (ti < 0) break;
    const k = Math.min(1, ti / 0.07), sc = 2.6 - 1.6 * k;
    vctx.save(); vctx.translate(x0 + size * (i + 0.5), cy + b.dy[i] * size); vctx.rotate(b.rot[i]); vctx.scale(sc, sc);
    vctx.globalAlpha = Math.min(1, ti / 0.035) * fade;
    vctx.font = `${Math.round(size * 1.05)}px "Yuji Syuku", "Yu Mincho", "Hiragino Mincho ProN", serif`;
    vctx.fillStyle = '#0c0a0a'; vctx.fillText(b.chars[i], 0, size * 0.04);
    vctx.restore();
  }
  // the red seal
  if (b.t > b.start + n * b.gap + 0.12){
    const s = size * 0.4, x = Math.min(W - s * 0.7, x0 + size * n + s * 0.35), y = cy + size * 0.32;
    vctx.globalAlpha = fade; vctx.fillStyle = '#c8202a'; vctx.fillRect(x - s / 2, y - s / 2, s, s);
    vctx.fillStyle = '#ece0c2'; vctx.font = `${Math.round(s * 0.78)}px "Yuji Syuku", serif`; vctx.fillText('影', x, y + s * 0.04);
  }
  vctx.globalAlpha = 1;
}

/* ---------- yokai movement ---------- */
function updateFoes(dt){
  const list = alive().sort((a, b) => a.x - b.x);
  for (const f of G.foes){
    if (f.dead) continue;
    f.flash = Math.max(0, f.flash - dt); f.kb *= Math.pow(0.002, dt); f.post = Math.max(0, (f.post || 0) - dt); f.ph += f.pending || f.frozen ? dt * 0.1 : dt;
    if (f.flee){ f.x += 320 * dt; if (SX(f.x) > LW + 120) f.dead = true; continue; }
    // a yokai left behind the shadow (it should not happen any more, see keepAhead) is dropped; if it was ぬらりひょん the night ends
    if (!f.pending && SX(f.x) < -160){ f.dead = true; if (f.key === 'nura' && G.hyakki) endHyakki('ぬらりひょんに逃げられた'); continue; }
    if (f.pending || f.frozen) continue;
    // knockback slide
    if (f.kvx > 0){ f.x += f.kvx * dt; f.kvx *= Math.exp(-KNOCK_DECAY * dt); if (f.kvx < 8) f.kvx = 0; }
    if (f.tier === 'rare'){
      if (f.stun > 0){ f.stun -= dt; continue; }
      if (f.state === 'come' && edge(f) < LW * 0.5) f.state = 'flee';
      f.x += (f.state === 'flee' ? 1 : -1) * f.v * dt; f.flip = f.state !== 'flee';
      if (f.state === 'flee' && SX(f.x) > LW + 80){ f.dead = true; G.texts.push({ x: LW * 0.7, y: LH * 0.35, s: '逃げられた', t: 0, dur: 1.0, c: '#e6bb55' }); }
      continue;
    }
    // walk in until the front edge reaches the shadow; the crowd is allowed to overlap
    const want = G.x + CONTACT + f.w * 0.3 + f.slot;
    if (f.x > want && !(f.kvx > 15)) f.x = Math.max(want, f.x - f.v * dt);
    // air: launched yokai fall back, slammed ones bounce; fliers hover above the head and swoop to strike
    const home = f.fly ? -(f.downT > 0 ? 0 : (f.wind > 0 ? f.fly - 70 * f.wind : f.fly)) : 0;
    if (f.downT > 0) f.downT -= dt;
    if (f.vy || f.y < home - 1 || f.y > home + 1){
      if (f.vy || !f.fly){
        f.vy += 900 * dt; f.y += f.vy * dt;
        if (f.y >= home){ if (f.vy > 420){ f.vy = -f.vy * 0.28; impactAt(f); } else f.vy = 0; f.y = home; if (Math.abs(f.vy) < 40) f.vy = 0; }
      } else f.y += (home - f.y) * Math.min(1, dt * 5);
    }
  }
  // the yokai at the front (up to three) can strike, each on its own timer
  let i = 0;
  for (const f of list){
    if (f.tier === 'rare') continue;
    const dx = edge(f);
    if (i < 3 && dx <= CONTACT + 26 && f.y > -(f.fly || 0) - 20 && !['down', 'walk', 'dash', 'kake'].includes(G.mode)){
      const W = f.tier === 'boss' ? 0.9 : 0.5;
      f.atkT -= dt; f.wind = f.atkT < W ? 1 - f.atkT / W : 0;
      if (f.atkT <= 0){ f.atkT = f.tier === 'fodder' ? rnd(2.0, 3.2) : rnd(2.6, 4.2); f.post = 0.24; enemyStrike(f); }
    } else f.wind = 0;
    i++;
  }
  G.foes = G.foes.filter(f => !f.dead);
}
// no yokai ever stands behind the shadow: whenever the shadow steps forward, the ones in front are pushed ahead of it.
// (yokai frozen by a secret art and fallen generals waiting for the click of the guard are left where they are)
function keepAhead(){
  if (G.mode === 'kake') return;
  for (const f of G.foes){
    if (f.dead || f.pending || f.frozen || f.flee) continue;
    const min = G.x + CONTACT - 18 + f.w * 0.3;
    if (f.x < min) f.x = min;
  }
}
function impactAt(f){ const sx = SX(f.x); fx('ringO', sx, FEET - 2, { sc: 0.5 }); for (let i = 0; i < 10; i++){ const s = i % 2 ? 1 : -1; G.parts.push({ x: sx + s * 4, y: FEET - 2, vx: s * (30 + Math.random() * 70), vy: -10 - Math.random() * 40, g: 200, life: 0.35, t: 0, c: '#4a4382', s: 2 }); } }

/* ---------- main update ---------- */
function update(dt){
  G.time += dt;
  if (G.stop > 0){ G.stop -= dt; return; }
  G.t += dt; G.flash = Math.max(0, G.flash - dt);
  if (G.luck > 0) G.luck = Math.max(0, G.luck - dt);
  if (G.inv > 0) G.inv = Math.max(0, G.inv - dt);
  if (G.aura > 0) G.aura = Math.max(0, G.aura - dt);
  if (G.mode !== 'down') updateSpawns(dt);
  if (!G.arena && !G.hyakki && G.x >= G.nextGate && G.mode !== 'down' && G.mode !== 'kake') startArena('shuten');
  updateFoes(dt);
  const ff = frontFoe(), dx = ff ? edge(ff) : 1e9;
  if (G.mode === 'walk'){
    G.hp = Math.min(hpMax(), G.hp + dt * 3);
    const boss = ff && (ff.tier === 'taisho' || ff.tier === 'boss' || ff.tier === 'rare');
    if (boss && dx < LW * 0.62){ G.target = ff; setMode('notice'); G.mark = 0; beep(); playClip('ready'); }
    else if (ff && dx < CONTACT + 90){ setMode('fight'); G.drawn = true; G.hub = '中'; playClip('batto'); play('draw', 0.6); }
    else { G.x += WALK_V * dt; G.wt += dt; if (G.wt >= WALK_DT){ G.wt -= WALK_DT; G.wf = (G.wf + 1) % ATLAS.walk.length; } }
  } else if (G.mode === 'notice'){
    G.mark += dt; stepClip(dt);
    if (!G.clip && G.t > 0.3) setMode('dash');
  } else if (G.mode === 'dash'){
    const tg = G.target && !G.target.dead ? G.target : ff;
    G.x += DASH_V * dt;
    if (Math.random() < dt * 30) G.parts.push({ x: HXS - 6, y: FEET - 2, vx: -60 - Math.random() * 60, vy: -6 - Math.random() * 20, g: 30, life: 0.3, t: 0, c: '#3a3366', s: 2 });
    if (Math.random() < dt * 22) G.ghosts.push({ a: 'c9', f: 4, t: 0, lift: 0, wx: G.x - 6 });
    if (!tg || edge(tg) <= REACH - 10){ if (tg && tg.tier === 'rare') tg.stun = 0.8; setMode('iai'); G.drawn = true; G.gleam = 0.14; play('draw', 0.7); playClip('iai'); }
  } else if (G.mode === 'iai'){
    stepClip(dt);
  } else if (G.mode === 'kake'){
    updateKake(dt);
  } else if (G.mode === 'kishin'){
    updateKishin(dt);
  } else if (G.mode === 'fight'){
    stepClip(dt);
    if (!G.clip && G.mode === 'fight'){
      G.wait += dt;
      if (G.ki >= KI_MAX && startOugi()){}
      else if (ff && dx <= REACH_HIT + 30){
        G.clear = 0; G.breathT += dt; idlePose('breath', dt);
        if (G.breathT > 0.9){ G.breathT = 0; breathe(false); }
        // a ready skill goes first; otherwise the ordinary cut after the short wait (at once on a tap)
        if (G.wait >= 0.12 && trySkill('near')){}
        else if (G.buf || G.wait >= (G.hyakki ? 0.3 : AUTO_WAIT)){ G.buf = false; G.hub = '中'; playClip(nextAttackFrom('中')); }
      }
      else if (ff && dx < LW * 0.7 && trySkill('far')){}
      else if (ff && dx < LW * 0.7){
        // step in with the blade ready instead of standing still: the sliding step (摺り足)
        G.clear = 0; G.x += STEP_V * eqMul('step') * dt; G.stepT += dt; idlePose('step', dt);
        if (G.stepT > 0.05){ G.stepT = 0; G.ghosts.push({ a: G.pose[0], f: G.pose[1], t: 0, lift: 0, wx: G.x - 8 }); }
      } else {
        G.clear += dt; idlePose('breath', dt);
        const pend = G.foes.some(f => f.pending);
        if (G.clear > (pend ? 0.25 : 0.7)){ setMode('calm'); G.queue = pend || Math.random() < 0.5 ? ['noto'] : ['chiburi', 'chiNoto']; if (pend && Math.random() < 0.5) G.queue.push('rei', 'reiUp'); }
      }
    }
  } else if (G.mode === 'calm'){
    stepClip(dt);
    if (ff && dx < CONTACT + 60 && !G.foes.some(f => f.pending)){ G.queue = []; setMode('fight'); if (!G.drawn){ G.hub = '中'; playClip('batto'); G.drawn = true; } else if (!G.clip) G.hub = '中'; }
    else if (!G.clip){
      if (G.queue.length){ const k = G.queue.shift(); if (k === 'noto' || k === 'chiNoto') G.drawn = false; playClip(k); }
      else { setMode('walk'); G.drawn = false; G.hub = '中'; G.moveName = '―'; G.combo = 0; G.pose = ['walk', 0]; }
    }
  } else if (G.mode === 'down'){
    stepClip(dt);
    if (!G.clip && G.t > 1.2){
      const lost = !!G.hyakki, wasArena = !!G.arena;
      // back to the torii behind: the nearest one at least SETBACK behind where the shadow fell
      G.x = Math.max(0, Math.floor((G.x - SETBACK) / TORII_GAP) * TORII_GAP); G.cam = G.x; G.hp = hpMax(); G.shots = []; G.echo = []; G.foes = []; G.hyakki = null; G.arena = null; G.setbacks++; G.combo = 0; G.hub = '中'; G.moveName = '―'; G.drawn = false; G.spawnT = 3; G.ki = 0;
      G.drops = G.drops.filter(d => d.st === 'suck');   // rewards still lying on the road are lost with the run
      if (wasArena) G.nextGate = G.x + GATE * 0.6;
      G.inv = 3; setMode('walk'); G.wf = 0; G.texts.push({ x: LW / 2, y: LH * 0.3, s: '鳥居から出直し', t: 0, dur: 1.6, c: '#ff8a6a', big: true });
      if (lost) G.texts.push({ x: LW / 2, y: LH * 0.42, s: '百鬼夜行は消えた', t: 0, dur: 1.8, c: '#c9a7ff', big: true });
    }
  }
  keepAhead();
  stepSkills(dt);
  for (const e of G.echo){ e.t -= dt; if (e.t <= 0 && G.mode !== 'down') strike(e.c, true); }
  G.echo = G.echo.filter(e => e.t > 0);
  stepShots(dt);
  if (G.red > 0 && G.mode !== 'kishin') G.red = Math.max(0, G.red - dt * 1.2);
  // the view follows the shadow; after 駆け抜け一閃 it glides to catch up once the cuts have fallen
  if (G.mode === 'kake') {} else if (Math.abs(G.x - G.cam) > 0.5) G.cam += (G.x - G.cam) * Math.min(1, dt * 7); else G.cam = G.x;
  // shockwave of 兜割り runs along the ground
  // (地裂斬 sends a bigger, longer one that throws the yokai up)
  for (const w of G.waves){
    w.t += dt; w.x += (w.v || 380) * dt;
    for (const f of alive()) if (!w.hit.has(f) && Math.abs(f.x - w.x) < f.w / 2 + 6 && f.y > -40){
      w.hit.add(f); G.combo++; G.lastHit = G.time; G.best = Math.max(G.best, G.combo); G.ki = Math.min(KI_MAX, G.ki + 1);
      hurtFoe(f, { react: w.react || 'slam' }, Math.round(heroDmg() * (w.mul || 0.7) * (1 + 0.06 * Math.min(G.combo, 20))), w.big ? 'up' : 'down');
      if (w.big) fx('thunder', SX(f.x), FEET + 4, { sc: 0.7, add: true });
      play('slashL', 0.5, comboRate(G.combo), 0.02);
    }
    if (Math.random() < (w.big ? 1 : 0.8)) for (let i = 0; i < (w.big ? 3 : 1); i++) G.parts.push({ x: SX(w.x) + rnd(-6, 6), y: FEET - 2, vx: rnd(-20, 20), vy: rnd(w.big ? -200 : -90, -30), g: 260, life: 0.35, t: 0, c: Math.random() < 0.5 ? '#a9c0ff' : (w.big ? '#ffd66b' : '#4a4382'), s: 2 });
  }
  G.waves = G.waves.filter(w => w.t < (w.life || 0.6));
  for (const p of G.parts){ p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  G.parts = G.parts.filter(p => p.t < p.life);
  stepFx(dt);
  stepDrops(dt);
  for (const s of G.souls){ s.t += dt; if (s.t < 0.3){ s.vy += 300 * dt; s.x += s.vx * dt; s.y += s.vy * dt; } else { const k = Math.min(1, dt * 7); s.x += (SOUL_T.x - s.x) * k; s.y += (SOUL_T.y - s.y) * k; } }
  G.souls = G.souls.filter(s => s.t < 0.9);
  for (const c of G.corpses) c.t += dt; G.corpses = G.corpses.filter(c => c.t < c.dur);
  for (const s of G.slashes) s.t += dt; G.slashes = G.slashes.filter(s => s.t < s.dur);
  for (const a of G.arcs) a.t += dt; G.arcs = G.arcs.filter(a => a.t < a.dur);
  for (const l of G.lines) l.t += dt; G.lines = G.lines.filter(l => l.t < l.dur);
  for (const t of G.texts) t.t += dt; G.texts = G.texts.filter(t => t.t < t.dur);
  for (const g of G.ghosts) g.t += dt; G.ghosts = G.ghosts.filter(g => g.t < 0.14);
  G.gleam = Math.max(0, G.gleam - dt);
}

/* ---------- drawing ---------- */
// sprite yokai: idle bob, lean back while winding up, the boss swings its club; flash / gold / frozen / warning tints
function drawSpriteFoe(c, f, ex, base, still){
  let set = f.spr, idx = 0;
  if (f.sprAtk && !still && (f.wind > 0 || f.post > 0)){ set = f.sprAtk; const n = YATLAS[set].length; idx = f.wind > 0 ? Math.min(n - 3, Math.floor(f.wind * (n - 2))) : (f.post > 0.12 ? n - 2 : n - 1); }
  else if (YATLAS[set].length > 1) idx = Math.floor(f.ph * 7.7) % YATLAS[set].length;
  const fr = YATLAS[set][idx]; if (!fr) return;
  const bob = still || f.pending ? 0 : Math.round(Math.sin(f.ph * (f.fly ? 2.4 : 3.2)) * (f.fly ? 3 : 1.2));
  const lean = still ? 0 : Math.round((f.wind || 0) * (f.sprAtk ? 0 : 5));
  const src = still ? YIMG : f.flash > 0 ? YW : f.pending ? YD : f.gold ? YG : YIMG;
  const dx = ex + lean, dy = base + bob;
  const draw = (img, a) => {
    if (a != null) c.globalAlpha = a;
    if (f.key === 'ittan' && !still) drawRipple(c, img, fr, dx, dy, f.flip);
    else if (f.flip){ c.save(); c.translate(Math.round(dx), 0); c.scale(-1, 1); c.drawImage(img, fr.x, fr.y, fr.w, fr.h, -fr.ox - fr.w, Math.round(dy + fr.oy), fr.w, fr.h); c.restore(); }
    else c.drawImage(img, fr.x, fr.y, fr.w, fr.h, Math.round(dx + fr.ox), Math.round(dy + fr.oy), fr.w, fr.h);
    c.globalAlpha = 1;
  };
  if (!src) return;
  draw(src);
  if (!still && f.wind > 0 && YR && Math.sin(G.time * 40) > 0) draw(YR, 0.45);
  if (f.gold && !still && Math.random() < 0.3) G.parts.push({ x: ex + rnd(-f.w / 2, f.w / 2), y: base - rnd(0, f.h), vx: 0, vy: -24, g: 0, life: 0.5, t: 0, c: '#fff0a0', s: 1 });
}
function drawFoe(c, f, ex, base, still){
  if (f.spr){ drawSpriteFoe(c, f, ex, base, still); return; }
  const fl = !still && f.flash > 0, wind = still ? 0 : (f.wind || 0), pend = f.pending;
  const gold = f.gold;
  let body = fl ? '#f4f2ff' : (gold ? '#c9a03a' : (f.body || '#07060f'));
  const rim = fl ? '#ffffff' : (wind > 0 ? (Math.sin(G.time * 40) > 0 ? '#ff6a3a' : '#ffb070') : (gold ? '#fff0a0' : '#3b3870'));
  if (pend) body = '#0d0b18';
  if (f.deco === 'flame'){
    const i = fxFrame(FXATLAS.orbB, f.ph, true), y = base - f.h / 2 + Math.round(Math.sin(f.ph * 3) * 2);
    fxDraw(c, 'orbB', i, ex, y);
    if (fl || (wind > 0 && Math.sin(G.time * 40) > 0)) fxDraw(c, 'orbB', i, ex, y, { add: true, a: fl ? 0.9 : 0.5 });
    return;
  }
  if (f.deco === 'zashiki'){
    const b = base - Math.abs(Math.sin(f.ph * 12)) * 3;
    px(c, ex - 12, b - 32, 24, 32, fl ? '#fff' : '#c8303a'); px(c, ex - 14, b - 20, 28, 4, fl ? '#fff' : '#9a1f2a');
    px(c, ex - 9, b - 48, 18, 17, fl ? '#fff' : '#f2d6c0'); px(c, ex - 11, b - 54, 22, 10, fl ? '#fff' : '#0a0a12'); px(c, ex - 11, b - 44, 4, 8, '#0a0a12'); px(c, ex + 7, b - 44, 4, 8, '#0a0a12');
    px(c, ex + 12, b - 28, 8, 8, '#d24a4a'); px(c, ex + 14, b - 26, 3, 3, '#f2d27a');
    if (!still && Math.random() < 0.4) G.parts.push({ x: ex + rnd(-12, 12), y: b - rnd(0, 40), vx: 0, vy: -20, g: 0, life: 0.4, t: 0, c: '#f2d27a', s: 1 });
    return;
  }
  const rx = f.w / 2, ry = f.h / 2, cy = base - ry - 1 + (pend ? 0 : Math.round(Math.sin(f.ph * 3) * (f.h > 120 ? 1 : 2)));
  if (f.deco === 'nura'){
    for (let y = 0; y < f.h; y++){ const t = y / f.h; let hw = t < 0.42 ? rx * 0.62 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.22) / 0.22, 2))) : rx * (0.5 + (t - 0.42) * 0.9); hw = Math.round(hw); if (hw <= 0) continue;
      const col = t < 0.42 ? (fl ? '#fff' : (pend ? '#2a2638' : '#cdb79a')) : body; px(c, ex - hw, base - f.h + y, hw * 2 + 1, 1, col); if (t >= 0.42) px(c, ex + hw, base - f.h + y, 1, 1, rim); }
    if (!fl && !pend){ const ey = base - f.h + Math.round(f.h * 0.27); px(c, ex - 12, ey, 5, 3, f.eye); px(c, ex + 4, ey, 5, 3, f.eye); px(c, ex - 8, ey + 12, 16, 2, '#5a3a2a'); }
    return;
  }
  for (let y = -ry; y <= ry; y++){
    const t = y / ry; let hw = rx * Math.sqrt(Math.max(0, 1 - t * t)) * (1 + 0.05 * Math.sin(f.ph * 4 + y * 0.4)) * (1 + wind * 0.08);
    if (t > 0.6) hw = Math.max(hw, rx * 0.75);
    hw = Math.round(hw); if (hw <= 0) continue;
    px(c, ex - hw, cy + y, hw * 2 + 1, 1, body);
    if (y < 0 || wind > 0) px(c, ex + hw, cy + y, 1, 1, rim);
    if (wind > 0 || y < -ry * 0.3) px(c, ex - hw, cy + y, 1, 1, wind > 0 ? rim : '#1e1c3a');
  }
  const legs = f.w > 80 ? 6 : 4;
  for (let k = 0; k < legs; k++){ const bx = ex - rx + 4 + k * ((rx * 2 - 8) / (legs - 1)), bh = 3 + Math.round(2 * Math.sin(f.ph * 6 + k)); px(c, bx - 2, cy + ry, 4, bh, body); }
  if (!fl && !pend){
    const eyY = cy - Math.round(ry * 0.3), es = f.h > 120 ? 5 : f.h > 70 ? 4 : 3, off = Math.round(rx * 0.32);
    px(c, ex - off - es, eyY, es, es, f.eye || '#ff3b2a'); px(c, ex + off - 1, eyY, es, es, f.eye || '#ff3b2a');
    px(c, ex - off - es, eyY, 1, 1, '#ffffff'); px(c, ex + off - 1, eyY, 1, 1, '#ffffff');
  }
  if (f.deco === 'horn'){ px(c, ex - 10, cy - ry - 5, 3, 7, '#e9dcc0'); px(c, ex + 7, cy - ry - 5, 3, 7, '#e9dcc0'); }
  if (f.deco === 'dish'){ px(c, ex - 13, cy - ry - 3, 26, 4, fl ? '#fff' : '#cfe8ff'); px(c, ex - 10, cy - ry - 4, 20, 1, '#ffffff'); px(c, ex + rx - 4, cy - 6, 8, 5, '#d8b84a'); }
  if (f.deco === 'hat'){ px(c, ex - rx - 3, cy - ry + 4, f.w + 6, 4, fl ? '#fff' : '#a8814a'); px(c, ex - 14, cy - ry - 6, 28, 10, fl ? '#fff' : '#8a6a3a'); px(c, ex + rx - 6, cy + 10, 10, 12, '#c9b08a'); }
  if (f.deco === 'banner'){ px(c, ex + rx - 8, cy - ry - 52, 3, 64, '#6a5a3a'); px(c, ex + rx - 5, cy - ry - 52, 20, 32, fl ? '#fff' : '#e9e2cc'); px(c, ex + rx + 1, cy - ry - 44, 8, 8, '#c8303a'); px(c, ex - 18, cy - ry - 6, 36, 8, '#c9a03a'); px(c, ex - 16, cy - ry - 3, 32, 4, '#cfe8ff'); }
  if (f.deco === 'mouth' && !fl && !pend) px(c, ex - 20, cy - ry * 0.3 + 26, 42, 3, '#2a0f1a');
  if (gold && !still && Math.random() < 0.3) G.parts.push({ x: ex + rnd(-rx, rx), y: cy + rnd(-ry, ry), vx: 0, vy: -24, g: 0, life: 0.5, t: 0, c: '#fff0a0', s: 1 });
}
function hpBar(c, x, y, f){ const w = Math.max(26, Math.min(56, f.w)); px(c, x - w / 2 - 1, y - 1, w + 2, 4, '#05040c'); px(c, x - w / 2, y, w, 2, '#3a1420'); px(c, x - w / 2, y, Math.round(w * f.hp / f.hpMax), 2, f.gold ? '#f2d27a' : '#e2533a'); }
function drawCorpse(c, k){
  const p = k.t / k.dur, sx = SX(k.wx), w = k.cv.width, h = k.cv.height, x0 = Math.round(sx - w / 2), y0 = Math.round(FEET + k.y - h + 10);
  const ux = Math.cos(k.ang), uy = Math.sin(k.ang), nx = -Math.sin(k.ang), ny = Math.cos(k.ang);
  const cx = x0 + w / 2, cy = y0 + (h - 10) - k.fh * 0.5;      // the cut runs through the middle of the body
  const e = Math.min(1, p * 3), slide = Math.round((k.big ? 30 : 20) * e), drop = Math.round(p * p * 26);
  // after a beat the halves blink and burst into ink
  if (p > 0.42 && !k.inked){ k.inked = true; burst(cx, cy, k.big ? 40 : 22, k.big); for (let i = 0; i < 8; i++) G.parts.push({ x: cx + ux * rnd(-20, 20), y: cy + uy * rnd(-20, 20), vx: rnd(-30, 30), vy: rnd(-60, -10), g: 60, life: 0.5, t: 0, c: '#f2f4ff', s: 2 }); }
  if (p > 0.42 && Math.floor(k.t / 0.045) % 2) return;
  for (const side of [1, -1]){
    c.save(); c.beginPath();
    const L = 600;
    c.moveTo(cx - ux * L, cy - uy * L); c.lineTo(cx + ux * L, cy + uy * L); c.lineTo(cx + ux * L + nx * L * side, cy + uy * L + ny * L * side); c.lineTo(cx - ux * L + nx * L * side, cy - uy * L + ny * L * side); c.closePath(); c.clip();
    // the upper half slides away along the cut, the lower half sags
    const ox = side < 0 ? ux * slide : -ux * slide * 0.25, oy = side < 0 ? uy * slide - Math.round(6 * e) + drop : drop * 0.4;
    c.drawImage(k.cv, x0 + Math.round(ox), y0 + Math.round(oy));
    c.restore();
  }
  // the cut itself flashes white for an instant
  if (p < 0.14){ const a = 1 - p / 0.14; c.globalAlpha = a; for (let i = -w / 2; i < w / 2; i++){ const x = cx + ux * i, y = cy + uy * i; px(c, x, y - 1, 1, 3, '#ffffff'); } c.globalAlpha = 1; }
}
function drawLine(c, l){
  const k = l.t / l.dur, x0 = Math.round(l.x0), x1 = Math.round(l.x0 + (l.x1 - l.x0) * Math.min(1, k * 6)), a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
  c.globalAlpha = a; px(c, x0, l.y - 1, x1 - x0, 1, '#a9c0ff'); px(c, x0, l.y, x1 - x0, 2, '#ffffff'); px(c, x0, l.y + 2, x1 - x0, 1, '#a9c0ff'); c.globalAlpha = 1;
}
function render(){
  if (!skyC) return;
  const c = lctx, cam = G.cam;
  HXS = HX + (G.x - G.cam);
  drawBackdrop(c, cam);
  if (G.hyakki){ c.fillStyle = 'rgba(40,10,60,0.35)'; c.fillRect(0, 0, LW, LH); }
  if (G.arena){ c.fillStyle = 'rgba(60,10,10,0.25)'; c.fillRect(0, 0, LW, LH); }
  drawRoad(c, cam);
  drawTorii(c, cam);
  // 鬼神斬: the world darkens around the red shadow
  if (G.red > 0){ c.fillStyle = `rgba(30,0,6,${0.4 * G.red})`; c.fillRect(0, 0, LW, LH); }
  // yokai: back rows first, so a crowd reads as a crowd
  const list = G.foes.filter(f => !f.dead).sort((a, b) => (a.lane - b.lane) || (b.x - a.x));
  for (const f of list){
    const sx = Math.round(SX(f.x) + f.kb), base = FEET - 4 + f.lane;
    if (sx < -100 || sx > LW + 100) continue;
    if (f.y < -4){ const sw = Math.max(8, f.w * 0.8 * (1 + f.y / 260)); px(c, sx - sw / 2, base - 1, sw, 2, 'rgba(4,3,12,0.45)'); }
    // a boss or general near the end of its strength burns red
    if ((f.tier === 'boss' || f.tier === 'taisho') && !f.pending && f.hp < f.hpMax * 0.4) fxDraw(c, 'akaFire', fxFrame(FXATLAS.akaFire, f.ph, true), sx, base + Math.round(f.y) + 2, { sc: f.w / 55, a: 0.6, add: true });
    drawFoe(c, f, sx, base + Math.round(f.y), false);
    if (!f.pending && !f.flee && f.tier !== 'rare' && (f.hp < f.hpMax || f.tier !== 'fodder')) hpBar(c, sx, base + f.y - (f.center ? f.h / 2 : f.h) - 8, f);
  }
  for (const k of G.corpses) drawCorpse(c, k);
  { const sw = Math.round(44 * (1 + G.lift / 160)); px(c, HXS - sw / 2, FEET - 1, sw, 2, 'rgba(4,3,12,0.55)'); }
  if (G.ki >= KI_MAX && G.mode !== 'kake') fxDraw(c, 'aoFire', fxFrame(FXATLAS.aoFire, G.time, true), HXS + 2, FEET + 3, { a: 0.7, add: true, sc: 1.05 });
  drawFxList(c, true);
  if (G.aura > 0 && !(G.ki >= KI_MAX)) fxDraw(c, 'aoFire', fxFrame(FXATLAS.aoFire, G.time, true), HXS + 2, FEET + 3, { a: G.aura * 0.6, add: true, sc: 0.95, sy: 0.8 + 0.25 * (1 - G.aura / 0.55) });
  if (hero.complete && hero.naturalWidth){
    if (ghostC) for (const g of G.ghosts){ if (g.t < 0) continue; drawFrame(c, g.red && redGhostC ? redGhostC : ghostC, g.a, g.f, SX(g.wx != null ? g.wx : G.x) - 3, FEET + Math.round(g.lift || 0), (g.red ? 0.5 : 0.32) * (1 - g.t / 0.14)); }
    if (G.mode === 'walk') drawFrame(c, hero, 'walk', G.wf, HXS, FEET);
    else drawFrame(c, hero, G.pose[0], G.pose[1], HXS, FEET + Math.round(G.lift));
    if (G.red > 0 && redC && G.mode !== 'walk'){ drawFrame(c, redC, G.pose[0], G.pose[1], HXS, FEET + Math.round(G.lift), G.red); drawEyes(c); }
  }
  if (G.gleam > 0){ const w = Math.round(40 * (1 - G.gleam / 0.14)); px(c, HXS + 6, FEET - 62, w, 1, '#ffffff'); px(c, HXS + 6, FEET - 61, Math.round(w * 0.6), 1, '#a9c0ff'); }
  if (G.mode === 'notice'){
    const pop = Math.min(1, G.mark / 0.08), y = FEET - 152 - Math.round(4 * (1 - pop));
    px(c, HXS - 2, y - 1, 6, 14, '#05040c'); px(c, HXS - 1, y, 4, 8, '#ffd66b'); px(c, HXS - 1, y + 10, 4, 3, '#ffd66b'); px(c, HXS, y, 1, 7, '#fff3c4');
  }
  for (const l of G.lines) drawLine(c, l);
  for (const a of G.arcs) drawArc(c, a);
  for (const s of G.slashes) drawSlash(c, s);
  drawShots(c);
  if (G.inv > 0) fxDraw(c, 'dome', fxFrame(FXATLAS.dome, G.time, true), HXS + 4, FEET + 4, { sc: 1.35, sy: 2, a: Math.min(1, G.inv) * 0.75, add: true });
  drawFxList(c, false);
  for (const p of G.parts){ const a = 1 - p.t / p.life; c.globalAlpha = Math.max(0, Math.min(1, a * 1.4)); px(c, p.x, p.y, p.s, p.s, p.c); } c.globalAlpha = 1;
  for (const d of G.drops) if (d.st !== 'suck') drawDrop(c, d);
  tile(c, fgC, cam * 1.3, LH - fgC.height);
  // rewards on their way to the counter fly over everything, the grass included
  for (const d of G.drops) if (d.st === 'suck') drawDrop(c, d);
  for (const s of G.souls){ px(c, s.x - 1, s.y - 1, 3, 3, s.gold ? '#f2d27a' : '#9fe0ff'); px(c, s.x, s.y, 1, 1, '#ffffff'); }
  // the heaviest finishes close the picture in, like a film, while time crawls
  if (G.bars > 0){ const h = Math.round(Math.min(1, G.bars * 3) * LH * 0.07); px(c, 0, 0, LW, h, '#020208'); px(c, 0, LH - h, LW, h, '#020208'); }
  if (G.flash > 0){ c.fillStyle = `rgba(255,255,255,${Math.min(0.75, G.flash * 3)})`; c.fillRect(0, 0, LW, LH); }
  const amp = G.shake > 0 ? G.shakeMag * G.shake / G.shakeDur : 0;
  const sh = amp > 0 ? Math.round((Math.random() * 2 - 1) * amp) * K : 0, sv = amp > 0 ? Math.round((Math.random() * 2 - 1) * amp * 0.6) * K : 0;
  vctx.fillStyle = '#05071a'; vctx.fillRect(0, 0, view.width, view.height);
  vctx.drawImage(lo, 0, 0, LW, LH, sh, sv, LW * K, LH * K);
  vctx.textAlign = 'center'; vctx.textBaseline = 'middle';
  for (const t of G.texts){
    const k = t.t / t.dur, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, rise = t.big ? 0 : k * (t.small ? 8 : t.crit ? 10 : 18);
    const sc = t.big ? (k < 0.1 ? 1.4 - k * 4 : 1) : t.crit ? (k < 0.1 ? 2.2 - k * 8 : 1.4) : (k < 0.08 ? 1.5 : 1);
    vctx.globalAlpha = Math.max(0, a);
    vctx.font = `${Math.round((t.big ? 22 : t.small ? 9 : 11) * K * sc)}px DotGothic16, monospace`;
    vctx.lineWidth = Math.max(2, K * 1.5); vctx.strokeStyle = '#05040c';
    const x = t.x * K + sh, y = (t.y - rise) * K + sv;
    vctx.strokeText(t.s, x, y); vctx.fillStyle = t.c; vctx.fillText(t.s, x, y);
  }
  if (G.combo >= 2 && G.time - G.lastHit < CHAIN){
    const k = Math.min(1, (G.time - G.lastHit) / 0.12);
    vctx.globalAlpha = 1; vctx.font = `${Math.round(16 * K * (1.3 - 0.3 * k))}px DotGothic16, monospace`;
    vctx.lineWidth = Math.max(2, K * 2); vctx.strokeStyle = '#05040c'; vctx.textAlign = 'left';
    const s = G.combo + '連'; vctx.strokeText(s, 12 * K, LH * 0.2 * K); vctx.fillStyle = G.combo >= 30 ? '#ff7a4a' : G.combo >= 10 ? '#ffd66b' : '#e9eeff'; vctx.fillText(s, 12 * K, LH * 0.2 * K);
  }
  drawBanner();
  for (const tp of G.taps){ const k = tp.t / 0.25; vctx.globalAlpha = Math.max(0, 1 - k); vctx.strokeStyle = '#e9eeff'; vctx.lineWidth = Math.max(1, K); vctx.beginPath(); vctx.arc(tp.x, tp.y, (6 + k * 18) * K, 0, Math.PI * 2); vctx.stroke(); }
  vctx.globalAlpha = 1;
}

