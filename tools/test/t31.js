const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SP = process.argv[2];
const lib = (dir, prefix) => (r) => { const f = path.join(dir, new URL(r.request().url()).pathname.replace(prefix, '')); r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f, 'utf8') }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  await p.route('https://cdn.jsdelivr.net/npm/@mediapipe/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/fv_arm.js', 'utf8') }));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.164.1/**', lib(path.join(SP, 'three/t164/package'), '/npm/three@0.164.1/'));
  await p.route('https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@2.1.2/**', lib(path.join(SP, 'libs/pixiv-three-vrm-2.1.2/package'), '/npm/@pixiv/three-vrm@2.1.2/'));
  await p.route('https://cdn.jsdelivr.net/npm/kalidokit@1.1.5/**', lib(path.join(SP, 'libs/kalidokit-1.1.5/package'), '/npm/kalidokit@1.1.5/'));
  await p.goto('http://localhost:8765/ghost3d.html'); await p.waitForSelector('#btn-cam');
  await p.click('#btn-cam'); await p.waitForTimeout(1500);
  await p.click('[data-b="vrm"]'); await p.waitForFunction(() => document.querySelector('[data-b="vrm"]').getAttribute('aria-pressed') === 'true', null, { timeout: 60000 });
  const show = async (label) => console.log(label, JSON.stringify(await p.evaluate(() => { const r = window.__rig; const f = (o) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(+v).toFixed(2)])); return r && { hips: f(r.Hips.rotation), spine: f(r.Spine), RUA: f(r.RightUpperArm), RLA: f(r.RightLowerArm), LUA: f(r.LeftUpperArm), RUL: f(r.RightUpperLeg) }; })));
  for (let i = 0; i < 3; i++) { await p.waitForTimeout(400); await show('swing'); }
  await p.evaluate(() => (globalThis.__armOut = true)); await p.waitForTimeout(800); await show('armOut');
  await b.close();
})();
