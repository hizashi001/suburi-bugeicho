
/* ---------- skills (技): set four, they take the chain on ----------
   A chain opens with ordinary cuts (up to BASIC_MAX, each cancelling into the next as soon as it lands).
   From the second ordinary cut on, any ready skill whose moment has come cancels in; each skill, as soon as it lands,
   hands over to the next ready one (up to CHAIN_SKILLS). Slots are tried left to right, so the order of the set matters.
   Against a flier an anti-air skill may open the chain by itself (where = 'open').
   where: 'open' (from the guard), 'chain' (cancelling out of a landed cut), 'far' (a yokai is in sight but out of reach). */
const skillUses = id => G.sk.uses[id] || 0;
function skillLv(id){ let lv = 1; for (let i = 1; i < SKILL_XP.length; i++) if (skillUses(id) >= SKILL_XP[i]) lv = i + 1; return lv; }
const isKiwame = id => skillLv(id) >= SKILL_XP.length;
const skillMul = id => (1 + SKILL_LV_MUL * (skillLv(id) - 1)) * (isKiwame(id) ? KIWAME_MUL : 1);
const skillReady = id => (G.sk.cd[id] || 0) <= 0;
function stepSkills(dt){ for (const k in G.sk.cd) if (G.sk.cd[k] > 0) G.sk.cd[k] = Math.max(0, G.sk.cd[k] - dt); }
const skillAir = id => !!(SKILLS[id].steps && SKILLS[id].steps.some(st => st.air));
function skillCond(id, where){
  const ff = frontFoe(), dx = ff ? edge(ff) : 1e9, near = where !== 'far' && !!ff && dx <= REACH_HIT + 40;
  switch (id){
    case 'shoryu': case 'tsubame': case 'samidare': return near;
    case 'taka': return !!ff && dx < (near ? REACH_HIT + 40 : 220);              // a dive also closes the distance
    case 'yama': return near && !(ff.fly && ff.y < -70);                          // a ground blow
    case 'raikiri': return near && dx <= REACH_HIT + 10;
    case 'kazeba': return !!ff && dx < LW * 0.8;                                  // fires from afar too
    case 'senpu': return alive().filter(f => edge(f) <= REACH_HIT + 60).length >= 2;
    case 'ibuki': return G.hp < hpMax() * 0.6;
  }
  return false;
}
function trySkill(where){
  if (G.mode !== 'fight') return false;
  if (where !== 'chain' && G.clip) return false;
  const set = G.sk.slots.filter(Boolean), air = !!airFoe();
  // with a flier overhead, the anti-air skills jump the queue
  const order = air ? set.filter(skillAir).concat(set.filter(id => !skillAir(id))) : set;
  for (const id of order){
    const s = SKILLS[id];
    if (!skillReady(id)) continue;
    if (where === 'open' && !(air && skillAir(id)) && !(s.buff && G.hp < hpMax() * 0.6)) continue;
    if (where === 'chain' && s.buff) continue;
    if (where === 'far' && !['kazeba', 'taka', 'ibuki'].includes(id)) continue;
    if (!skillCond(id, where)) continue;
    castSkill(id); return true;
  }
  return false;
}
function castSkill(id){
  const s = SKILLS[id], m = skillMul(id), lvBefore = skillLv(id);
  G.sk.cd[id] = s.cd;
  G.sk.uses[id] = skillUses(id) + 1;
  G.chainSk++;
  if (skillLv(id) > lvBefore) G.texts.push({ x: HXS + 4, y: FEET - 205, s: s.name + (isKiwame(id) ? ' 極' : ' Lv' + skillLv(id)), t: 0, dur: 1.2, c: isKiwame(id) ? '#ffd66b' : '#9fe0ff', small: true });
  // the name bursts out in ink above the blade
  inkWord(s.name, HXS + 70, FEET - 186 + rnd(-6, 6), INK_SKILL, { kind: 'skill' });
  // a flash of spirit light at the shadow as the skill begins
  fx('spirit', HXS + 4, FEET - 64 + G.lift, { sc: 0.7, add: true, sp: 1.6 }); fx('dust_dash', HXS - 16, FEET + 2, { sc: 0.6, flipX: true, a: 0.8 });
  G.wait = 0; G.buf = false;
  for (let i = 0; i < 4; i++) G.ghosts.push({ a: G.pose[0], f: G.pose[1], t: -i * 0.02, lift: G.lift, wx: G.x - i * 6 });
  if (s.buff){
    const add = Math.round(hpMax() * s.heal * m);
    G.hp = Math.min(hpMax(), G.hp + add); G.inv = Math.max(G.inv, s.inv);
    breathe(true); G.aura = 0.9; fx('aoFire', HXS + 2, FEET + 3, { sc: 1.6, loop: 0.8, fade: 0.3, add: true });
    G.texts.push({ x: HXS + 4, y: FEET - 130, s: '+' + add, t: 0, dur: 0.9, c: '#7affa8' });
    play('draw', 0.5, 0.7); pickSound(4, 'gear');
  } else {
    G.hub = '中';
    playStep(id, s.steps[0], s.steps.slice(1), m);
  }
  // 極: sometimes the same skill fires again at once
  if (isKiwame(id) && Math.random() < KIWAME_TWICE){ G.sk.cd[id] = 0.05; G.texts.push({ x: HXS + 4, y: FEET - 220, s: '極連撃', t: 0, dur: 0.9, c: '#ffd66b', small: true }); }
}
// one move of a skill, with the skill's changes laid over the ordinary move
function playStep(id, st, rest, m){
  const base = CLIPS[st.clip];
  const over = { name: SKILLS[id].name, skill: id, heavy: true, mul: (st.mul || 1) * m, air: !!st.air, react: st.react || base.react, range: st.range || base.range,
    knock: st.knock || 0, fling: !!st.fling, shot: st.shot || 0, wave: !!st.wave, multi: st.multi || 0, ki: st.ki || 0, move: st.move || 0, sfx: st.fx || null,
    seq: rest, mulMul: m };
  if (st.hit === false){ over.hit = null; over.impact = st.clip === 'shoLand' ? base.impact : null; }
  if (st.lift) over.lift = st.lift;
  playClip(st.clip, false, over);
  // a wind-up gathers light at the blade
  if (st.fx === 'charge'){ fx('orb_charge', HXS + 14, FEET - 110, { sc: 0.6, add: true }); fx('ring_charge', HXS + 6, FEET - 70, { sc: 0.9, add: true }); }
}
function nextStep(c){
  const [st, ...rest] = c.seq;
  G.ghosts.push({ a: G.pose[0], f: G.pose[1], t: 0, lift: G.lift, wx: G.x });
  playStep(c.skill, st, rest, c.mulMul || 1);
}
/* the cancel: called every frame while a move plays. As soon as a cut has landed (and its extra thrusts are done)
   the next step of the skill, the next ready skill, or the next ordinary cut takes over. Wind-ups and returns play out. */
function autoCancel(){
  const c = G.clip; if (!c || G.mode !== 'fight' || G.stop > 0) return;
  if (c.hit == null || G.ci <= c.hit || G.echo.length) return;
  if (c.seq && c.seq.length){ nextStep(c); return; }
  if ((c.skill || G.basicN >= 2) && G.chainSk < CHAIN_SKILLS && trySkill('chain')) return;
  if (!c.skill && !c.lift && G.basicN < BASIC_MAX && inReach(30)){
    const a = nextAttackFrom('中');
    if (a){ G.ghosts.push({ a: G.pose[0], f: G.pose[1], t: 0, lift: G.lift, wx: G.x }); G.hub = '中'; G.lift = 0; playClip(a); }
  }
}

/* ---------- secret arts (奥義): one is set, it fires when 気 is full ---------- */
function startOugi(){
  if (G.sk.ougi === 'kishin') return startKishin();
  return canKake() && startKake();
}

/* ---------- 鬼神斬 ----------
   awaken (0.7s): time stands still, the eyes light up red, the body turns red.
   rush (1.3s): the shadow swings at blinding speed (no damage yet), red afterimages, blade flashes all over the yokai.
   noto: it sheathes. release (at the click of the guard): 50 cuts land on every yokai on screen in a rush, then the finish. */
const KISHIN_HITS = 50, KISHIN_RUSH = ['yoko', 'kiriage', 'kesa', 'kaiten', 'chuLoop', 'shoFuri', 'oroshiA', 'tsuki'];
function startKishin(){
  const targets = alive().filter(f => SX(f.x) > HXS - 40 && SX(f.x) < LW + 30);
  if (!targets.length) return false;
  G.ki = 0; G.clip = null; G.lift = 0; G.buf = false; G.hub = '中';
  for (const f of targets){ f.frozen = true; f.wind = 0; }
  G.kishin = { ph: 'awaken', t: 0, targets, n: 0, gap: 0, spark: 0 };
  setMode('kishin'); G.pose = ['b01', 0];
  showBanner('鬼神斬', true, 'ougi'); play('burst', 0.7, 0.55); play('draw', 0.6, 0.6); G.flash = 0.12; shake(0.4, 3);
  fx('aura_red', HXS + 4, FEET - 60, { sc: 0.55, loop: 1.9, fade: 0.4, add: true, a: 0.85 }); fx('red_swirl', HXS + 4, FEET - 60, { sc: 1.2, add: true, delay: 0.2 });
  return true;
}
function updateKishin(dt){
  const k = G.kishin; k.t += dt;
  if (k.ph === 'awaken'){
    G.red = Math.min(1, k.t / 0.5); G.pose = ['b01', Math.floor(k.t / BREATH_DT) % ATLAS.b01.length];
    if (Math.random() < dt * 14) fx('akaFire', HXS + rnd(-6, 6), FEET + 3, { sc: 0.9, a: 0.6, add: true });
    if (k.t > 0.7){ k.ph = 'rush'; k.t = 0; G.noHit = true; }
  } else if (k.ph === 'rush'){
    G.red = 1;
    if (k.t > 1.3){ k.ph = 'noto'; k.t = 0; G.noHit = false; G.lift = 0; G.clip = null; playClip('noto'); return; }
    if (!G.clip) playClip(pick(KISHIN_RUSH), true);
    stepClip(dt * 1.6);
    if (Math.random() < dt * 12) G.ghosts.push({ a: G.pose[0], f: G.pose[1], t: 0, lift: G.lift, wx: G.x + rnd(-8, 8), red: true });
    k.spark -= dt;
    if (k.spark <= 0){
      k.spark = 0.045; const f = pick(k.targets);
      if (f && !f.dead){ const x = SX(f.x) + rnd(-f.w * 0.4, f.w * 0.4), y = bodyY(f) + rnd(-f.h * 0.3, f.h * 0.3); fx(vpick('sl_red', 'sl_cross', 'sl_h', 'sl_diag'), x, y, { sc: rnd(0.6, 1.0), rot: rnd(0, 6.28), add: true, sp: 1.8 }); }
    }
  } else if (k.ph === 'noto'){
    stepClip(dt);
  } else if (k.ph === 'release'){
    k.gap -= dt;
    while (k.gap <= 0 && k.n < KISHIN_HITS){
      k.gap += 0.016; k.n++;
      // all fifty cuts are always delivered: once the yokai have fallen, the rest slice the air where they stood
      const live = k.targets.filter(f => !f.dead && !f.pending);
      const f = live.length ? live[k.n % live.length] : pick(k.targets);
      G.combo++; G.lastHit = G.time; G.best = Math.max(G.best, G.combo);
      const x = SX(f.x) + rnd(-f.w * 0.4, f.w * 0.4), y = bodyY(f) + rnd(-f.h * 0.35, f.h * 0.35);
      fx(k.n % 3 ? vpick('hit_red', 'red_pop', 'hit_b2') : 'ink_spray', x, y, { sc: rnd(0.45, 0.8), rot: k.n % 3 ? rnd(0, 6.28) : 0, flipX: Math.random() < 0.5, add: k.n % 3 > 0, sp: 1.6 });
      G.lines.push({ x0: x - rnd(20, 50), x1: x + rnd(20, 50), y: Math.round(y + rnd(-6, 6)), t: 0, dur: 0.18 });
      if (live.length){ f.frozen = false; hurtFoe(f, { react: null }, Math.round(heroDmg() * (1 + 0.04 * Math.min(G.combo, 40)) * (0.9 + Math.random() * 0.2)), pick(['h', 'up', 'down'])); f.frozen = !f.dead; }
      if (k.n % 2) play('slashL', 0.45, comboRate(Math.min(G.combo, 22)) * (1 + k.n * 0.004), 0.02);
      if (k.n % 10 === 0) buzz('hit');
    }
    if (k.n >= KISHIN_HITS){
      for (const f of k.targets) f.frozen = false;
      G.kishin = null; feel('finish'); G.flash = 0.2;
      for (const f of k.targets) if (!f.dead){ fx('burst_w', SX(f.x), bodyY(f), { sc: 1, add: true }); break; } fx('red_swirl', LW * 0.6, LH * 0.55, { sc: 1.8, add: true });
      if (G.foes.some(f => f.pending)) chinPending();
      setMode('fight'); G.drawn = true; G.hub = '中'; playClip('batto'); play('draw', 0.6);
    }
  }
}
// called by chin() at the click of the guard while in 鬼神斬
function kishinRelease(){
  const k = G.kishin; if (!k) return;
  k.ph = 'release'; k.t = 0; k.gap = 0.05;
  G.flash = 0.3; shake(0.3, 5); play('burst', 0.9, 0.7);
  fx('speed', LW / 2, LH / 2, { sc: 1.2, add: true, a: 0.6 }); fx('sl_red', LW * 0.6, LH * 0.5, { sc: 2.2, add: true });
  G.texts.push({ x: LW / 2, y: LH * 0.3, s: '五十連', t: 0, dur: 1.4, c: '#ff5a4a', big: true });
}
// the red glowing eyes, with a short streak trailing behind
function drawEyes(c){
  const fl = ATLAS[G.pose[0]], fr = fl && fl[G.pose[1]]; if (!fr || fr.mx == null || G.red < 0.3) return;
  const x = HXS + fr.mx - 3, y = FEET + Math.round(G.lift) + fr.my - 7, a = Math.min(1, (G.red - 0.3) / 0.4);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.45 * a; px(c, x - 3, y - 2, 8, 5, '#ff2030');
  for (let i = 1; i < 10; i++){ c.globalAlpha = a * (1 - i / 10) * 0.7; px(c, x - i * 2, y + (i > 4 ? 1 : 0), 2, 1, '#ff3a3a'); }
  c.restore();
  c.globalAlpha = a; px(c, x, y, 2, 1, '#ffe0e0'); px(c, x + 3, y, 1, 1, '#ff4040'); c.globalAlpha = 1;
}
