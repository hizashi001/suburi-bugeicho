const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/fv_flick.js', 'utf8') }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-adv'); await p.click('#btn-run'); await p.click('#btn-cam');
  await p.waitForTimeout(3000);
  for (let i = 0; i < 12; i++) {
    await p.click('#btn-atk-now', { timeout: 1000, force: true }).catch(() => {});
    await p.waitForTimeout(150);
    const cue = (await p.textContent('#cue').catch(() => '')).trim();
    await p.waitForTimeout(3200);
    const log = (await p.textContent('#log')).replace(/\s+/g, ' ').slice(0, 70);
    console.log(i, 'cue:', cue, '| hp:', await p.textContent('#p-hp'), '| log:', log);
  }
  console.log('errors', errs);
  await b.close();
})();
