const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-adv'); await p.click('#btn-run'); await p.waitForTimeout(700);
  await p.waitForTimeout(300); await p.screenshot({ path: process.argv[2] + '/enc_art.png' });
  await p.waitForTimeout(1500); await p.click('#btn-kill-now'); await p.click('#btn-demo'); await p.waitForTimeout(500);
  await p.screenshot({ path: process.argv[2] + '/slain_art.png' });
  console.log('errors', errs); await b.close();
})();
