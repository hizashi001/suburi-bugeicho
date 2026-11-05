const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.mouse.click(5, 5); await p.waitForTimeout(1500);
  const t0 = Date.now();
  await p.click('#go-tabata');
  let last = '';
  while (Date.now() - t0 < 42000) {
    await p.waitForTimeout(100);
    const s = `${await p.textContent('#b-name')} ${await p.textContent('#b-timer')}`;
    if (s.split(' ')[0] !== last) { console.log(((Date.now() - t0) / 1000).toFixed(2), s); last = s.split(' ')[0]; }
  }
  console.log('errors', errs); await b.close();
})();
