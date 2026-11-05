const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2], lang = process.argv[3] || 'ja-JP', zashiki = process.argv[4] === 'z';
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: lang });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + e.stack)); p.on('console', m => m.type() === 'error' && !/404|Failed to load/.test(m.text()) && errs.push(m.text()));
  if (zashiki) await p.route('**/config/balance.json', async r => { const j = JSON.parse(fs.readFileSync('config/balance.json', 'utf8')); j.climb.zashikiChance = 1; r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  console.log('tabata today:', await p.textContent('#t-tabtoday'));
  await p.click('#go-climb'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${SP}/climb_lobby_${lang}.png`, fullPage: true });
  console.log('lobby:', (await p.textContent('#scr-climb')).replace(/\s+/g, ' ').slice(0, 400));
  for (let round = 0; round < 2; round++) {
    await p.click('#btn-climb');
    for (let k = 0; k < 36; k++) {
      await p.waitForTimeout(400);
      if (await p.isVisible('#btn-kill-now')) await p.click('#btn-kill-now').catch(() => {});
      if (await p.isVisible('#btn-demo')) await p.click('#btn-demo', { timeout: 500 }).catch(() => {});
      if (k % 6 === 0) console.log(round, k, await p.textContent('#b-name'), '|', await p.textContent('#b-hp'), '|', await p.textContent('#run-chip'), '|', await p.textContent('#p-hp'));
      if (zashiki && k === 3) await p.screenshot({ path: `${SP}/zashiki.png` });
    }
    await p.click('#btn-retreat'); await p.waitForTimeout(3500);
    await p.screenshot({ path: `${SP}/climb_res_${round}_${lang}.png`, fullPage: true });
    await p.evaluate(() => { const b = [...document.querySelectorAll('#result button')].pop(); b && b.click(); });
    await p.waitForTimeout(400);
    console.log('lobby after:', (await p.textContent('#c-start')), '|', await p.textContent('#c-reached'), '|', await p.textContent('#c-gear'), '|', await p.textContent('#c-lv'));
  }
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('suburi-bugeicho.v1')));
  console.log('state climb:', JSON.stringify({ ...st.climb.bushi, inv: st.climb.bushi.inv.length }), 'main inv', st.inv.length, 'lv', st.lv, 'best', JSON.stringify(st.climbBest));
  console.log('errors:', errs);
  await b.close();
})();
