
/* ---------- the screen around the road: HUD, skill bar, panels, tab bar ---------- */
const ui = { hp: $('hudHp'), dist: $('hudDist'), soul: $('hudSoul'), koban: $('hudKoban'), gear: $('hudGear'), lv: $('hudLv'), xp: $('hudXp'), stage: $('hudStage'), gateL: $('hudGate'),
  st: $('rState'), foes: $('rFoes'), kills: $('rKills'), combo: $('rCombo'), best: $('rBest'), mv: $('rMove'), hint: $('hint'), bO: $('bOuma'), bH: $('bHyakki'), bL: $('bLuck'), bA: $('bArena'),
  gate: $('rGate'), back: $('rBack'), crit: $('rCrit'), pitch: $('rPitch'), ki: $('rKi'), dmg: $('rDmg') };
let TAB = 'waza';

// an effect frame as a skill icon (the reference game uses its effect sprites as skill icons too)
function fxIcon(cv, icon){
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, cv.width, cv.height);
  if (!icon) return;
  if (icon[0][0] === '@'){
    // a brush character with a coloured glow (the secret arts)
    const S = cv.width; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `${Math.round(S * 0.72)}px "Yuji Syuku", "Yu Mincho", serif`;
    c.shadowColor = icon[2]; c.shadowBlur = S * 0.18; c.fillStyle = icon[1]; c.fillText(icon[0].slice(1), S / 2, S * 0.53); c.shadowBlur = 0; c.fillText(icon[0].slice(1), S / 2, S * 0.53);
    return;
  }
  const [key, fi, o] = icon, m = FXATLAS[key]; if (!m || !FXIMG.complete || !FXIMG.naturalWidth) return;
  const S = cv.width, sc = Math.min(S * 0.9 / m.w, S * 0.9 / m.h) / Math.max((o && o.sx) || 1, (o && o.sy) || 1, 1);
  fxDraw(c, key, Math.min(fi, m.f.length - 1), S / 2 + (m.ax - m.w / 2) * sc, S / 2 + (m.ay - m.h / 2) * sc, Object.assign({ sc }, o || {}));
}
const mkCv = n => { const cv = document.createElement('canvas'); cv.width = cv.height = n; return cv; };

/* ---- skill bar ---- */
const SLOT_EL = [];
function buildSkillbar(){
  const bar = $('skillbar'); bar.textContent = '';
  SLOT_EL.length = 0;
  for (let i = 0; i < 5; i++){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'slot' + (i === 4 ? ' ougi' : '');
    const cv = mkCv(64), cdm = document.createElement('i'), cdn = document.createElement('span'), rdy = document.createElement('i'), num = document.createElement('span');
    cdm.className = i === 4 ? 'kif' : 'cdm'; cdn.className = 'cdn'; rdy.className = 'rdy'; num.className = i === 4 ? 'lab' : 'num'; num.textContent = i === 4 ? '奥義' : String(i + 1);
    b.append(cv, cdm, cdn, rdy, num); bar.append(b);
    b.addEventListener('click', () => { if (i < 4) G.sk.sel = i; showTab('waza'); refreshSkillUI(); });
    SLOT_EL.push({ b, cv, cdm, cdn, id: undefined });
  }
  refreshSlots();
}
function refreshSlots(){
  SLOT_EL.forEach((s, i) => {
    const id = i < 4 ? G.sk.slots[i] : G.sk.ougi, def = i < 4 ? SKILLS[id] : OUGI[id];
    if (s.id !== id){ s.id = id; fxIcon(s.cv, def ? def.icon : null); s.b.setAttribute('aria-label', def ? def.name : '空き'); }
    s.b.classList.toggle('empty', !def);
    if (i < 4) s.b.dataset.sel = G.sk.sel === i ? '1' : '0';
  });
}
function tickSlots(){
  SLOT_EL.forEach((s, i) => {
    if (i === 4){ const k = G.ki / KI_MAX; s.cdm.style.height = Math.round(k * 100) + '%'; s.b.dataset.full = k >= 1 ? '1' : '0'; s.cdn.textContent = ''; return; }
    const id = G.sk.slots[i]; if (!id){ s.cdm.style.height = '0'; s.cdn.textContent = ''; s.b.dataset.ready = '0'; return; }
    const cd = G.sk.cd[id] || 0, full = SKILLS[id].cd;
    s.cdm.style.height = Math.round(100 * cd / full) + '%';
    s.cdn.textContent = cd > 0 ? cd.toFixed(1) : '';
    s.b.dataset.ready = cd > 0 ? '0' : '1';
  });
}

/* ---- 技 tab: cards, detail, set / remove ---- */
const CARD = {};
function skillCard(id, ougi){
  const def = ougi ? OUGI[id] : SKILLS[id];
  const b = document.createElement('button'); b.type = 'button'; b.className = 'card';
  const cv = mkCv(64), lv = document.createElement('span'), eb = document.createElement('span'), nm = document.createElement('span'), tg = document.createElement('span');
  lv.className = 'lv'; eb.className = 'eb'; nm.className = 'nm'; tg.className = 'tg'; nm.textContent = def.name; tg.textContent = ougi ? '奥義' : def.tag;
  b.append(cv, eb, nm, tg);
  let xp = null;
  if (!ougi){ b.append(lv); xp = document.createElement('div'); xp.className = 'xp'; xp.innerHTML = '<i></i><span></span>'; b.append(xp); }
  b.addEventListener('click', () => { G.sk.pick = id; refreshSkillUI(); });
  CARD[id] = { b, cv, lv, eb, xp, def, ougi };
  return b;
}
function buildSkillCards(){
  const a = $('skillCards'), o = $('ougiCards'); a.textContent = ''; o.textContent = '';
  for (const id of Object.keys(SKILLS)) a.append(skillCard(id, false));
  for (const id of Object.keys(OUGI)) o.append(skillCard(id, true));
  drawCardIcons(); refreshSkillUI();
}
function drawCardIcons(){ for (const id in CARD) fxIcon(CARD[id].cv, CARD[id].def.icon); refreshSlots(); SLOT_EL.forEach(s => { s.id = undefined; }); refreshSlots(); }
function refreshSkillUI(){
  for (const id in CARD){
    const k = CARD[id];
    k.b.setAttribute('aria-pressed', String(G.sk.pick === id));
    if (k.ougi){ const on = G.sk.ougi === id; k.eb.hidden = !on; k.eb.textContent = '奥'; continue; }
    const slot = G.sk.slots.indexOf(id); k.eb.hidden = slot < 0; k.eb.textContent = 'E' + (slot + 1);
    const lv = skillLv(id), kw = isKiwame(id); k.lv.textContent = kw ? '極' : 'Lv' + lv; k.lv.classList.toggle('kiwame', kw);
    const u = skillUses(id), lo = SKILL_XP[lv - 1], hi = SKILL_XP[lv] != null ? SKILL_XP[lv] : SKILL_XP[lv - 1];
    k.xp.firstChild.style.width = kw ? '100%' : Math.round(100 * (u - lo) / Math.max(1, hi - lo)) + '%';
    k.xp.lastChild.textContent = kw ? 'MAX' : (u - lo) + '/' + (hi - lo);
  }
  renderSkillDetail(); refreshSlots();
}
function renderSkillDetail(){
  const box = $('skillDetail'), id = G.sk.pick, ougi = !!OUGI[id], def = ougi ? OUGI[id] : SKILLS[id];
  box.textContent = ''; if (!def) return;
  const cv = mkCv(64); fxIcon(cv, def.icon);
  const right = document.createElement('div');
  const h = document.createElement('h3'); h.textContent = def.name; const sm = document.createElement('small'); sm.textContent = ougi ? '奥義' : def.tag + '　' + (isKiwame(id) ? '極' : 'Lv' + skillLv(id)); h.append(sm);
  const p = document.createElement('p'); p.textContent = def.desc;
  right.append(h, p);
  if (!ougi){
    // the power of each cut the skill is made of (wind-ups left out), e.g. ×1.3＋×1.6＋×1.6
    const q = document.createElement('p'), m = skillMul(id);
    q.textContent = def.buff ? `間隔 ${def.cd}秒 ／ 回復 体力の${Math.round(def.heal * m * 100)}%`
      : `間隔 ${def.cd}秒 ／ 威力 ` + def.steps.filter(st => st.hit !== false).map(st => '×' + (st.mul * m).toFixed(1) + (st.multi ? `（${st.multi + 1}回）` : '') + (st.shot > 1 ? `（${st.shot}発）` : '')).join('＋');
    right.append(q);
  }
  const acts = document.createElement('div'); acts.className = 'acts';
  if (ougi){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn go'; b.textContent = G.sk.ougi === id ? '奥義にしている' : '奥義にする'; b.disabled = G.sk.ougi === id;
    b.addEventListener('click', () => { G.sk.ougi = id; refreshSkillUI(); }); acts.append(b);
  } else {
    const at = G.sk.slots.indexOf(id);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn go';
    b.textContent = at >= 0 ? `枠${at + 1}から外す` : `枠${G.sk.sel + 1}に入れる`;
    b.addEventListener('click', () => {
      const i = G.sk.slots.indexOf(id);
      if (i >= 0) G.sk.slots[i] = null; else G.sk.slots[G.sk.sel] = id;
      refreshSkillUI();
    });
    acts.append(b);
    if (G.maki > 0 && !isKiwame(id)){ const m = document.createElement('button'); m.type = 'button'; m.className = 'btn gold'; m.textContent = `巻物を読む（残り${G.maki}）`; m.addEventListener('click', () => { G.maki--; G.sk.uses[id] = skillUses(id) + 2; refreshSkillUI(); }); acts.append(m); }
    const n = document.createElement('p'); n.className = 'note'; n.style.margin = '0'; n.textContent = `入れる先：枠${G.sk.sel + 1}（上の技の枠を押すと変えられる）`; acts.append(n);
  }
  box.append(cv, right, acts);
}

/* ---- 装備 tab ---- */
let EQ_PICK = 'kote';
function buildEquip(){
  const a = $('equipCards'); a.textContent = '';
  for (const e of EQUIP){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.dataset.id = e.id;
    b.innerHTML = `<img class="ic" src="icons/${e.icon}.png" alt=""><span class="lv"></span><span class="nm">${e.name}</span><span class="tg">${e.part}</span>`;
    b.addEventListener('click', () => { EQ_PICK = e.id; refreshEquip(); });
    a.append(b);
  }
  refreshEquip();
}
function refreshEquip(){
  for (const b of $('equipCards').children){ const id = b.dataset.id; b.setAttribute('aria-pressed', String(EQ_PICK === id)); b.querySelector('.lv').textContent = '+' + (G.eq[id] || 0); }
  const e = EQUIP.find(x => x.id === EQ_PICK), lv = G.eq[e.id] || 0, cost = lv + 1, box = $('equipDetail');
  box.innerHTML = `<img src="icons/${e.icon}.png" alt=""><div><h3>${e.name} +${lv}<small>${e.part}</small></h3><p>${e.label} +${Math.round(e.per * lv * 100)}%（1段ごとに +${Math.round(e.per * 100)}%）</p><p>強化に装具 ${cost} ／ 手持ち ${G.gear}</p></div><div class="acts"></div>`;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn gold'; b.textContent = `強化する（装具 ${cost}）`; b.disabled = G.gear < cost;
  b.addEventListener('click', () => { if (G.gear < cost) return; G.gear -= cost; G.eq[e.id] = lv + 1; refreshEquip(); });
  box.querySelector('.acts').append(b);
}

/* ---- 道具 tab ---- */
const ITEMS = [
  { id: 'tama', name: '霊玉', icon: 'tama', get: () => G.soul, desc: '妖怪の魂。斬った妖怪から集まる。（使い道は今後：位上げ・技の強化など）' },
  { id: 'koban', name: '小判', icon: 'koban', get: () => G.koban, desc: '金の妖怪・大将・ボス・座敷童から噴き出す。（使い道は今後：店）' },
  { id: 'gear', name: '装具', icon: 'tsuba', get: () => G.gear, desc: '大将・ボス・座敷童がときどき落とす。装備を鍛えるのに使う。' },
  { id: 'maki', name: '巻物', icon: 'maki', get: () => G.maki, desc: 'まれに落ちる技の書。技の画面で読むと、その技の経験が2回分進む。' },
  { id: 'map', name: '地図', icon: 'map', get: () => STAGES.length, desc: '旅の道。押すと道の画面を開く。', go: 'michi' }
];
let IT_PICK = 'tama';
function buildItems(){
  const a = $('itemCards'); a.textContent = '';
  for (const it of ITEMS){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.dataset.id = it.id;
    b.innerHTML = `<img class="ic" src="icons/${it.icon}.png" alt=""><span class="nm">${it.name}</span><span class="ct"></span>`;
    b.addEventListener('click', () => { if (it.go) showTab(it.go); else { IT_PICK = it.id; refreshItems(); } });
    a.append(b);
  }
  refreshItems();
}
function refreshItems(){
  for (const b of $('itemCards').children){ const it = ITEMS.find(x => x.id === b.dataset.id); b.setAttribute('aria-pressed', String(IT_PICK === it.id)); b.querySelector('.ct').textContent = it.id === 'map' ? '道' + it.get() : String(it.get()); }
  const it = ITEMS.find(x => x.id === IT_PICK);
  $('itemDetail').innerHTML = `<img src="icons/${it.icon}.png" alt=""><div><h3>${it.name}<small>${it.get()}</small></h3><p>${it.desc}</p></div>`;
}

/* ---- 道 tab ---- */
function buildStages(){
  const a = $('stageList'); a.textContent = '';
  STAGES.forEach((st, i) => {
    const d = document.createElement('div'); d.className = 'stg-card'; d.dataset.cur = i === STAGE ? '1' : '0';
    const low = G.lv < st.rec;
    d.innerHTML = `<div><h3>道${i + 1}　${st.name}</h3><p>おすすめの位 ${st.rec}　妖怪の硬さ ×${lvMul(st.rec).toFixed(2)}</p>${low ? `<p class="warn">いまの位 ${G.lv}：一太刀では倒れにくい</p>` : ''}</div>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (i === STAGE ? '' : ' go'); b.textContent = i === STAGE ? 'いまの道' : 'この道へ'; b.disabled = i === STAGE;
    b.addEventListener('click', () => goStage(i));
    d.append(b); a.append(d);
  });
}
function goStage(i){
  setStage(i);
  G.foes = []; G.hyakki = null; G.arena = null; G.drops = []; G.shots = []; G.echo = []; G.kishin = null; G.kake = null; G.red = 0;
  G.x = 0; G.cam = 0; G.nextGate = GATE; G.spawnT = 2; G.combo = 0; G.ki = 0; G.hp = hpMax(); G.stop = 0; G.slow = null;
  setMode('walk'); G.clip = null; G.drawn = false; G.hub = '中'; G.pose = ['walk', 0]; G.moveName = '―';
  G.texts.push({ x: LW / 2, y: LH * 0.3, s: '道' + (i + 1) + '　' + STAGES[i].name, t: 0, dur: 2, c: '#e6bb55', big: true });
  buildStages();
}

/* ---- 試し tab: every VFX key in use, looping on a small black stage with its number and use ---- */
const VFXS = [];
function buildVfxList(){
  const box = $('vfxList'); if (!box || VFXS.length) return;
  for (const key of Object.keys(VFXATLAS)){
    const m = VFXATLAS[key], d = document.createElement('div'); d.className = 'mv';
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 120; cv.style.aspectRatio = '200/120'; cv.style.background = '#05071a';
    const t = document.createElement('div'); t.className = 't'; t.textContent = m.v + '　' + (VFX_ROLE[key] || key);
    const r = document.createElement('div'); r.className = 'r'; r.textContent = key + '（' + m.f.length + 'コマ）';
    d.append(cv, t, r); box.append(d);
    VFXS.push({ key, cv, ctx: cv.getContext('2d'), t: Math.random() });
  }
}
function drawVfxList(dt){
  const sec = $('vfxSec'); if (!sec || !sec.open) return;
  buildVfxList();
  for (const v of VFXS){
    const m = VFXATLAS[v.key], c = v.ctx, len = m.f.length * m.fd;
    v.t = (v.t + dt) % (len + 0.35);
    c.imageSmoothingEnabled = false; c.fillStyle = '#05071a'; c.fillRect(0, 0, 200, 120);
    if (v.t > len) continue;
    // fit the effect's whole size into the stage
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const f of m.f){ x0 = Math.min(x0, f[4]); y0 = Math.min(y0, f[5]); x1 = Math.max(x1, f[4] + f[2]); y1 = Math.max(y1, f[5] + f[3]); }
    const k = m.k || 1, sc = Math.min(1.4, 188 / ((x1 - x0) * k), 108 / ((y1 - y0) * k));
    const glow = !/^(dust|smoke|cloud|ink)/.test(v.key);
    fxDraw(c, v.key, fxFrame(m, v.t, false), 100 - (x0 + x1) / 2 * k * sc, 60 - (y0 + y1) / 2 * k * sc, { sc, add: glow });
  }
}

/* ---- tabs ---- */
function showTab(t){
  TAB = t;
  for (const s of document.querySelectorAll('.tab')) s.hidden = s.id !== 'tab-' + t;
  for (const b of document.querySelectorAll('.nav button')) b.setAttribute('aria-pressed', String(b.dataset.tab === t));
  if (t === 'waza') refreshSkillUI(); else if (t === 'sobi') refreshEquip(); else if (t === 'dogu') refreshItems(); else if (t === 'michi') buildStages();
}
for (const b of document.querySelectorAll('.nav button')) b.addEventListener('click', () => showTab(b.dataset.tab));

/* ---- every 0.08s: numbers on the HUD and the panels; where the rewards should fly ---- */
let panelT = 0, lastLv = 1;
function syncUI(){
  ui.dist.textContent = (G.x / PX_PER_RI).toFixed(3); ui.soul.textContent = G.soul; ui.koban.textContent = G.koban; ui.gear.textContent = G.gear;
  ui.lv.textContent = G.lv; ui.xp.style.width = Math.round(100 * G.xp / xpNext(G.lv)) + '%';
  ui.stage.textContent = '道' + (STAGE + 1) + ' ' + STAGES[STAGE].name;
  const hm_ = hpMax(); ui.hp.style.width = Math.round(100 * G.hp / hm_) + '%'; ui.hp.style.background = G.hp < hm_ * 0.35 ? '#e2533a' : '#5fd08a';
  ui.gateL.textContent = G.arena ? 'ボスの関' : '関まで ' + Math.max(0, Math.ceil((G.nextGate - G.x) / WALK_V)) + '秒';
  const states = { walk: '旅の途中', notice: '見つけた', dash: '縮地', iai: '居合斬り', fight: '戦闘中', calm: '納刀', down: 'やられた', kake: '駆け抜け', kishin: '鬼神斬' };
  ui.st.textContent = states[G.mode] || '';
  ui.foes.textContent = alive().length; ui.kills.textContent = G.kills; ui.combo.textContent = G.combo; ui.best.textContent = G.best; ui.mv.textContent = G.moveName;
  ui.back.textContent = G.setbacks; ui.crit.textContent = G.crits; ui.ki.textContent = G.ki + '/' + KI_MAX; ui.dmg.textContent = Math.round(heroDmg());
  ui.pitch.textContent = '×' + (G.time - G.lastHit < CHAIN ? comboRate(G.combo) : 1).toFixed(2);
  ui.gate.textContent = G.arena ? '関' : Math.max(0, Math.ceil((G.nextGate - G.x) / WALK_V)) + '秒';
  ui.hint.dataset.on = G.mode === 'fight' && alive().length ? '1' : '0';
  ui.bO.hidden = !G.ouma; ui.bH.hidden = !G.hyakki; ui.bL.hidden = !(G.luck > 0); ui.bA.hidden = !G.arena;
  if (G.luck > 0) ui.bL.textContent = '幸運 ' + Math.floor(G.luck / 60) + ':' + String(Math.floor(G.luck % 60)).padStart(2, '0');
  tickSlots();
  document.querySelector('.hud').style.visibility = G.banner && G.banner.ougi ? 'hidden' : '';
  // the counters' places on the game screen, for the rewards to fly to
  const r = stage.getBoundingClientRect();
  for (const [k, el] of [['tama', ui.soul], ['koban', ui.koban], ['gear', ui.gear]]){
    const e = el.getBoundingClientRect();
    if (r.width && e.width){ TGT[k].x = (e.left + e.width / 2 - r.left) * DPR / K; TGT[k].y = (e.top + e.height / 2 - r.top) * DPR / K; }
    else { TGT[k].x = LW * 0.85; TGT[k].y = 10; }
  }
  // the open panel, a little less often
  panelT++;
  if (panelT % 4 === 0){
    if (TAB === 'waza') refreshSkillUI(); else if (TAB === 'sobi') refreshEquip(); else if (TAB === 'dogu') refreshItems();
    if (TAB === 'michi' && lastLv !== G.lv) buildStages();
    lastLv = G.lv;
  }
}

/* ---- settings and test switches ---- */
function bindSeg(id, get, set){
  const el = $(id); if (!el) return;
  const btns = [...el.querySelectorAll('button')];
  const sync = () => btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === get())));
  btns.forEach(b => b.addEventListener('click', () => { set(b.dataset.v); sync(); })); sync();
}
bindSeg('segSound', () => SOUND ? '1' : '0', v => { SOUND = v === '1'; try { localStorage.setItem('ghost-sprite-sound', v); } catch (e) {} if (SOUND) initAudio(); });
bindSeg('segSpeed', () => String(SPEED), v => { SPEED = +v; try { localStorage.setItem('ghost-sprite-speed', v); } catch (e) {} });
bindSeg('segOuma', () => OUMA_MODE, v => { OUMA_MODE = v; try { localStorage.setItem('ghost-ouma', v); } catch (e) {} checkOuma(); });
bindSeg('segVibe', () => VIBE ? '1' : '0', v => { VIBE = v === '1'; try { localStorage.setItem('ghost-vibe', v); } catch (e) {} if (VIBE) buzz('crit'); });
function checkOuma(){
  const d = new Date(), ss = sunsetMinutes(d), was = G.ouma; G.ouma = oumaNow();
  $('oumaNote').textContent = '今日の日没 ' + hm(ss) + ' ／ 逢魔が時 ' + hm(ss - 30) + '〜' + hm(ss + 30) + '（端末の時刻と標準時からの目安）';
  if (G.ouma && !was) G.texts.push({ x: LW / 2, y: LH * 0.28, s: '逢魔が時', t: 0, dur: 1.8, c: '#e0607a', big: true });
}
const onBtn = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
onBtn('callHyakki', () => { if (G.mode !== 'down') startHyakki(); });
onBtn('callTaisho', () => { makeFoe(pick(TAISHO), G.x + LW + 40); });
onBtn('callBoss', () => { if (G.mode !== 'down'){ G.nextGate = G.x; } });
onBtn('callZashiki', () => { makeFoe('zashiki', G.x + LW + 20); });
onBtn('callKake', () => { G.ki = KI_MAX; });
onBtn('callFodder', () => { ['hitotsume', 'chochin', 'ittan', 'hibi'].forEach((k, i) => makeFoe(k, G.x + LW * 0.55 + i * 70)); });
onBtn('callNormals', () => { NORMALS.forEach((k, i) => makeFoe(k, G.x + LW * 0.6 + i * 80)); });
onBtn('callDown', () => { if (G.mode === 'walk' || G.mode === 'fight' || G.mode === 'calm'){ G.hp = 0; setMode('fight'); playClip('hurt'); G.hub = '傷'; } });
// a reward burst on the spot, without the fight, to look at the throw, the bounces and the pull
onBtn('callLoot', () => {
  const f = { x: G.x + LW * 0.45, y: 0, w: 100, h: 140, lane: 3, tier: Math.random() < 0.5 ? 'boss' : 'taisho', soul: 150 };
  spawnLoot(f, SX(f.x), FEET - 70); feel('kill');
});
const setLv = lv => { G.lv = Math.max(1, lv); G.xp = 0; G.hp = hpMax(); if (TAB === 'michi') buildStages(); };
onBtn('lvUp1', () => setLv(G.lv + 1));
onBtn('lvUp5', () => setLv(G.lv + 5));
onBtn('lvDown5', () => setLv(G.lv - 5));
onBtn('kiwameAll', () => { for (const id in SKILLS) G.sk.uses[id] = SKILL_XP[SKILL_XP.length - 1]; refreshSkillUI(); });
onBtn('resetSkills', () => { G.sk.uses = {}; refreshSkillUI(); });
onBtn('gearAdd', () => { G.gear += 10; G.maki += 3; });

stage.addEventListener('pointerdown', ev => {
  ev.preventDefault(); initAudio(); $('startCover').hidden = true;
  const r = view.getBoundingClientRect(); G.taps.push({ x: (ev.clientX - r.left) * DPR, y: (ev.clientY - r.top) * DPR, t: 0 });
  requestStrike();
});
window.addEventListener('keydown', ev => { if (ev.code === 'Space' || ev.code === 'Enter'){ if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; ev.preventDefault(); initAudio(); $('startCover').hidden = true; requestStrike(); } });

/* the loop: real time (raw) drives the brush banner, the shake and the slow-motion clock;
   game time = raw × the speed setting × the slow-motion factor (1 when none). Slow motion only starts once a hit stop is over. */
let last = performance.now(), uiT = 0, oumaT = 0;
function loop(now){
  const raw = Math.min(0.05, (now - last) / 1000); last = now;
  let ts = 1;
  if (G.slow && G.stop <= 0){ ts = G.slow.scale; G.slow.t -= raw; if (G.slow.t <= 0) G.slow = null; }
  update(raw * SPEED * ts); render(); if (hero.complete && TAB === 'tameshi'){ drawSamples(raw); drawVfxList(raw); }
  stepBanner(raw); stepWords(raw);
  G.shake = Math.max(0, G.shake - raw);
  if (G.bars > 0 && !G.slow && G.stop <= 0) G.bars = Math.max(0, G.bars - raw * 2.5);
  for (const tp of G.taps) tp.t += raw; G.taps = G.taps.filter(tp => tp.t < 0.25);
  uiT += raw; if (uiT > 0.08){ uiT = 0; syncUI(); }
  oumaT += raw; if (oumaT > 5){ oumaT = 0; checkOuma(); }
  requestAnimationFrame(loop);
}
buildSkillbar(); buildSkillCards(); buildEquip(); buildItems(); buildStages();
if (FXIMG.complete) drawCardIcons(); else FXIMG.addEventListener('load', drawCardIcons);
try { document.fonts && document.fonts.ready.then(drawCardIcons); } catch (e) {}
new ResizeObserver(resize).observe(stage);
resize(); checkOuma(); syncUI(); requestAnimationFrame(loop);
try { document.fonts && document.fonts.load('64px "Yuji Syuku"', '駆け抜け一閃百鬼夜行酒呑童子の関影鬼神斬昇龍閃燕返し鷹落とし山崩し雷切風刃旋風五月雨突き息吹五十連横一文字突き切り上げ返し斬り退治関を越えた鳥居から出直し封'); } catch (e) {}
window.__g = G;
})();
</script>
