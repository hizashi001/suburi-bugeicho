function drawSlash(c, s){
  const k = s.t / s.dur, a0 = -1.2, span = 2.6 * Math.min(1, k * 2.2), fade = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1;
  for (let a = a0; a < a0 + span; a += 0.02){
    const p = (a - a0) / 2.6, th = Math.max(0, Math.sin(Math.PI * p) * 4 * fade);
    for (let r = s.r - th; r <= s.r; r += 1){
      const x = s.x + Math.cos(a + s.rot) * r * 1.2, y = s.y + Math.sin(a + s.rot) * r * 0.55;
      px(c, x, y, 1, 1, r > s.r - 1.5 ? '#ffffff' : '#a9c0ff');
    }
  }
}
