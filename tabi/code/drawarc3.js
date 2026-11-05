// the blade flash in front of the shadow: a sweeping crescent (h / up / down) or a thrust streak
function drawArc(c, a){
  const k = a.t / a.dur, fade = k > 0.5 ? 1 - (k - 0.5) / 0.5 : 1, cx = HXS + 34, cy = FEET - 70 + Math.round(a.lift);
  if (a.type === 'thrust'){
    const len = Math.round((REACH + 10) * Math.min(1, k * 3));
    for (let i = 0; i < len; i++){ const th = (1 - i / len) * 2 * fade; if (th <= 0.3) continue; px(c, cx + i, cy - 6, 1, Math.max(1, Math.round(th)), i > len - 6 ? '#ffffff' : '#bcd0ff'); }
    px(c, cx + len - 2, cy - 8, 3, 1, '#ffffff'); return;
  }
  const R = 64, span = 2.8, prog = Math.min(1, k * 2.4);
  let a0 = -2.2, dir = 1, sx = 1.15, sy = 0.45;
  if (a.type === 'up'){ a0 = 1.5; dir = -1; sx = 0.85; sy = 1.0; }
  if (a.type === 'down'){ a0 = -1.7; dir = 1; sx = 0.85; sy = 1.0; }
  for (let u = 0; u < span * prog; u += 0.018){
    const ang = a0 + dir * u, p = u / span, th = Math.sin(Math.PI * p) * 5 * fade;
    if (th < 0.4) continue;
    const x0 = cx + Math.cos(ang) * R * sx, y0 = cy + Math.sin(ang) * R * sy;
    if (x0 < HX - 6) continue;
    for (let r = 0; r < th; r++){ const x = cx + Math.cos(ang) * (R - r) * sx, y = cy + Math.sin(ang) * (R - r) * sy; px(c, x, y, 1, 1, r < 1.2 ? '#ffffff' : '#a9c0ff'); }
  }
}
