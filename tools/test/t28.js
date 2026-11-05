const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/ghost.html'); await p.waitForSelector('#list');
  // a person in chudan kamae who cuts 真っ向 every 1.6 s (camera picture coordinates, portrait 9:16)
  await p.evaluate(async () => {
    const { ghostStore, POINTS } = await import('./js/ghost.js');
    const make = (master) => {
      const frames = [];
      for (let t = 0; t <= 6000; t += 66) {
        const c = (t % 1600) / 1600; // 0–0.35 raise, 0.35–0.5 cut, then hold and settle
        const up = c < 0.35 ? c / 0.35 : c < 0.5 ? 1 - (c - 0.35) / 0.15 : 0;
        const wy = 0.47 - up * 0.27, wx = 0.5, ey = 0.43 - up * 0.17;
        const pts = { 0: [0.5, 0.235], 11: [0.565, 0.31], 12: [0.435, 0.31], 13: [0.585, ey], 14: [0.415, ey], 15: [wx + 0.012, wy], 16: [wx - 0.012, wy + 0.01],
          23: [0.545, 0.53], 24: [0.455, 0.53], 25: [0.58, 0.68], 26: [0.42, 0.68], 27: [0.6, 0.83], 28: [0.39, 0.83] };
        frames.push([t, ...POINTS.flatMap((i) => pts[i])]);
      }
      return { format: 'ghost/1', id: master ? 'g_test_master' : 'g_test_blue', name: master ? '師範の影（試し）' : '影（試し）', kind: 'kata', master, created: new Date().toISOString(),
        fps: 15, aspect: 0.5625, points: POINTS, frames, events: [], durationMs: 6000 };
    };
    await ghostStore.save(make(false)); await ghostStore.save(make(true));
  });
  await p.reload(); await p.waitForTimeout(600);
  const shots = [];
  for (const id of ['g_test_blue', 'g_test_master']) {
    await p.click(`[data-play="${id}"]`);
    for (const ms of [700, 520]) { await p.waitForTimeout(ms); const f = `${SP}/aura_${id}_${ms}.png`; await p.locator('.stage').screenshot({ path: f }); shots.push(f); }
  }
  console.log(shots.join('\n'), '\nerrors', errs); await b.close();
})();
