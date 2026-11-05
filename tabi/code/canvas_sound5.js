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
let ghostC = null;
hero.onload = () => {
  ghostC = document.createElement('canvas'); ghostC.width = hero.width; ghostC.height = hero.height;
  const g = ghostC.getContext('2d'); g.drawImage(hero, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(110,140,255)'; g.fillRect(0, 0, ghostC.width, ghostC.height);
  buildSamples();
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function mk(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function px(ctx, x, y, w, h, c){ ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); }

function buildSky(){
  skyC = mk(LW, GY); const c = skyC.getContext('2d'), im = c.createImageData(LW, GY), d = im.data;
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
  farC = ridgeTile(640, Math.round(GY * 0.5), GY * 0.24, GY * 0.1, [[1, 1, 0], [3, 0.45, 1.3], [7, 0.18, 2.1]], '#18215a', '#26317c');
  midC = mk(520, Math.round(GY * 0.45)); const mc = midC.getContext('2d'), mh = midC.height;
  mc.drawImage(ridgeTile(520, mh, mh * 0.18, mh * 0.08, [[1, 1, 0.6], [4, 0.35, 0.2]], '#10173f', '#141c4b'), 0, 0);
  for (const [x, h] of [[40, 52], [64, 38], [170, 58], [300, 44], [322, 60], [450, 50]]) pine(mc, x, mh - mh * 0.12, h, '#0c1133');
  torii(mc, 240, mh - mh * 0.1, '#2a0f1a', '#4a1622');
  roadC = mk(320, LH - GY); const rc = roadC.getContext('2d');
  px(rc, 0, 0, 320, LH - GY, '#191430'); px(rc, 0, 0, 320, 1, '#4a4382'); px(rc, 0, 1, 320, 1, '#28214a');
  for (let i = 0; i < 90; i++){ const y = 3 + Math.random() * (LH - GY - 4) | 0, x = Math.random() * 320 | 0; px(rc, x, y, Math.random() < 0.3 ? 2 : 1, 1, Math.random() < 0.5 ? '#2c2652' : '#372f62'); }
  fgC = mk(700, 22); const fc = fgC.getContext('2d');
  for (let i = 0; i < 26; i++){ const x = Math.random() * 690 | 0; for (let b = 0; b < 5; b++){ const hh = 6 + Math.random() * 12 | 0, dx = b * 2 - 4; for (let y = 0; y < hh; y++) px(fc, x + dx + Math.round((y / hh) * (b - 2) * 1.5), 22 - y, 1, 1, '#06050f'); } }
}
function tile(c, layer, off, y){ const w = layer.width; let x = -(((off % w) + w) % w); for (; x < LW; x += w) c.drawImage(layer, Math.round(x), y); }

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
let AC = null, MASTER = null, SOUND = true, SPEED = 1;
const SE = {}, SE_FILES = { swing: 'se/01.wav', slashL: 'se/10.wav', slashH: 'se/02.wav', burst: 'se/14.wav', draw: 'se/12.wav' };   // 12 is the metallic ring of the guard, 10 the dull impact
try { if (localStorage.getItem('ghost-sprite-sound') === '0') SOUND = false; const s = localStorage.getItem('ghost-sprite-speed'); if (s && ['1', '0.5', '0.25'].includes(s)) SPEED = +s; } catch (e) {}
function initAudio(){
  if (AC){ if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  MASTER = AC.createGain(); MASTER.gain.value = 0.8; MASTER.connect(AC.destination);
  for (const [k, f] of Object.entries(SE_FILES)) fetch(f).then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)).then(buf => { SE[k] = buf; }).catch(() => {});
}
function play(k, vol, rate){
  if (!SOUND || !AC || !SE[k]) return;
  const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = SE[k]; s.playbackRate.value = (rate || 1) * (0.96 + Math.random() * 0.08) * Math.max(0.6, SPEED);
  g.gain.value = vol == null ? 1 : vol; s.connect(g); g.connect(MASTER); s.start();
}
function beep(){
  if (!SOUND || !AC) return;
  const t = AC.currentTime;
  for (const [f, d] of [[880, 0], [1320, 0.09]]){ const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12); o.connect(g); g.connect(MASTER); o.start(t + d); o.stop(t + d + 0.14); }
}

