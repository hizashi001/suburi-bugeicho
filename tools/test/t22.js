const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:8765/index.html');
  const files = process.argv.slice(2);
  const out = await p.evaluate(async (files) => {
    const ac = new OfflineAudioContext(1, 44100, 44100), res = [];
    for (const f of files) {
      try {
        const buf = await ac.decodeAudioData(await (await fetch('assets/sounds/' + f)).arrayBuffer());
        const d = buf.getChannelData(0); let i = 0, pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v));
        while (i < d.length && Math.abs(d[i]) < pk * 0.05) i++;
        res.push(`${f}: ${buf.duration.toFixed(2)}s, lead silence ${(i / buf.sampleRate * 1000).toFixed(0)}ms, peak ${pk.toFixed(2)}`);
      } catch (e) { res.push(`${f}: DECODE FAIL ${e}`); }
    }
    return res;
  }, files);
  console.log(out.join('\n')); await b.close();
})();
