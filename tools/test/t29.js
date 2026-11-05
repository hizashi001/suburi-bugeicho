const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', deviceScaleFactor: 2 });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text()));
  await p.route('https://cdn.jsdelivr.net/npm/@mediapipe/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/fv_body3d.js', 'utf8') }));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => { const f = path.join(SP, 'three/package', new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', '')); r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await p.goto('http://localhost:8765/ghost3d.html'); await p.waitForSelector('#btn-cam');
  await p.click('#btn-cam'); await p.waitForTimeout(2500);
  const shots = [];
  for (const [v, ms] of [['front', 300], ['front', 500], ['diag', 700], ['side', 700]]) {
    await p.click(`[data-v="${v}"]`); await p.waitForTimeout(ms);
    const f = `${SP}/g3d_${shots.length}.png`; await p.locator('#stage').screenshot({ path: f }); shots.push(f);
  }
  await p.click('[data-c="gold"]'); await p.click('[data-v="diag"]'); await p.waitForTimeout(600);
  const f = `${SP}/g3d_${shots.length}.png`; await p.locator('#stage').screenshot({ path: f }); shots.push(f);
  console.log(await p.textContent('#diag')); console.log('errors', errs); await b.close();
})();
