/* ---------- moves ----------
   every clip runs from one guard (hub) to another; frame 0 of a clip is its starting guard, so chaining starts at frame 1.
   hit: index in `frames` where the blade lands. lift: body height per frame (the game, not the drawing, carries jumps).
   arc: blade flash drawn in code. range: front | around | thrust | iai | wave. react: what the yokai does when struck. */
const CLIPS = {
  ready:    { a: 'c9',  name: '居合腰',       to: '居', frames: [1, 2, 3, 4], dt: [0.07, 0.07, 0.08, 0.1] },
  iai:      { a: 'c10', name: '居合斬り',     to: '振', frames: [1, 2, 3, 4], dt: [0.07, 0.05, 0.035, 0.06], hit: 3, heavy: true, arc: 'h', range: 'iai', react: 'push' },
  batto:    { a: 'd02', name: '抜刀',         to: '中', frames: [5, 4, 3, 2, 1, 0], dt: [0.04, 0.04, 0.04, 0.04, 0.04, 0.05] },
  retFuri:  { a: 'atk', name: '戻り',         to: '中', frames: [5, 6, 7, 8], dt: [0.07, 0.08, 0.09, 0.1] },
  yoko:     { a: 'atk', name: '横一文字',     to: '振', frames: [1, 2, 3, 4], dt: [0.06, 0.04, 0.04, 0.05], hit: 3, arc: 'h', react: 'push' },
  kiriage:  { a: 'c2',  name: '切り上げ',     to: '昇', frames: [1, 2, 3, 4], dt: [0.06, 0.04, 0.05, 0.08], hit: 2, arc: 'up', react: 'launch' },
  shoFuri:  { a: 'c1',  name: '返し斬り',     to: '振', frames: [1, 2, 3, 4], dt: [0.05, 0.04, 0.05, 0.06], hit: 1, arc: 'down', react: 'slam' },
  retSho:   { a: 'c3',  name: '戻り',         to: '中', frames: [1, 2, 4], dt: [0.07, 0.08, 0.1] },
  kaburi:   { a: 'c11', name: '振りかぶり',   to: '上', frames: [1, 2, 3, 4], dt: [0.05, 0.05, 0.06, 0.07] },
  jodan:    { a: 'c4',  name: '上段一周',     to: '上', frames: [1, 2, 3, 4], dt: [0.045, 0.05, 0.06, 0.07], hit: 0, arc: 'down' },
  kesa:     { a: 'c6',  name: '袈裟斬り',     to: '袈', frames: [1, 2, 3, 4], dt: [0.07, 0.06, 0.04, 0.06], hit: 2, heavy: true, arc: 'down', react: 'slam' },
  retKesa:  { a: 'c7',  name: '戻り',         to: '中', frames: [1, 2, 3, 4], dt: [0.07, 0.08, 0.09, 0.1] },
  chuLoop:  { a: 'c5',  name: '中段一周',     to: '中', frames: [1, 2, 3, 4], dt: [0.05, 0.045, 0.05, 0.08], hit: 1, arc: 'h', range: 'around' },
  kaiten:   { a: 'c12', name: '回転斬り',     to: '振', frames: [1, 2, 3, 4], dt: [0.06, 0.05, 0.05, 0.06], hit: 3, arc: 'h', range: 'around', react: 'push' },
  tsuki:    { a: 'd14', name: '突き',         to: '脇', frames: [1, 2, 3, 4], dt: [0.05, 0.08, 0.07, 0.07], hit: 0, arc: 'thrust', range: 'thrust', react: 'push' },
  oroshiA:  { a: 'd15', name: '斬り下ろし',   to: '屈', frames: [1, 2, 3, 4], dt: [0.07, 0.05, 0.045, 0.07], hit: 2, heavy: true, arc: 'down', react: 'slam' },
  oroshiB:  { a: 'd16', name: '斬り下ろし',   to: '屈', frames: [1, 2, 3, 4], dt: [0.07, 0.05, 0.045, 0.07], hit: 2, heavy: true, arc: 'down', react: 'slam' },
  leap:     { a: 'd03', name: '飛燕',         to: '空', frames: [1, 2, 3, 4, 5, 6], dt: [0.05, 0.05, 0.05, 0.05, 0.05, 0.06], hit: 4, arc: 'up', react: 'launch', lift: [0, -8, -30, -55, -72, -80] },
  kabuto:   { a: 'd04', name: '兜割り',       to: '屈', frames: [1, 2, 3, 4, 5, 6], dt: [0.06, 0.05, 0.04, 0.06, 0.07, 0.08], hit: 3, heavy: true, arc: 'down', range: 'wave', react: 'slam', lift: [-80, -74, -40, 0, 0, 0], impact: 3 },
  ageTsuki: { a: 'd05', name: '斬り上げ突き', to: '中', frames: [1, 2, 3, 4, 5, 6], dt: [0.06, 0.05, 0.05, 0.04, 0.05, 0.08], hit: 4, arc: 'thrust', range: 'thrust', react: 'launch' },
  shoryu:   { a: 'd12', name: '昇竜',         to: '竜', frames: [1, 2, 3, 4], dt: [0.05, 0.05, 0.045, 0.08], hit: 3, heavy: true, arc: 'up', react: 'launch', lift: [0, -20, -55, -82] },
  shoLand:  { a: 'd13', name: '着地',         to: '上', frames: [1, 2, 3, 4], dt: [0.06, 0.06, 0.07, 0.08], lift: [-70, -40, -12, 0], impact: 3 },
  hurt:     { a: 'd10', name: '被弾',         to: '傷', frames: [1, 2, 3, 4], dt: [0.05, 0.06, 0.07, 0.12] },
  hurtBack: { a: 'd10', name: '戻り',         to: '中', frames: [3, 2, 1, 0], dt: [0.07, 0.07, 0.08, 0.09] },
  down:     { a: 'd11', name: 'ダウン',       to: '倒', frames: [1, 2, 3, 4], dt: [0.08, 0.08, 0.1, 0.6] },
  noto:     { a: 'd02', name: '納刀',         to: '立', frames: [1, 2, 3, 4, 5, 6], dt: [0.08, 0.08, 0.08, 0.09, 0.1, 0.22], chin: 5 },
  chiburi:  { a: 'd09', name: '血振り',       to: '血', frames: [1, 2, 3, 4], dt: [0.07, 0.05, 0.06, 0.18] },
  chiNoto:  { a: 'd08', name: '納刀',         to: '立', frames: [1, 2, 3, 4], dt: [0.09, 0.09, 0.1, 0.22], chin: 3 },
  rei:      { a: 'd07', name: '一礼',         to: '礼', frames: [1, 2, 3, 4], dt: [0.12, 0.12, 0.12, 0.45] },
  reiUp:    { a: 'd07', name: '一礼',         to: '立', frames: [3, 2, 1, 0], dt: [0.1, 0.1, 0.1, 0.2] }
};
const ATTACKS = {
  '中': [['kiriage', 3], ['yoko', 3], ['kaiten', 2], ['chuLoop', 2], ['kaburi', 2], ['tsuki', 3]],
  '上': [['jodan', 3], ['kesa', 2]], '昇': [['shoFuri', 1]], '脇': [['oroshiA', 1], ['oroshiB', 1]],
  '屈': [['leap', 2], ['shoryu', 2], ['ageTsuki', 2]], '空': [['kabuto', 1]]
};
const RETURNS = { '振': 'retFuri', '袈': 'retKesa', '昇': 'retSho', '竜': 'shoLand', '傷': 'hurtBack' };
const FLOW = new Set(['上', '脇', '屈', '空']);   // guards that keep the combo going even without a tap
const SAMPLES = [
  ['c9', '居合腰', '立 → 居', ''], ['c10', '居合斬り', '居 → 振', ''], ['atk', '横一文字（前回）', '中 → 振 → 中', '斬撃が絵に焼き込まれている'],
  ['c2', '切り上げ', '中 → 昇', '斬撃が焼き込み'], ['c1', '返し斬り', '昇 → 振', ''], ['c3', '切り上げの戻り', '昇 → 中', '4コマ目に刀が2本（ゲームでは飛ばす）'],
  ['c11', '振りかぶり', '中 → 上', ''], ['c4', '上段一周', '上 → 上', '一周というより小さな振り'], ['c6', '袈裟斬り', '上 → 袈', ''],
  ['c7', '袈裟の戻り', '袈 → 中', ''], ['c5', '中段一周', '中 → 中', '途中で正面を向く。斬撃が焼き込み'], ['c12', '回転斬り', '中 → 振', '正面を向いて回る'],
  ['d14', '突き', '中 → 脇', '突いたあと刀を立てて終わる'], ['d15', '斬り下ろし A', '脇 → 屈', ''], ['d16', '斬り下ろし B', '脇 → 屈', ''],
  ['d03', '飛燕（跳躍斬り）', '屈 → 空', '黄色い斬撃が焼き込み'], ['d04', '兜割り', '空 → 着地', '着地の衝撃が焼き込み'], ['d05', '斬り上げ突き', '屈 → 中', ''],
  ['d12', '昇竜', '屈 → 竜', ''], ['d13', '昇竜の着地', '竜 → 上', ''],
  ['d02', '納刀（逆再生で抜刀）', '中 → 立', '途中で正面を向く'], ['d09', '血振り', '中 → 血', '斬撃が焼き込み'], ['d08', '血振りからの納刀', '血 → 立', ''],
  ['d07', '一礼', '立 → 礼', '礼が浅い（ゲームでは止めを長めに）'], ['d10', '被弾', '中 → 傷', ''], ['d11', 'ダウン', '傷 → 倒', ''],
  ['d00', '（立ちから正面へ）', '立 → ?', '正面を向いて終わる。未使用'], ['d01', '血振り納刀（8コマ）', '中 → ?', '最後に刀がまた出ている。未使用'], ['d06', '立ち姿の揺れ', '立 → 立', '未使用（待機用に取っておく）'],
  ['c8', '（始まりの構えが不明）', '? → 振', '未使用'], ['walk', '歩き', '一周', ''], ['run', '走り', '一周', '未使用（縮地に変更）'],
  ['b01', '中段の呼吸', '中 → 中', '技と技の間の待ちでくり返す'], ['b02', '摺り足', '中 → 中', '間合いを詰めるときにくり返す']
];
const WARN = new Set(['atk', 'c2', 'c3', 'c4', 'c5', 'c12', 'c8', 'd03', 'd04', 'd02', 'd09', 'd07', 'd00', 'd01']);

/* ---------- yokai ----------
   spr: pixel sprite in the yokai sheet (w is the body width used for reach; height comes from the sprite).
   鬼火 and ぬらりひょん are still drawn in code until their sprites arrive.
   center: the sprite is anchored at its middle (fliers drawn around their body, not standing on feet).
   hp is for the first road at the recommended level: road yokai fall in 1 cut (small fry) or 2-3 cuts (normal ones);
   golden yokai, generals and bosses are tougher on purpose. Each road multiplies hp (see STAGES / lvMul). */
const KINDS = {
  hitotsume: { name: '一つ目小僧', tier: 'fodder', hp: 10,  dmg: 3,  v: 60, w: 34, soul: 1,   spr: 'hitotsume' },
  chochin:   { name: '提灯お化け', tier: 'fodder', hp: 10,  dmg: 3,  v: 66, w: 40, soul: 1,   spr: 'chochin' },
  ittan:     { name: '一反木綿',   tier: 'fodder', hp: 9,   dmg: 3,  v: 80, w: 40, soul: 1,   spr: 'ittan', fly: 70, center: true },
  hibi:      { name: '鬼火',       tier: 'fodder', hp: 9,   dmg: 3,  v: 76, w: 34, h: 46, soul: 1, fly: 112, deco: 'flame' },
  kappa:     { name: '河童',       tier: 'normal', hp: 26,  dmg: 9,  v: 48, w: 46, soul: 3,   spr: 'kappa' },
  tanuki:    { name: '化け狸',     tier: 'normal', hp: 30,  dmg: 10, v: 40, w: 56, soul: 3,   spr: 'tanuki' },
  yamaotoko: { name: '山男',       tier: 'normal', hp: 28,  dmg: 10, v: 62, w: 48, soul: 3,   spr: 'yamaotoko' },
  karasu:    { name: '烏天狗',     tier: 'normal', hp: 25,  dmg: 9,  v: 56, w: 50, soul: 3,   spr: 'karasu' },
  kubi:      { name: '飛び首',     tier: 'normal', hp: 24,  dmg: 9,  v: 70, w: 50, soul: 3,   spr: 'kubi', fly: 96, center: true },   // 名前は仮
  kappaT:    { name: '河童大将',   tier: 'taisho', hp: 380, dmg: 16, v: 34, w: 96, soul: 50,  spr: 'kappaT', poise: true },
  tanukiT:   { name: '狸大将',     tier: 'taisho', hp: 420, dmg: 16, v: 32, w: 100, soul: 50,  spr: 'tanukiT', poise: true },
  shuten:    { name: '酒呑童子',   tier: 'boss',   hp: 1000, dmg: 24, v: 26, w: 150, soul: 150, spr: 'shutenIdle', sprAtk: 'shutenAtk', poise: true },
  nura:      { name: 'ぬらりひょん', tier: 'boss', hp: 900, dmg: 20, v: 28, w: 80, h: 170, soul: 300, body: '#1c1a30', eye: '#d6ff7a', deco: 'nura', poise: true },
  zashiki:   { name: '座敷童',     tier: 'rare',   hp: 8,  dmg: 0,  v: 95, w: 30, soul: 200, spr: 'zashiki', faceRight: true }
};
const FODDER = ['hitotsume', 'chochin', 'ittan', 'hibi'], NORMALS = ['kappa', 'tanuki', 'yamaotoko', 'karasu', 'kubi'], TAISHO = ['kappaT', 'tanukiT'];

/* ---------- roads (stages) and the shadow's rank (level) ----------
   Damage grows ×LV_GROWTH per level; a road's yokai hp grows the same way with its recommended level (rec),
   so at the recommended level the road feels the same, and on a new road the cuts stop being one-shots until the shadow is trained.
   bg: 'take' = one-piece picture (bamboo grove), 'map2' = the two-layer maps of v11, 'code' = the code-drawn night road. */
const STAGES = [
  { name: '竹林の夜',     rec: 1,  bg: 'take' },
  { name: '廃神社の山道', rec: 6,  bg: 'map2' },
  { name: '月夜の街道',   rec: 11, bg: 'code' }
];
const LV_GROWTH = 1.12, BASE_DMG = 12;
const lvMul = lv => Math.pow(LV_GROWTH, lv - 1);
const xpNext = lv => 10 + lv * 8;                       // experience to the next rank (each yokai gives its soul value)

/* ---------- skills (技) and secret arts (奥義) ----------
   Four skills are set, plus one secret art. Skills fire by themselves when ready and when their moment comes (cond in skills1.js).
   clip: the move used. mul: damage multiplier. air: reaches yokai above the head. range: [near, far] from the blade reach.
   knock: extra push. shot: flying slash. wave: ground shock that runs ahead. multi: extra thrusts. ki: extra 気.
   icon: [effect sheet key, frame, options] drawn on the card, or ['@字', ink colour, glow colour] for a brush character. Lv5 is 極: ×1.5 and sometimes fires twice (極連撃). */
const SKILLS = {
  shoryu:   { name: '昇龍閃',     tag: '対空', cd: 7, clip: 'shoryu', mul: 3.0, air: true, react: 'launch', icon: ['wind', 3, { flipY: true }],
              desc: '跳び上がりながら斬り上げる。頭上の妖怪にも届き、高く打ち上げる。空の敵がいると優先して出る。' },
  tsubame:  { name: '燕落とし',   tag: '対空・2連', cd: 9, clip: 'leap', mul: 1.8, air: true, react: 'launch', then: 'kabuto', thenMul: 2.2, icon: ['moon', 2, { rot: -0.7 }],
              desc: '跳んで斬り上げ、そのまま兜割りで地面へ叩き落とす2段技。空の敵がいると優先して出る。' },
  raikiri:  { name: '雷切',       tag: '近距離・高威力', cd: 10, clip: 'iai', mul: 5.0, range: [-30, 0], react: 'push', icon: ['bolt', 2],
              desc: '雷をまとった居合。間合いは短いが、一太刀の威力はいちばん高い。大将やボスに向く。' },
  kazeba:   { name: '風刃',       tag: '遠距離・貫通', cd: 8, clip: 'yoko', mul: 1.3, shot: true, react: 'push', icon: ['moon', 3, { sx: 1.5, sy: 0.6 }],
              desc: '斬撃を飛ばす。画面の端まで飛び、通り道の妖怪を空の敵ごとすべて斬る。離れていても出る。' },
  chiretsu: { name: '地裂斬',     tag: '遠距離・地上', cd: 11, clip: 'oroshiA', mul: 1.4, wave: true, react: 'launch', icon: ['thunder', 3],
              desc: '地面を叩き割り、衝撃が地を走る。地上の妖怪をまとめて打ち上げる。空の敵には当たらない。' },
  senpu:    { name: '旋風',       tag: '周囲・押し返し', cd: 9, clip: 'kaiten', mul: 1.6, range: [-70, 60], knock: 90, react: 'push', icon: ['ringB', 4],
              desc: '回りながら周りをまとめて斬り、群れを大きく押し返す。妖怪が2体以上近いときに出る。' },
  samidare: { name: '五月雨突き', tag: '連撃・気', cd: 7, clip: 'tsuki', mul: 0.7, multi: 6, ki: 6, react: 'push', icon: ['spark', 2],
              desc: '目にも止まらぬ7連突き。連撃数と「気」を一気に稼ぎ、奥義を早める。' },
  ibuki:    { name: '息吹',       tag: '回復・結界', cd: 16, buff: true, heal: 0.3, inv: 2, icon: ['aoFire', 3],
              desc: '深く呼吸して体力を3割回復し、2秒のあいだ結界で守る。体力が6割を切ると出る。' }
};
const OUGI = {
  kake:   { name: '駆け抜け一閃', icon: ['@閃', '#e9eeff', '#3a5ad0'], desc: '画面が白く光り、妖怪の群れの向こうへ駆け抜ける。背を向けて納刀した瞬間、通り抜けた妖怪に順に雷が走る。' },
  kishin: { name: '鬼神斬',       icon: ['@鬼', '#ff5a4a', '#7a0c18'], desc: '目が赤く光り、体が赤く染まる。目にも止まらぬ速さで斬りまくって納刀した次の瞬間、画面中の妖怪に50連撃が入る。' }
};
const SKILL_XP = [0, 3, 7, 12, 18];                      // uses needed to reach Lv1..Lv5 (Lv5 = 極)
const SKILL_LV_MUL = 0.12, KIWAME_MUL = 1.5, KIWAME_TWICE = 0.25;

/* ---------- equipment (装備) ----------
   each piece is raised with 装具 (gear dropped by generals, bosses and zashiki-warashi). per: effect per level. */
const EQUIP = [
  { id: 'hachi',   name: '鉢金', part: '頭',     icon: 'hachi',   eff: 'hp',   per: 0.05, label: '体力' },
  { id: 'oni',     name: '鬼面', part: '面',     icon: 'oni',     eff: 'crit', per: 0.01, label: '会心率' },
  { id: 'do',      name: '胴',   part: '胴',     icon: 'do',      eff: 'hp',   per: 0.08, label: '体力' },
  { id: 'kote',    name: '籠手', part: '腕',     icon: 'kote',    eff: 'atk',  per: 0.04, label: '攻撃' },
  { id: 'sune',    name: '脛当', part: '脚',     icon: 'sune',    eff: 'step', per: 0.05, label: '踏み込み' },
  { id: 'tsuba',   name: '鍔',   part: '刀',     icon: 'tsuba',   eff: 'atk',  per: 0.06, label: '攻撃' },
  { id: 'omamori', name: '御守', part: 'お守り', icon: 'omamori', eff: 'soul', per: 0.05, label: '霊玉' }
];

/* ---------- tuning ---------- */
const WALK_V = 92, DASH_V = 440, WALK_DT = 0.11, STEP_V = 230;
const AUTO_WAIT = 0.4, CHAIN = 1.1, PX_PER_RI = 293000, HP_MAX = 100, SETBACK = 1800;
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KIME = ATLAS.c10[4];
const REACH = KIME.ox + KIME.w - 12;     // the iai blade tip, minus a little so it passes through the yokai
const CONTACT = REACH - 30;              // where the front edge of a yokai stops
const REACH_HIT = REACH + 18;            // how far a cut actually lands (a little longer than the drawing, for a forgiving feel)
const GATE = 3000;                       // a boss gate every this many pixels (short, for the prototype)
const TORII_GAP = 2600;                  // a torii stands on the road every this many pixels; a fallen shadow starts again from one
const KI_MAX = 24;                       // hits that fill the gauge for the secret art

/* ---------- 手応え（フェーズ2） ----------
   会心: a hit that lands from a tap is more likely to be a critical; the chance climbs a little with the chain.
   The same feel('crit') is what the camera mode's S判定 should call later. */
const CRIT_AUTO = 0.04, CRIT_TAP = 0.10, CRIT_COMBO = 0.002, CRIT_COMBO_MAX = 0.06;
const BREATH_DT = 0.13, SURI_DT = 0.09;   // frame time of the middle-guard breath and the sliding step
// knockback: a struck yokai is pushed back at this speed (px/s per point of push) and does not walk in while it slides
const KNOCK_V = 9, KNOCK_DECAY = 9, POISE_KNOCK = 0.3;
// rewards that burst out: [pieces, coins, gear chance (rolled twice), guaranteed gear, scroll chance]
const LOOT = { boss: [60, 16, 0.4, 2, 0.5], taisho: [36, 10, 0.4, 1, 0.25], rare: [32, 8, 0.5, 2, 0.6], gold: [16, 12, 0, 0, 0.05] };
