// lying poses are drawn so their lowest pixel rests on the ground
const SNAP = new Set(['d11']);
function drawFrame(c, src, anim, i, x, y, alpha){
  const f = ATLAS[anim] && ATLAS[anim][i]; if (!f) return;
  const snap = SNAP.has(anim) && i > 0 ? -(f.oy + f.h) : 0;
  if (alpha != null) c.globalAlpha = alpha;
  c.drawImage(src, f.x, f.y, f.w, f.h, Math.round(x + f.ox), Math.round(y + f.oy + snap), f.w, f.h);
  c.globalAlpha = 1;
}
