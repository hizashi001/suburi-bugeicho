const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', acceptDownloads: true });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { console.log('dialog:', d.message()); d.accept(); });
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/fv_zig.js', 'utf8') }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#t-wp:not(:empty)');
  // fight one yokai with the fake camera until it falls
  await p.click('#go-adv'); await p.click('#btn-run'); await p.click('#btn-cam');
  for (let i = 0; i < 40 && !(await p.textContent('#run-chip')).includes('討伐 1'); i++) await p.waitForTimeout(500);
  console.log('chip:', await p.textContent('#run-chip'));
  await p.waitForTimeout(1000);
  await p.goto('http://localhost:8765/ghost.html'); await p.waitForSelector('#list');
  await p.waitForTimeout(800);
  console.log('list:', (await p.textContent('#list')).replace(/\s+/g, ' ').slice(0, 200));
  await p.click('[data-play]'); await p.waitForTimeout(1500); await p.locator('.stage').screenshot({ path: SP + '/ghost_play.png' });
  // export (download fallback in this browser), then import it back
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-export]')]);
  const path = SP + '/' + dl.suggestedFilename(); await dl.saveAs(path);
  const g = JSON.parse(fs.readFileSync(path, 'utf8'));
  console.log('file:', dl.suggestedFilename(), Math.round(fs.statSync(path).size / 1024) + 'KB', 'frames', g.frames.length, 'events', g.events.length, 'yokai', g.yokai && g.yokai.id, 'result', JSON.stringify(g.result));
  await p.setInputFiles('#file', path); await p.waitForTimeout(800);
  console.log('after import:', await p.locator('#list .item').count(), 'items');
  // record a 10 s form ghost
  await p.fill('#rec-name', '試し'); await p.check('#rec-master'); await p.click('#btn-cam'); await p.waitForTimeout(1500);
  await p.click('#btn-rec'); await p.waitForTimeout(15000);
  console.log('after kata:', (await p.textContent('#list')).replace(/\s+/g, ' ').slice(0, 120));
  console.log('errors', errs); await b.close();
})();
