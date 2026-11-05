const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2], mode = process.argv[3] || 'run', lang = process.argv[4] || 'ja-JP';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: lang });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/404|Failed to load/.test(m.text()) && errs.push(m.text()));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/' + (process.argv[5] || 'fakevision.js'), 'utf8') }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.screenshot({ path: `${SP}/title_${mode}.png`, fullPage: true });
  if (mode === 'run') { await p.click('#go-adv'); await p.screenshot({ path: `${SP}/map.png`, fullPage: true }); await p.click('#btn-run'); }
  else await p.click('#go-tabata');
  await p.click('#btn-cam');
  const n = mode === 'run' ? 10 : 22;
  for (let i = 0; i < n; i++) {
    await p.waitForTimeout(2000);
    const vis = async (s) => (await p.isVisible(s)) ? (await p.textContent(s)).replace(/\s+/g, ' ').slice(0, 60) : '-';
    console.log(i, '| name:', await vis('#b-name'), '| hp:', await vis('#b-hp'), '| p:', await vis('#p-hp'), '| t:', await vis('#b-timer'), '| note:', await vis('#note-chip'), '| diag:', await vis('#diag'));
    if (i === 4) await p.screenshot({ path: `${SP}/battle_${mode}.png` });
  }
  await p.screenshot({ path: `${SP}/end_${mode}.png` });
  console.log('errors:', errs);
  await b.close();
})();
