const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2], fv = process.argv[3], extra = process.argv[4] || '';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + e.stack));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/' + fv, 'utf8') }));
  if (extra.includes('gold')) await p.route('**/config/balance.json', r => { const j = JSON.parse(fs.readFileSync('config/balance.json', 'utf8')); j.enemy.goldChance = 1; j.barrage.afterCombo = 3; j.enemy.hpBase = 5000; r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
  await p.addInitScript((extra) => {
    const st = { ver: 3, diff: 0, techniques: extra.includes('tech') ? [{ id: 'my_t', name_ja: '雷落とし', name_en: 'Thunder', seq: ['shinmen', 'kiriage', 'shinmen'], mult: 1.5 }] : [],
      inv: extra.includes('olditem') ? [{ id: 1, slot: 'tsuba', grade: 2, affixes: [] }, { id: 2, slot: 'kote', grade: 1 }] : [], equip: extra.includes('olditem') ? { tsuba: 1 } : {} };
    if (!localStorage.getItem('suburi-bugeicho.v1')) localStorage.setItem('suburi-bugeicho.v1', JSON.stringify(st));
  }, extra);
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  if (extra.includes('olditem')) { await p.click('#go-gear'); await p.waitForTimeout(500); await p.screenshot({ path: SP + '/gear_old.png' }); console.log('gear errors', errs, 'errbox', await p.isVisible('#errbox')); await b.close(); return; }
  await p.click('#go-adv'); await p.click('#btn-run'); await p.click('#btn-cam');
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 16000) {
    await p.waitForTimeout(120);
    for (const sel of ['#tally', '#waza']) if (await p.isVisible(sel)) { const tx = (await p.textContent(sel)).replace(/\s+/g, ' '); if (!seen.has(tx)) { seen.add(tx); console.log(((Date.now() - t0) / 1000).toFixed(1), sel, tx); if (sel === '#waza' || sel === '#tally') await p.screenshot({ path: `${SP}/${sel.slice(1)}.png` }); } }
  }
  console.log('hp', await p.textContent('#b-hp'), '| log:', (await p.textContent('#log')).replace(/\s+/g, ' ').slice(0, 400));
  console.log('errors', errs);
  await b.close();
})();
