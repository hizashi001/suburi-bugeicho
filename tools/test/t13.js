const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + e.stack)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  // climb a bit then visit gear, also from a fresh state
  await p.click('#go-gear'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${SP}/gear_fresh.png` });
  console.log('fresh errors', errs);
  await p.click('[data-back="title"]:visible');
  await p.click('#go-climb'); await p.click('#btn-climb');
  for (let k = 0; k < 14; k++) { await p.waitForTimeout(400); if (await p.isVisible('#btn-kill-now')) await p.click('#btn-kill-now').catch(() => {}); if (await p.isVisible('#btn-demo')) await p.click('#btn-demo', { timeout: 500 }).catch(() => {}); }
  await p.click('#btn-retreat'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#result button')].pop(); b && b.click(); });
  await p.waitForTimeout(300);
  await p.click('#scr-climb [data-back="title"]'); await p.click('#go-gear'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${SP}/gear_after.png` });
  console.log('errors', errs);
  await b.close();
})();
