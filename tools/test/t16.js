const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-adv'); await p.click('#btn-run'); await p.waitForTimeout(2500);
  await p.click('#btn-kill-now'); await p.click('#btn-demo');
  await p.waitForSelector('.slain');
  for (const ms of [250, 450, 900]) { await p.waitForTimeout(ms === 250 ? 250 : ms - 250); await p.locator('#verdict').screenshot({ path: `${SP}/slain_${ms}.png` }); }
  await p.click('#btn-atk-now').catch(() => {});
  console.log('errors', errs); await b.close();
})();
