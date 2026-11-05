/* ---------- move samples ---------- */
const SAMP = [];
function buildSamples(){
  const box = $('moves'); box.textContent = '';
  for (const [a, name, route, note] of SAMPLES){
    if (!ATLAS[a]) continue;
    const d = document.createElement('div'); d.className = 'mv'; if (WARN.has(a)) d.dataset.warn = '1';
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 160; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', name + 'の見本');
    const t = document.createElement('div'); t.className = 't'; t.textContent = name;
    const r = document.createElement('div'); r.className = 'r'; r.textContent = route + '（' + ATLAS[a].length + 'コマ）';
    d.append(cv, t, r);
    if (note){ const n = document.createElement('div'); n.className = 'n'; n.textContent = note; d.append(n); }
    box.append(d);
    SAMP.push({ a, cv, ctx: cv.getContext('2d'), i: 0, t: 0 });
  }
}
function drawSamples(dt){
  for (const s of SAMP){
    const n = ATLAS[s.a].length, hold = s.i === n - 1 ? 0.45 : (s.i === 0 ? 0.25 : 0.13);
    s.t += dt; if (s.t >= hold){ s.t = 0; s.i = (s.i + 1) % n; } else if (s.drawn) continue;
    const c = s.ctx; c.imageSmoothingEnabled = false; c.fillStyle = '#141a46'; c.fillRect(0, 0, 200, 160);
    c.fillStyle = '#231d44'; c.fillRect(0, 148, 200, 12);
    drawFrame(c, hero, s.a, s.i, 74, 148); s.drawn = true;
  }
}

