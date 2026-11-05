const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2], fv = process.argv[3];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/' + fv, 'utf8') }));
  await p.addInitScript(() => localStorage.setItem('suburi-bugeicho.v1', JSON.stringify({ ver: 3, diff: 0, customForms: [{ id: 'c_x', name_ja: '居合', name_en: 'Iai', dir: [1, 0, 0], amp: 1.09, peak: 4.5, kg: 0.6, wob: 0, dip: 0, from: [-0.548, -0.329, 0.411] }] })));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-adv'); await p.click('#btn-run'); await p.click('#btn-cam');
  await p.waitForTimeout(8000);
  console.log(fv, 'log:', (await p.textContent('#log')).replace(/\s+/g, ' ').slice(0, 120), 'errors', errs);
  await b.close();
})();
