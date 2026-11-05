
/* ---------- skills (技): set four, they fire by themselves ----------
   Each set skill has a cooldown (SKILLS[].cd seconds of game time). When it is ready and its moment comes (skillCond),
   it takes the place of the next ordinary cut. Slots are tried left to right, so the order of the set matters too.
   where: 'near' = a yokai is within the blade's reach, 'far' = one is in sight but out of reach (only long-range skills fire). */
const skillUses = id => G.sk.uses[id] || 0;
function skillLv(id){ let lv = 1; for (let i = 1; i < SKILL_XP.length; i++) if (skillUses(id) >= SKILL_XP[i]) lv = i + 1; return lv; }
const isKiwame = id => skillLv(id) >= SKILL_XP.length;
const skillMul = id => (1 + SKILL_LV_MUL * (skillLv(id) - 1)) * (isKiwame(id) ? KIWAME_MUL : 1);
const skillReady = id => (G.sk.cd[id] || 0) <= 0;
function stepSkills(dt){ for (const k in G.sk.cd) if (G.sk.cd[k] > 0) G.sk.cd[k] = Math.max(0, G.sk.cd[k] - dt); }
function skillCond(id, where){
  const ff = frontFoe(), dx = ff ? edge(ff) : 1e9, near = where === 'near';
  switch (id){
    case 'shoryu': case 'tsubame': return near && !!ff;                       // anti-air ones are tried first when a flier is close (see trySkill)
    case 'raikiri': return near && !!ff && dx <= REACH_HIT;
    case 'samidare': return near && !!ff;
    case 'senpu': return near && alive().filter(f => edge(f) <= REACH_HIT + 60).length >= 2;
    case 'kazeba': return !!ff && dx < LW * 0.8;                              // fires from afar too
    case 'chiretsu': return alive().some(f => !f.fly && edge(f) < LW * 0.65);   // ground yokai only, from afar too
    case 'ibuki': return G.hp < hpMax() * 0.6;
  }
  return false;
}
function trySkill(where){
  if (G.mode !== 'fight' || G.clip) return false;
  const set = G.sk.slots.filter(Boolean);
  // with a flier overhead, the anti-air skills jump the queue
  const order = airFoe() ? set.filter(id => SKILLS[id].air).concat(set.filter(id => !SKILLS[id].air)) : set;
  for (const id of order){
    if (!skillReady(id) || !skillCond(id, where)) continue;
    if (where === 'far' && !['kazeba', 'chiretsu', 'ibuki'].includes(id)) continue;
    castSkill(id); return true;
  }
  return false;
}
function castSkill(id){
  const s = SKILLS[id], m = skillMul(id), lvBefore = skillLv(id);
  G.sk.cd[id] = s.cd;
  G.sk.uses[id] = skillUses(id) + 1;
  if (skillLv(id) > lvBefore) G.texts.push({ x: HXS + 4, y: FEET - 190, s: s.name + (isKiwame(id) ? ' 極' : ' Lv' + skillLv(id)), t: 0, dur: 1.2, c: isKiwame(id) ? '#ffd66b' : '#9fe0ff', small: true });
  showBanner(s.name, false, true);
  G.wait = 0; G.buf = false;
  if (s.buff){
    const add = Math.round(hpMax() * s.heal * m);
    G.hp = Math.min(hpMax(), G.hp + add); G.inv = Math.max(G.inv, s.inv);
    breathe(true); G.aura = 0.9; fx('aoFire', HXS + 2, FEET + 3, { sc: 1.3, loop: 0.8, fade: 0.3, add: true });
    G.texts.push({ x: HXS + 4, y: FEET - 130, s: '+' + add, t: 0, dur: 0.9, c: '#7affa8' });
    play('draw', 0.5, 0.7); pickSound(4, 'gear');
  } else {
    G.hub = '中';
    playClip(s.clip, false, { name: s.name, skill: id, heavy: true, mul: s.mul * m, air: !!s.air, react: s.react, range: s.range || CLIPS[s.clip].range,
      knock: s.knock || 0, shot: !!s.shot, wave: !!s.wave, multi: s.multi || 0, ki: s.ki || 0,
      then: s.then || null, thenOver: s.then ? { mul: (s.thenMul || 1) * m, air: true } : null });
  }
  // 極: sometimes the same skill fires again at once
  if (isKiwame(id) && Math.random() < KIWAME_TWICE){ G.sk.cd[id] = 0.05; G.texts.push({ x: HXS + 4, y: FEET - 205, s: '極連撃', t: 0, dur: 0.9, c: '#ffd66b', small: true }); }
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
  showBanner('鬼神斬', true); play('burst', 0.7, 0.55); play('draw', 0.6, 0.6); G.flash = 0.12; shake(0.4, 3);
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
      if (f && !f.dead){ const x = SX(f.x) + rnd(-f.w * 0.4, f.w * 0.4), y = bodyY(f) + rnd(-f.h * 0.3, f.h * 0.3); fx(Math.random() < 0.5 ? 'moon' : 'wind', x, y, { sc: rnd(0.7, 1.2), rot: rnd(0, 6.28), add: true, sp: 1.6 }); }
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
      fx(k.n % 3 ? 'spark' : 'ink', x, y, { sc: rnd(0.5, 0.9), rot: rnd(0, 6.28), add: k.n % 3 > 0 });
      G.lines.push({ x0: x - rnd(20, 50), x1: x + rnd(20, 50), y: Math.round(y + rnd(-6, 6)), t: 0, dur: 0.18 });
      if (live.length){ f.frozen = false; hurtFoe(f, { react: null }, Math.round(heroDmg() * (1 + 0.04 * Math.min(G.combo, 40)) * (0.9 + Math.random() * 0.2)), pick(['h', 'up', 'down'])); f.frozen = !f.dead; }
      if (k.n % 2) play('slashL', 0.45, comboRate(Math.min(G.combo, 22)) * (1 + k.n * 0.004), 0.02);
      if (k.n % 10 === 0) buzz('hit');
    }
    if (k.n >= KISHIN_HITS){
      for (const f of k.targets) f.frozen = false;
      G.kishin = null; feel('finish'); G.flash = 0.2;
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
