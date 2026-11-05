const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/fv_spin.js', 'utf8') }));
  await p.goto('http://localhost:8765/share.html'); await p.waitForSelector('#btn-cam');
  await p.click('#btn-cam'); await p.waitForTimeout(1500);
  const seen = {};
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); const m = (await p.textContent('#diag')).match(/mask: (\w+)/); if (m) seen[m[1]] = (seen[m[1]] || 0) + 1; }
  console.log('mask source over 6 s:', seen, 'errors', errs);
  await b.close();
})();
