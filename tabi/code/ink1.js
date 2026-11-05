
/* ---------- 墨の文字: move names and notices that burst out in ink ----------
   inkWord(text, x, y, size, o): the characters slam in one after another inside a violent splash of ink
   (blobs, streaks thrown outward, droplets that fly and fall), hold a moment, then break up and fade.
   x, y, size are game pixels (the name is drawn on the full-resolution canvas for crisp brush strokes).
   o.kind: 'basic' (small, a light splash) | 'skill' (a heavy splash) | 'notice' (centre of the screen, coloured characters).
   Big notices pushed to G.texts with big:true (退治, 関を越えた, 鳥居から出直し…) are drawn this way too. */
function makeInk(text, x, y, size, o){
  o = o || {};
  const kind = o.kind || 'skill', chars = [...text], n = chars.length;
  let seed = Math.floor(Math.random() * 1e6); const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const heavy = kind === 'skill' ? 1 : kind === 'notice' ? 0.8 : 0.45, w = size * n;
  const blobs = [], streaks = [], drops = [];
  for (let i = 0; i < Math.round(10 * heavy) + 3; i++) blobs.push({ x: (rand() - 0.5) * w * 1.05, y: (rand() - 0.5) * size * 0.7, r: size * (0.18 + rand() * 0.32) * (0.6 + heavy * 0.5), d: rand() * 0.05 });
  for (let i = 0; i < Math.round(16 * heavy) + 4; i++){ const a = rand() * 6.283, l0 = size * 0.3, l1 = size * (0.8 + rand() * 1.4) * (0.6 + heavy * 0.6); streaks.push({ a, l0, l1, w: size * (0.05 + rand() * 0.09), ox: (rand() - 0.5) * w * 0.8, d: rand() * 0.04 }); }
  for (let i = 0; i < Math.round(26 * heavy) + 6; i++){ const a = -0.2 - rand() * 2.8, v = size * (3 + rand() * 7); drops.push({ x: (rand() - 0.5) * w * 0.6, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: size * (0.03 + rand() * 0.07), d: rand() * 0.06 }); }
  return { chars, x, y, size, kind, color: o.color || (kind === 'notice' ? '#e6bb55' : '#f4ecd8'), dur: o.dur || (kind === 'basic' ? 0.6 : kind === 'skill' ? 1.0 : 1.5), t: 0,
    rot: chars.map(() => (rand() - 0.5) * 0.24), dy: chars.map(() => (rand() - 0.5) * size * 0.16), blobs, streaks, drops };
}
function inkWord(text, x, y, size, o){ const w = makeInk(text, x, y, size, o); G.words.push(w); return w; }
function stepWords(dt){ for (const w of G.words) w.t += dt; G.words = G.words.filter(w => w.t < w.dur); }
function drawInk(w, t, ox, oy){
  const c = vctx, S = w.size * K, cx = w.x * K + ox, cy = w.y * K + oy, n = w.chars.length;
  const end = w.dur, fadeAt = end * 0.68, fade = t > fadeAt ? Math.max(0, 1 - (t - fadeAt) / (end - fadeAt)) : 1;
  const ink = '#0b0809', rim = 'rgba(236,224,194,0.55)';
  c.save();
  // the splash: blobs swell in, streaks are thrown outward, droplets fly and fall
  for (const pass of [0, 1]){
    c.fillStyle = pass ? ink : rim; c.strokeStyle = pass ? ink : rim;
    for (const b of w.blobs){ const k = Math.min(1, Math.max(0, (t - b.d) / 0.05)); if (k <= 0) continue; c.globalAlpha = fade * (pass ? 0.92 : 0.5); c.beginPath(); c.arc(cx + b.x * K, cy + b.y * K, b.r * K * k + (pass ? 0 : K * 1.2), 0, 6.283); c.fill(); }
    for (const s of w.streaks){
      const k = Math.min(1, Math.max(0, (t - s.d) / 0.07)); if (k <= 0) continue;
      const x0 = cx + s.ox * K + Math.cos(s.a) * s.l0 * K, y0 = cy + Math.sin(s.a) * s.l0 * K * 0.6;
      const x1 = cx + s.ox * K + Math.cos(s.a) * (s.l0 + (s.l1 - s.l0) * k) * K, y1 = cy + Math.sin(s.a) * (s.l0 + (s.l1 - s.l0) * k) * K * 0.6;
      c.globalAlpha = fade * (pass ? 0.9 : 0.45); c.lineCap = 'round';
      c.lineWidth = s.w * K + (pass ? 0 : K * 1.2); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.beginPath(); c.arc(x1, y1, s.w * K * 0.9 + (pass ? 0 : K), 0, 6.283); c.fill();
    }
    for (const d of w.drops){
      const tt = Math.max(0, t - d.d); if (tt <= 0) continue;
      const x = cx + (d.x + d.vx * tt) * K, y = cy + (d.y + d.vy * tt + 0.5 * w.size * 18 * tt * tt) * K;
      c.globalAlpha = fade * (pass ? 0.95 : 0.4); c.beginPath(); c.arc(x, y, d.r * K + (pass ? 0 : K * 0.8), 0, 6.283); c.fill();
    }
  }
  // the characters slam down one after another, then swell a little and dissolve
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const x0 = cx - S * n / 2;
  for (let i = 0; i < n; i++){
    const ti = t - i * 0.035; if (ti < 0) break;
    const k = Math.min(1, ti / 0.06), sc = (2.2 - 1.2 * k) * (t > fadeAt ? 1 + (t - fadeAt) * 0.4 : 1);
    c.save(); c.translate(x0 + S * (i + 0.5), cy + w.dy[i] * K); c.rotate(w.rot[i]); c.scale(sc, sc);
    c.globalAlpha = Math.min(1, ti / 0.03) * fade;
    c.font = `${Math.round(S * 1.02)}px "Yuji Syuku", "Yu Mincho", "Hiragino Mincho ProN", serif`;
    c.lineJoin = 'round'; c.lineWidth = Math.max(2, S * 0.12); c.strokeStyle = ink; c.strokeText(w.chars[i], 0, S * 0.04);
    c.fillStyle = w.color; c.fillText(w.chars[i], 0, S * 0.04);
    c.restore();
  }
  c.restore();
}

/* ---------- thunder that comes down from above the screen ----------
   the lightning sheet ends in a hard edge at its top, so it is stretched until that edge sits above the screen */
function thunder(x, groundY, w, o){
  const m = FXATLAS.thunder; if (!m) return;
  const sy = Math.max(1, (groundY + 30) / (m.h * w));
  fx('thunder', x, groundY, Object.assign({ sc: w, sy, add: true }, o || {}));
}

/* ---------- the torii seal ----------
   passing a torii lights a glowing 封 on its tablet: the place the shadow will come back to if it falls.
   Sealed torii keep a faint glow while they are on screen. */
function checkTorii(){
  const k = Math.floor((G.x - 30) / TORII_GAP);
  if (k > G.toriiK){
    G.toriiK = k;
    if (!G.sealed.has(k)){ G.sealed.add(k); G.seals.push({ k, t: 0 }); play('draw', 0.45, 0.55); pickSound(0, 'gear');
      G.texts.push({ x: SX(k * TORII_GAP), y: FEET - 210, s: '出直しの鳥居', t: 0, dur: 1.4, c: '#c9a7ff', small: true }); }
  }
}
function stepSeals(dt){ for (const s of G.seals) s.t += dt; G.seals = G.seals.filter(s => s.t < 1.8); }
function drawSeals(ox, oy){
  if (!TORII.complete || !TORII.naturalWidth) return;
  const w = TORII.naturalWidth, h = TORII.naturalHeight, base = FEET - 7, c = vctx;
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const k of G.sealed){
    const sx = SX(k * TORII_GAP); if (sx < -w || sx > LW + w) continue;
    const px_ = (sx - w / 2 + 103) * K + ox, py_ = (base - h + 43) * K + oy;
    const anim = G.seals.find(s => s.k === k), at = anim ? anim.t : 9;
    const pulse = 0.55 + 0.25 * Math.sin(G.time * 3 + k), flare = at < 1.8 ? Math.max(0, 1 - at / 1.2) : 0;
    const size = 15 * K * (1 + flare * 1.6 * Math.max(0, 1 - at / 0.25));
    // glow
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(px_, py_, 0, px_, py_, size * (1.6 + flare * 2));
    g.addColorStop(0, `rgba(255,60,90,${0.55 * pulse + flare * 0.5})`); g.addColorStop(1, 'rgba(120,20,160,0)');
    c.fillStyle = g; c.fillRect(px_ - size * 4, py_ - size * 4, size * 8, size * 8);
    // a ghost of the character rising away
    if (at < 1.4){ c.globalAlpha = Math.max(0, 1 - at / 1.4); c.font = `${Math.round(size * (1.4 + at * 1.2))}px "Yuji Syuku", serif`; c.fillStyle = '#ff6a8a'; c.fillText('封', px_, py_ - at * 40 * K); }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.min(1, pulse + flare);
    c.font = `${Math.round(size)}px "Yuji Syuku", serif`;
    c.shadowColor = '#ff3a6a'; c.shadowBlur = size * 0.6; c.fillStyle = '#ffd0dc'; c.fillText('封', px_, py_);
    c.shadowBlur = 0;
    // sparks thrown from the tablet when it lights
    if (anim && at < 0.5 && Math.random() < 0.6) G.parts.push({ x: sx - w / 2 + 103 + rnd(-8, 8), y: base - h + 43 + rnd(-6, 6), vx: rnd(-60, 60), vy: rnd(-90, -20), g: 120, life: 0.6, t: 0, c: Math.random() < 0.5 ? '#ff6a8a' : '#c9a7ff', s: 2 });
  }
  c.restore(); c.globalAlpha = 1;
}
