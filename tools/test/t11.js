const { chromium } = require('playwright');
const SP = process.argv[2], lang = process.argv[3] || 'ja-JP';
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: lang });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-adv'); await p.click('#btn-run');
  for (let k = 0; k < 60; k++) {
    await p.waitForTimeout(400);
    if (await p.isVisible('#btn-kill-now')) await p.click('#btn-kill-now').catch(() => {});
    if (await p.isVisible('#btn-demo')) await p.click('#btn-demo', { timeout: 500 }).catch(() => {});
    const nm = await p.textContent('#b-name');
    if (k % 6 === 0) console.log(k, nm, '|', await p.textContent('#b-hp'), '|', (await p.textContent('#run-chip')));
    if (k === 40) await p.screenshot({ path: `${SP}/run_mid_${lang}.png` });
  }
  await p.click('#btn-retreat'); await p.waitForTimeout(3500);
  await p.screenshot({ path: `${SP}/runres_${lang}.png`, fullPage: true });
  await p.evaluate(() => { const b = [...document.querySelectorAll('#result button')].pop(); b && b.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const t = document.getElementById('scr-title'); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  await p.click('#go-gear'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${SP}/gear_${lang}.png`, fullPage: true });
  const ds = await p.$$('.ds'); if (ds.length) { await ds[0].click(); await p.waitForTimeout(300); await p.screenshot({ path: `${SP}/gearslot_${lang}.png`, fullPage: true }); }
  console.log('errors:', errs);
  await b.close();
})();
