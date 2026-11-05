const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/fv_zig.js', 'utf8') }));
  await p.route('**/config/balance.json', r => { const j = JSON.parse(fs.readFileSync('config/balance.json', 'utf8')); j.enemy.goldChance = 1; j.barrage.afterCombo = 3; j.enemy.hpBase = 8000; r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-adv'); await p.click('#btn-run'); await p.click('#btn-cam');
  let last = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 14000) {
    await p.waitForTimeout(100);
    const pops = (await p.textContent('#pops')).replace(/\s+/g, ' ');
    const cue = (await p.textContent('#cue')).trim();
    const line = `pops: ${pops.slice(-60)} | cue: ${cue}`;
    if (line !== last) { console.log(((Date.now() - t0) / 1000).toFixed(1), line); last = line; }
  }
  console.log('hp', await p.textContent('#p-hp'), 'errors', errs);
  await b.close();
})();
