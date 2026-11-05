const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + e.stack));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/fv_side.js', 'utf8') }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-forms'); await p.fill('#form-name', '居合'); await p.click('#form-add');
  await p.click('#btn-cam');
  for (let i = 0; i < 10 && !(await p.isVisible('#result')); i++) { await p.waitForTimeout(1500); console.log('reg', await p.textContent('#reg-hint'), '|', (await p.textContent('#pops')).slice(-30)); }
  console.log('result:', (await p.textContent('#res-inner')).replace(/\s+/g, ' ').slice(0, 120));
  await p.evaluate(() => { const b = [...document.querySelectorAll('#result button')].pop(); b && b.click(); });
  await p.waitForTimeout(500);
  console.log('forms list has:', (await p.textContent('#forms')).includes('居合'), '| tech pick has:', (await p.textContent('#tech-pick')).includes('居合'));
  await p.click('#scr-forms [data-back="title"]'); await p.click('#go-adv'); await p.click('#btn-run'); await p.click('#btn-cam');
  await p.waitForTimeout(9000);
  console.log('log:', (await p.textContent('#log')).replace(/\s+/g, ' ').slice(0, 200));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('suburi-bugeicho.v1')).customForms);
  console.log('saved form:', JSON.stringify(st));
  console.log('errors', errs);
  await b.close();
})();
