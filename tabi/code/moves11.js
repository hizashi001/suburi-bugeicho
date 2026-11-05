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
  reiUp:    { a: 'd07', name: '一礼',         to: '立', frames: [3, 2, 1, 0], dt: [0.1, 0.1, 0.1, 0.2] },
  // after the sword is home: rise to an upright stance and hold it (残心). The secret arts take effect at its end
  kuchu:    { a: 'b03', name: '空中横一閃',   to: '空', frames: [0, 1, 2, 3, 4, 5], dt: [0.04, 0.035, 0.035, 0.04, 0.05, 0.07], hit: 2, arc: 'h', react: 'push', lift: [-95, -100, -102, -102, -100, -98] },
  zanshin:  { a: 'c9',  name: '残心',         to: '立', frames: [3, 2, 1, 0], dt: [0.05, 0.05, 0.06, 0.42], zan: true }
};
/* ordinary cuts (基本技): only the light ones. They open a chain of up to BASIC_MAX cuts; the big moves
   (袈裟・昇竜・飛燕・兜割り・回転…) belong to the skills, which take the chain on from there. */
const ATTACKS = {
  '中': [['yoko', 3], ['tsuki', 2], ['kiriage', 2], ['shoFuri', 1]],
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
  ['c8', '（始まりの構えが不明）', '? → 振', '未使用'], ['walk', '歩き', '一周', ''], ['run', '走り（旧）', '一周', '未使用'],
  ['b01', '中段の呼吸', '中 → 中', '技と技の間の待ちでくり返す'], ['b02', '摺り足', '中 → 中', '間合いを詰めるときにくり返す'], ['b03', '空中横一閃', '空 → 空', '昇龍閃・燕返しの空中で使う'], ['r01', '走り', '一周', '妖怪が見えたら駆け寄る']
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
  karasu:    { name: '烏天狗',     tier: 'normal', hp: 25,  dmg: 9,  v: 56, w: 50, soul: 3,   spr: 'karasu', fly: 48 },
  kubi:      { name: '抜け首',     tier: 'normal', hp: 24,  dmg: 9,  v: 70, w: 50, soul: 3,   spr: 'kubi', fly: 96, center: true },
  kappaT:    { name: '河童大将',   tier: 'taisho', hp: 380, dmg: 16, v: 34, w: 96, soul: 50,  spr: 'kappaT', poise: true },
  tanukiT:   { name: '狸大将',     tier: 'taisho', hp: 420, dmg: 16, v: 32, w: 100, soul: 50,  spr: 'tanukiT', poise: true },
  shuten:    { name: '酒呑童子',   tier: 'boss',   hp: 1000, dmg: 24, v: 26, w: 150, soul: 150, spr: 'shutenIdle', sprAtk: 'shutenAtk', poise: true },
  nura:      { name: 'ぬらりひょん', tier: 'boss', hp: 900, dmg: 20, v: 28, w: 80, h: 170, soul: 300, body: '#1c1a30', eye: '#d6ff7a', deco: 'nura', poise: true },
  zashiki:   { name: '座敷童',     tier: 'rare',   hp: 8,  dmg: 0,  v: 95, w: 30, soul: 200, spr: 'zashiki', faceRight: true }
};
const FODDER = ['hitotsume', 'chochin', 'ittan', 'hibi'], NORMALS = ['kappa', 'tanuki', 'karasu', 'kubi'], TAISHO = ['kappaT', 'tanukiT'];   // 山男 (the body of 抜け首) is no longer used

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
   Four skills are set, plus one secret art. A chain opens with a few ordinary cuts; from then on every ready skill
   takes over the instant the previous one lands (cancel), so the set of four decides how the chain flows.
   steps: the moves a skill is made of, played back to back (each one cancels into the next as soon as it lands).
     clip: the move. mul: damage. hit: false = no cut (a wind-up). air: reaches above the head. lift: body height per frame
     (jumps / dives). move: how far the shadow travels forward during the step. react / knock / fling: what the yokai does.
     shot: flying slash(es). wave: ground shock. multi: extra cuts. ki: extra 気. fx: the skill's own effect at the landing.
   icon: [effect sheet key, frame, options] drawn on the card, or ['@字', ink colour, glow colour] for a brush character.
   Lv5 is 極: ×1.5 and sometimes fires twice (極連撃). */
const SKILLS = {
  shoryu:   { name: '昇龍閃', tag: '対空・打ち上げ', cd: 4, icon: ['wind', 3, { flipY: true }],
              desc: '高く跳び上がりながら3回斬り上げ、空中で横一閃を浴びせる。空の敵がいると先に出る。',
              steps: [{ clip: 'shoryu', mul: 1.2, air: true, react: 'launch', multi: 2, lift: [0, -40, -100, -150], fx: 'rise' },
                      { clip: 'kuchu', mul: 1.4, air: true, react: 'launch', lift: [-150, -156, -158, -156, -152, -148], fx: 'air' },
                      { clip: 'shoLand', hit: false, lift: [-140, -90, -35, 0] }] },
  tsubame:  { name: '燕返し',   tag: '空・地・空のジグザグ', cd: 6, icon: ['moon', 2, { rot: -0.7 }],
              desc: '跳んで斬り上げ、空中で横一閃、急降下して地面ごと斬り伏せ、また斬り上げる。空→地→空と稲妻のように動く4段技。',
              steps: [{ clip: 'leap', mul: 1.3, air: true, react: 'launch', move: 30, fx: 'rise' },
                      { clip: 'kuchu', mul: 1.3, air: true, react: 'launch', move: 25, fx: 'air' },
                      { clip: 'kabuto', mul: 1.6, air: true, react: 'slam', move: 40, fx: 'slam', lift: [-100, -84, -40, 0, 0, 0] },
                      { clip: 'shoryu', mul: 1.6, air: true, react: 'launch', lift: [0, -40, -95, -130], fx: 'rise' }, { clip: 'shoLand', hit: false }] },
  taka:     { name: '鷹落とし', tag: '急降下・衝撃波', cd: 7, icon: ['thunder', 3],
              desc: '空高く跳び上がり、鷹のように斜めに急降下して叩き斬る。着地の衝撃が地を走り、地上の妖怪をまとめて打ち上げる。',
              steps: [{ clip: 'leap', hit: false, lift: [0, -30, -80, -130, -165, -180], move: 20 },
                      { clip: 'kabuto', mul: 3.0, air: true, react: 'launch', wave: true, move: 110, lift: [-180, -150, -80, 0, 0, 0], fx: 'dive' }] },
  yama:     { name: '山崩し',   tag: '一撃で吹き飛ばす', cd: 6, icon: ['explode', 4],
              desc: '大きく振りかぶり、袈裟の一撃で妖怪を遠くまで吹き飛ばす。飛ばされた妖怪は後ろの妖怪を巻き込む。',
              steps: [{ clip: 'kaburi', hit: false, fx: 'charge' }, { clip: 'kesa', mul: 3.2, react: 'push', fling: 1.5, fx: 'blast' }] },
  raikiri:  { name: '雷切',     tag: '近距離・最大威力', cd: 6, icon: ['bolt', 2],
              desc: '雷をまとって敵の向こうへ駆け抜ける居合。一太刀の威力はいちばん高い。大将やボスに向く。',
              steps: [{ clip: 'iai', mul: 5.0, react: 'push', move: 70, range: [-30, 10], fx: 'thunder' }] },
  kazeba:   { name: '風刃',     tag: '遠距離・貫通', cd: 5, icon: ['moon', 3, { sx: 1.5, sy: 0.6 }],
              desc: '斬撃を2つ飛ばす。画面の端まで飛び、通り道の妖怪を空の敵ごとすべて斬る。離れていても出る。',
              steps: [{ clip: 'yoko', mul: 1.2, react: 'push', shot: 2, fx: 'shot' }] },
  senpu:    { name: '旋風',     tag: '周囲・連続回転', cd: 6, icon: ['ringB', 4],
              desc: '3回転して周りをまとめて斬り、群れを押し返す。妖怪が2体以上近いときに出る。',
              steps: [{ clip: 'kaiten', mul: 1.0, range: [-70, 60], knock: 30, react: 'push', fx: 'spin' },
                      { clip: 'chuLoop', mul: 1.0, range: [-70, 60], knock: 30, react: 'push', fx: 'spin' },
                      { clip: 'kaiten', mul: 1.4, range: [-70, 60], knock: 80, react: 'push', fx: 'spin' }] },
  samidare: { name: '五月雨突き', tag: '連撃・気', cd: 5, icon: ['spark', 2],
              desc: '踏み込みながら目にも止まらぬ7連突き。連撃数と「気」を一気に稼ぎ、奥義を早める。',
              steps: [{ clip: 'tsuki', mul: 0.7, multi: 6, ki: 6, react: 'push', move: 50, fx: 'thrust' }] },
  ibuki:    { name: '息吹',     tag: '回復・結界', cd: 14, buff: true, heal: 0.3, inv: 2, icon: ['aoFire', 3],
              desc: '深く呼吸して体力を3割回復し、2秒のあいだ結界で守る。体力が6割を切ると出る（連撃の合間には出ない）。' }
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
const RUN_V = 340, RUN_DT = 0.075;       // running at a yokai seen on screen (r01), then the opening draw-cut (抜刀斬り)
const BASIC_MAX = 3;                     // ordinary cuts that chain by themselves before a skill (or a return to the guard)
const CHAIN_SKILLS = 4;                  // skills that can follow one another in one chain
const AUTO_WAIT = 0.25, CHAIN = 1.1, PX_PER_RI = 293000, HP_MAX = 100, SETBACK = 1800;
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KIME = ATLAS.c10[4];
const REACH = KIME.ox + KIME.w - 12;     // the iai blade tip, minus a little so it passes through the yokai
const CONTACT = REACH - 14;              // where the front edge of a yokai stops (a wider gap: the effects land clear of the shadow)
const REACH_HIT = REACH + 26;            // how far a cut actually lands; the effects of a cut are placed here (the tip of the reach)
const GATE = 6000;                       // a boss gate every this many pixels
const TORII_GAP = 2600;                  // a torii stands on the road every this many pixels; a fallen shadow starts again from one
const KI_MAX = 24;                       // hits that fill the gauge for the secret art

/* ---------- 吹き飛び ----------
   a skill's finishing blow (and 山崩し) throws the yokai back along a parabola; a killing blow from a skill does too,
   and the yokai falls apart where it lands. No extra drawing: the sprite leans back a little while it flies. */
const FLING_VX = 330, FLING_VY = 360, FLING_G = 900;

/* ---------- 手応え（フェーズ2） ----------
   会心: a hit that lands from a tap is more likely to be a critical; the chance climbs a little with the chain.
   The same feel('crit') is what the camera mode's S判定 should call later. */
const CRIT_AUTO = 0.04, CRIT_TAP = 0.10, CRIT_COMBO = 0.002, CRIT_COMBO_MAX = 0.06;
const BREATH_DT = 0.13, SURI_DT = 0.09;   // frame time of the middle-guard breath and the sliding step
// knockback: a struck yokai is pushed back at this speed (px/s per point of push) and does not walk in while it slides
const KNOCK_V = 9, KNOCK_DECAY = 9, POISE_KNOCK = 0.3;
// rewards that burst out: [pieces, coins, gear chance (rolled twice), guaranteed gear, scroll chance]
const LOOT = { boss: [60, 16, 0.4, 2, 0.5], taisho: [36, 10, 0.4, 1, 0.25], rare: [32, 8, 0.5, 2, 0.6], gold: [16, 12, 0, 0, 0.05] };
