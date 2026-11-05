/* ---------- canvases ---------- */
const stage = $('stage'), view = $('view'), vctx = view.getContext('2d');
const lo = document.createElement('canvas'), lctx = lo.getContext('2d');
let LW = 0, LH = 0, K = 1, GY = 0, FEET = 0, HX = 0, DPR = 1;
let skyC, farC, midC, roadC, fgC, STARS = [];
const hero = new Image(); hero.src = 'hero.png';
// the yokai sheet and its tinted copies: white flash, gold, frozen dark, red warning
const YIMG = new Image(); YIMG.src = 'yokai.png';
let YW = null, YG = null, YD = null, YR = null;
YIMG.onload = () => {
  const tint = (op, col) => { const cv = document.createElement('canvas'); cv.width = YIMG.width; cv.height = YIMG.height; const g = cv.getContext('2d'); g.drawImage(YIMG, 0, 0); g.globalCompositeOperation = op; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height); return cv; };
  YW = tint('source-in', '#f4f2ff'); YG = tint('source-atop', 'rgba(255,196,60,0.55)'); YD = tint('source-atop', 'rgba(6,5,16,0.7)'); YR = tint('source-in', '#ff5a3a');
};
// tinted copies of the shadow's sheet: blue afterimages, and for 鬼神斬 a red-stained body and red afterimages
let ghostC = null, redC = null, redGhostC = null;
hero.onload = () => {
  const tint = (op, col) => { const cv = document.createElement('canvas'); cv.width = hero.width; cv.height = hero.height; const g = cv.getContext('2d'); g.drawImage(hero, 0, 0); g.globalCompositeOperation = op; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height); return cv; };
  ghostC = tint('source-in', 'rgb(110,140,255)');
  redC = tint('source-atop', 'rgba(200,16,24,0.62)');
  redGhostC = tint('source-in', 'rgb(255,50,40)');
  buildSamples();
};
// a torii stands on the road at every TORII_GAP; a fallen shadow starts again from the one behind it
const TORII = new Image(); TORII.src = 'torii.png';
/* ---------- backgrounds: one per road (STAGES[].bg) ----------
   'take': one finished picture. It is scaled to the height of the screen and cut in two at TAKE_SPLIT:
     the upper part (the grove) scrolls slowly, the lower part (the ground) scrolls with the road so feet never slide.
     The picture does not tile on its own, so every other copy is mirrored left-right, which makes the joins seamless.
   'map2': bg_far / bg_mid of v11, drawn 1:1 (one image pixel = one game pixel), tiled, the sky above filled with the top colour.
   'code': the code-drawn ridges and road of the first prototypes (also used while pictures are still loading). */
const BG = { far: new Image(), mid: new Image(), take: new Image(), ok: 0 };
BG.far.src = 'bg_far.png'; BG.mid.src = 'bg_mid.png'; BG.take.src = 'bg_take.jpg';
const BG_PARALLAX = { far: 0.08, mid: 0.3, take: 0.35 };
const BG_TOP = '#2e3150';                         // the far image's top row, used to extend the sky upward
const TAKE_SPLIT = 0.83;                          // where the bamboo picture's ground begins (fraction of its height)
let STAGE = 0, takeTop = null, takeGround = null;
for (const k of ['far', 'mid', 'take']) BG[k].onload = () => { BG.ok++; if (LW) buildLayers(); };
const bgKind = () => { const k = STAGES[STAGE].bg; if (k === 'map2' && BG.far.naturalWidth && BG.mid.naturalWidth) return 'map2'; if (k === 'take' && BG.take.naturalWidth) return 'take'; return 'code'; };
const bgReady = () => bgKind() === 'map2';
function mirrorStrip(img, sx, sy, sw, sh, dh){
  // the strip [sx,sy,sw,sh] of img scaled to height dh, followed by its mirror image: a tile that repeats without a seam
  const w = Math.max(1, Math.round(sw * dh / sh)), cv = mk(w * 2, dh), c = cv.getContext('2d');
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(img, sx, sy, sw, sh, 0, 0, w, dh);
  c.save(); c.translate(w * 2, 0); c.scale(-1, 1); c.drawImage(img, sx, sy, sw, sh, 0, 0, w, dh); c.restore();
  return cv;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function mk(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function px(ctx, x, y, w, h, c){ ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); }

function buildSky(){
  skyC = mk(LW, GY); const c = skyC.getContext('2d');
  if (bgKind() !== 'code'){ px(c, 0, 0, LW, GY, BG_TOP); STARS = []; return; }
  const im = c.createImageData(LW, GY), d = im.data;
  const st = ['#060920', '#0b1134', '#121b4d', '#1b2667', '#27327e'].map(hex);
  for (let y = 0; y < GY; y++){
    const p = Math.pow(y / (GY - 1), 1.25) * (st.length - 1), i = Math.min(st.length - 2, Math.floor(p)), f = p - i;
    for (let x = 0; x < LW; x++){ const col = bay(x, y) < f ? st[i + 1] : st[i], k = (y * LW + x) * 4; d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255; }
  }
  const mx = Math.round(LW * 0.78), my = Math.round(GY * 0.2), R = Math.max(7, Math.round(LH * 0.065));
  const moon = hex('#f2dda0'), rim = hex('#c9b077'), halo = hex('#323d8c');
  for (let y = my - R * 2; y <= my + R * 2; y++) for (let x = mx - R * 2; x <= mx + R * 2; x++){
    if (x < 0 || y < 0 || x >= LW || y >= GY) continue;
    const r = Math.hypot(x - mx, y - my), k = (y * LW + x) * 4; let col = null;
    if (r <= R - 1.2) col = moon; else if (r <= R) col = rim; else if (r <= R * 1.9 && bay(x, y) < 0.5 * (1 - (r - R) / (R * 0.9))) col = halo;
    if (col){ d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; }
  }
  c.putImageData(im, 0, 0);
  STARS = []; for (let i = 0; i < 70; i++) STARS.push([Math.random() * LW | 0, Math.random() * GY * 0.6 | 0, Math.random() * 6.28, Math.random() < 0.2]);
}
function ridgeTile(W, H, base, amp, waves, color, mist){
  const cv = mk(W, H), c = cv.getContext('2d'), im = c.createImageData(W, H), d = im.data, col = hex(color), m = mist ? hex(mist) : null;
  for (let x = 0; x < W; x++){
    let h = base; for (const [k, a, ph] of waves) h += amp * a * Math.sin(2 * Math.PI * k * x / W + ph);
    const top = Math.round(H - h);
    for (let y = Math.max(0, top); y < H; y++){
      const kk = (y * W + x) * 4, t = (y - top) / Math.max(1, H - top);
      const use = m && bay(x, y) < t * 0.85 ? m : col;
      d[kk] = use[0]; d[kk + 1] = use[1]; d[kk + 2] = use[2]; d[kk + 3] = 255;
    }
  }
  c.putImageData(im, 0, 0); return cv;
}
function pine(c, x, gy, h, col){
  px(c, x, gy - h, 2, h, col);
  for (const [f, w] of [[0.98, 9], [0.78, 13], [0.58, 11], [0.4, 8]]){ const y = gy - h * f; for (let r = -2; r <= 2; r++){ const ww = Math.round(w * Math.sqrt(1 - (r / 3) ** 2)); px(c, x - ww + (r < 0 ? 2 : 0), y + r, ww * 2 + 1, 1, col); } }
}
function torii(c, x, gy, col, beam){
  const h = 46; px(c, x - 14, gy - h, 3, h, col); px(c, x + 12, gy - h, 3, h, col);
  px(c, x - 21, gy - h - 4, 43, 3, beam); px(c, x - 23, gy - h - 6, 4, 2, beam); px(c, x + 20, gy - h - 6, 4, 2, beam);
  px(c, x - 17, gy - h + 6, 35, 2, beam); px(c, x - 1, gy - h - 1, 3, 7, col);
}
function buildLayers(){
  takeTop = takeGround = null;
  if (bgKind() === 'take'){
    const im = BG.take, H = im.naturalHeight, W = im.naturalWidth, split = Math.round(H * TAKE_SPLIT), top = Math.round(LH * TAKE_SPLIT);
    takeTop = mirrorStrip(im, 0, 0, W, split, top);
    takeGround = mirrorStrip(im, 0, split, W, H - split, LH - top);
  }
  if (bgReady()){
    // the AI maps, copied as they are; the horizon of each image sits one pixel under the road line
    farC = mk(BG.far.naturalWidth, BG.far.naturalHeight); farC.getContext('2d').drawImage(BG.far, 0, 0);
    midC = mk(BG.mid.naturalWidth, BG.mid.naturalHeight); midC.getContext('2d').drawImage(BG.mid, 0, 0);
    buildSky();
  } else {
    farC = ridgeTile(640, Math.round(GY * 0.5), GY * 0.24, GY * 0.1, [[1, 1, 0], [3, 0.45, 1.3], [7, 0.18, 2.1]], '#18215a', '#26317c');
    midC = mk(520, Math.round(GY * 0.45)); const mc = midC.getContext('2d'), mh = midC.height;
    mc.drawImage(ridgeTile(520, mh, mh * 0.18, mh * 0.08, [[1, 1, 0.6], [4, 0.35, 0.2]], '#10173f', '#141c4b'), 0, 0);
    for (const [x, h] of [[40, 52], [64, 38], [170, 58], [300, 44], [322, 60], [450, 50]]) pine(mc, x, mh - mh * 0.12, h, '#0c1133');
    torii(mc, 240, mh - mh * 0.1, '#2a0f1a', '#4a1622');
  }
  // the road: darker and closer to the earth of the new maps when they are in use
  const map = bgReady(), road = map ? ['#15141d', '#3a3a4e', '#22212e', '#23222f', '#2c2b39'] : ['#191430', '#4a4382', '#28214a', '#2c2652', '#372f62'];
  roadC = mk(320, LH - GY); const rc = roadC.getContext('2d');
  px(rc, 0, 0, 320, LH - GY, road[0]); px(rc, 0, 0, 320, 1, road[1]); px(rc, 0, 1, 320, 1, road[2]);
  for (let i = 0; i < 90; i++){ const y = 3 + Math.random() * (LH - GY - 4) | 0, x = Math.random() * 320 | 0; px(rc, x, y, Math.random() < 0.3 ? 2 : 1, 1, Math.random() < 0.5 ? road[3] : road[4]); }
  fgC = mk(700, 22); const fc = fgC.getContext('2d');
  for (let i = 0; i < 26; i++){ const x = Math.random() * 690 | 0; for (let b = 0; b < 5; b++){ const hh = 6 + Math.random() * 12 | 0, dx = b * 2 - 4; for (let y = 0; y < hh; y++) px(fc, x + dx + Math.round((y / hh) * (b - 2) * 1.5), 22 - y, 1, 1, '#06050f'); } }
}
function tile(c, layer, off, y){ const w = layer.width; let x = -(((off % w) + w) % w); for (; x < LW; x += w) c.drawImage(layer, Math.round(x), y); }
// sky, far and middle layers in one call (render() uses this)
function drawBackdrop(c, cam){
  if (takeTop){
    tile(c, takeTop, cam * BG_PARALLAX.take, 0);
    if (G.ouma){ c.fillStyle = 'rgba(150,30,60,0.22)'; c.fillRect(0, 0, LW, takeTop.height); }
    return;
  }
  c.drawImage(skyC, 0, 0);
  for (const s of STARS){ if (s[3] && Math.sin(G.time * 2 + s[2]) < 0) continue; px(c, s[0], s[1], 1, 1, s[3] ? '#c9d2ff' : '#6c78c0'); }
  const map = bgReady(), sink = map ? 1 : 0;
  tile(c, farC, cam * (map ? BG_PARALLAX.far : 0.12), GY - farC.height + sink);
  if (G.ouma){ c.fillStyle = 'rgba(150,30,60,0.28)'; c.fillRect(0, 0, LW, GY); }
  tile(c, midC, cam * (map ? BG_PARALLAX.mid : 0.4), GY - midC.height + sink);
}

// the road under the feet: the picture's own ground for 'take', the drawn strip otherwise
function drawRoad(c, cam){
  if (takeGround) tile(c, takeGround, cam, LH - takeGround.height);
  else tile(c, roadC, cam, GY);
}
// torii along the road, standing a little behind the line the figures walk on
function drawTorii(c, cam){
  if (!TORII.complete || !TORII.naturalWidth) return;
  const w = TORII.naturalWidth, h = TORII.naturalHeight, base = FEET - 7;
  const k0 = Math.floor((cam - HX - w) / TORII_GAP), k1 = Math.ceil((cam + LW) / TORII_GAP);
  for (let k = Math.max(0, k0); k <= k1; k++){ const sx = Math.round(SX(k * TORII_GAP) - w / 2); if (sx > LW || sx + w < 0) continue; c.drawImage(TORII, sx, base - h); }
}
function setStage(i){ STAGE = Math.max(0, Math.min(STAGES.length - 1, i)); if (LW){ buildSky(); buildLayers(); } }

function resize(){
  const r = stage.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  const dw = Math.round(r.width * DPR), dh = Math.round(r.height * DPR);
  K = Math.max(1, Math.round(dh / 400));
  LW = Math.ceil(dw / K); LH = Math.ceil(dh / K);
  view.width = LW * K; view.height = LH * K; view.style.width = (LW * K / DPR) + 'px'; view.style.height = (LH * K / DPR) + 'px';
  lo.width = LW; lo.height = LH; lctx.imageSmoothingEnabled = false; vctx.imageSmoothingEnabled = false;
  GY = Math.round(LH * 0.78); FEET = GY + Math.round((LH - GY) * 0.36); HX = Math.round(LW * 0.22);
  buildSky(); buildLayers();
}

/* ---------- sound ---------- */
let AC = null, MASTER = null, SOUND = true, SPEED = 1, VIBE = true;
const SE = {}, SE_FILES = { swing: 'se/01.wav', slashL: 'se/10.wav', slashH: 'se/02.wav', burst: 'se/14.wav', draw: 'se/12.wav' };   // 12 is the metallic ring of the guard, 10 the dull impact
try {
  if (localStorage.getItem('ghost-sprite-sound') === '0') SOUND = false;
  const s = localStorage.getItem('ghost-sprite-speed'); if (s && ['1', '0.5', '0.25'].includes(s)) SPEED = +s;
  if (localStorage.getItem('ghost-vibe') === '0') VIBE = false;
} catch (e) {}
function initAudio(){
  if (AC){ if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  MASTER = AC.createGain(); MASTER.gain.value = 0.8; MASTER.connect(AC.destination);
  for (const [k, f] of Object.entries(SE_FILES)) fetch(f).then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)).then(buf => { SE[k] = buf; }).catch(() => {});
}
// rate: playback speed (= pitch). jit: random spread of the pitch so repeats do not sound mechanical (0.08 = ±4%)
function play(k, vol, rate, jit){
  if (!SOUND || !AC || !SE[k]) return;
  const j = jit == null ? 0.08 : jit;
  const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = SE[k];
  s.playbackRate.value = (rate || 1) * (1 - j / 2 + Math.random() * j) * Math.max(0.6, SPEED);
  g.gain.value = vol == null ? 1 : vol; s.connect(g); g.connect(MASTER); s.start();
}
/* the chain raises the pitch of the cuts: one semitone for every three hits, up to a fifth (×1.5).
   Steps on the musical scale instead of a smooth slide, so a long chain sounds like a rising phrase.
   When the chain breaks the count starts again from 1, and the pitch is back to normal. */
const COMBO_STEP = 3, COMBO_MAX_SEMI = 7;
function comboRate(n){ return Math.pow(2, Math.min(COMBO_MAX_SEMI, Math.floor(Math.max(0, n - 1) / COMBO_STEP)) / 12); }
function beep(){
  if (!SOUND || !AC) return;
  const t = AC.currentTime;
  for (const [f, d] of [[880, 0], [1320, 0.09]]){ const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12); o.connect(g); g.connect(MASTER); o.start(t + d); o.stop(t + d + 0.14); }
}
// a reward reaching the counter: a small bell, one note higher for each pickup in a row (minor pentatonic)
const PENTA = [0, 3, 5, 7, 10];
function pickSound(i, type){
  if (!SOUND || !AC) return;
  const t = AC.currentTime, step = Math.min(i, 14), semi = 12 * Math.floor(step / 5) + PENTA[step % 5];
  const f = (type === 'gear' ? 659 : 880) * Math.pow(2, semi / 12);
  for (const [mul, vol, len] of type === 'gear' ? [[1, 0.09, 0.32], [1.5, 0.05, 0.4], [2, 0.04, 0.5]] : [[1, 0.07, 0.12], [2, 0.025, 0.08]]){
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type === 'koban' ? 'square' : 'triangle'; o.frequency.value = f * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(type === 'koban' ? vol * 0.5 : vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(MASTER); o.start(t); o.stop(t + len + 0.02);
  }
}

/* ---------- vibration ----------
   navigator.vibrate: works on Android Chrome after the first tap on the page. iPhone (Safari and every iOS browser) has no
   vibration for web pages, so nothing happens there. Chrome also refuses vibration inside a page embedded from another site,
   so in the prototype viewer it may stay silent; in the app (native shell) the same calls go to the phone's haptics.
   A short buzz never cuts off a longer, stronger one that is still running. */
const VIBES = { hit: 20, crit: [30, 50, 30], rare: [20, 40, 20, 40, 20], kill: [60, 40, 90], finish: [100, 50, 100, 50, 200] };
const VPRI = { hit: 0, crit: 1, rare: 1, kill: 2, finish: 3 };
let vibeUntil = 0, vibePri = -1;
function buzz(kind){
  if (!VIBE || !navigator.vibrate) return;
  const now = performance.now(), p = VPRI[kind], pat = VIBES[kind];
  if (pat == null || (now < vibeUntil && p <= vibePri)) return;
  try { if (navigator.vibrate(pat)){ vibeUntil = now + [].concat(pat).reduce((a, b) => a + b, 0) + 30; vibePri = p; } } catch (e) {}
}
