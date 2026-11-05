// swordlab.html: record a few frames, label two of them by tapping, export the zip and check it
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SP = process.argv[2], OUT = process.argv[3] || SP;
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', acceptDownloads: true });
  await c.grantPermissions(['camera'], { origin: 'http://localhost:8765' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { console.log('dialog:', d.message()); d.accept(); });
  await p.route('https://cdn.jsdelivr.net/npm/@mediapipe/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(SP, 'fv_body3d.js'), 'utf8') }));
  await p.route('**/config/balance.json', r => { const j = JSON.parse(fs.readFileSync('config/balance.json', 'utf8')); j.ready.sec = 1; j.swordlab.seconds = [2]; r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
  await p.goto('http://localhost:8765/swordlab.html'); await p.waitForSelector('#btn-cam');
  await p.selectOption('[data-meta="weapon"]', 'bokuto'); await p.fill('[data-meta="person"]', 'テスト');
  await p.click('#btn-cam'); await p.waitForTimeout(1500);
  await p.click('#btn-rec'); await p.waitForSelector('#sec-label:not([hidden])', { timeout: 20000 });
  console.log('head:', await p.textContent('#lab-head'));
  const box = await p.locator('#lab-cv').boundingBox();
  const tap = async (fx, fy) => { await p.mouse.move(box.x + box.width * fx, box.y + box.height * fy); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(150); };
  // frame 1: tip, guard, hilt; frame 2: copy, then mark the tip as not visible
  await tap(0.3, 0.35); await tap(0.48, 0.5); await tap(0.52, 0.52);
  await p.locator('#lab-stage').screenshot({ path: path.join(OUT, 'lab_label.png') });
  await p.click('#btn-next'); await p.click('#btn-copy'); await p.click('[data-w="tip"]'); await p.click('#btn-hidden');
  console.log('head:', await p.textContent('#lab-head'));
  await p.click('#btn-close'); await p.waitForTimeout(400);
  console.log('totals:', await p.textContent('#totals'), '|', (await p.textContent('#sessions')).replace(/\s+/g, ' ').slice(0, 120));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-export')]);
  const zipPath = path.join(OUT, dl.suggestedFilename()); await dl.saveAs(zipPath);
  console.log('zip:', dl.suggestedFilename(), Math.round(fs.statSync(zipPath).size / 1024) + 'KB');
  console.log('errors', errs); await b.close();
})();
