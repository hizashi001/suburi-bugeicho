// 一振りで START（アプリ版だけ）。build-www.mjs が本編の getReady() などに差し込む。
// ・振りの検出と判定には触らない。骨格の点と、検出できた一振り（onMeasure の m）を読むだけ
// ・数字は app/config/app.json の startSwing。mode を "count" にすると、前の「10秒数える」に戻る
// 流れ: camera（カメラ待ち）→ body（全身）→ stance（構え）→ raise（振りかぶり）→ swing（ふりおろし）→ done
export const START_DEFAULTS = {
  mode: "swing", stanceMs: 500, raiseMs: 250, swingWithinMs: 1500, amp: 0.5, downDir: 0.5,
  stillSpeed: 0.6, relaxAfter: 3, relaxAmp: 0.35, relaxChest: 0.25, lostMs: 1000, helpSec: 30, pressSec: 10, afterMs: 1000,
};

// 画面を知らない判断の部分（試験しやすいように分けてある）
export function createStartJudge(cfg, { stanceOnly = false } = {}) {
  const C = { ...START_DEFAULTS, ...cfg };
  const j = { step: "camera", fails: 0, relaxed: false, hint: "", raise: 0 };
  let since = 0, below = 0, seenAt = 0, prevT = 0, last = null;
  const go = (s) => { j.step = s; since = 0; below = 0; j.raise = 0; };
  const line = (p) => (j.relaxed ? p.shoulderY + C.relaxChest * p.T : p.eyeY); // ここより上げたら「振りかぶった」
  const low = (p) => Math.max(p.shoulderY, j.relaxed ? line(p) : -Infinity);   // ここより下なら「構え」「ふりおろし終わり」
  const fail = () => {
    j.fails++; j.hint = "bigger";
    if (!j.relaxed && j.fails >= C.relaxAfter) j.relaxed = true;
    go("stance"); return "retry";
  };
  // カメラが止まった・開いていない
  j.camera = (on) => {
    if (j.step === "done") return;
    if (!on && j.step !== "camera") { go("camera"); j.hint = ""; }
    else if (on && j.step === "camera") go("body");
  };
  j.lost = (t) => { if (!["camera", "body", "done"].includes(j.step) && t - seenAt > C.lostMs) go("body"); };
  // p: { t, shoulders, wrists, hips（見えているか）, lwY, rwY, handY, eyeY, shoulderY, T, speed }。画面の座標なので、下ほど大きい
  j.pose = (p) => {
    if (j.step === "done" || j.step === "camera") return null;
    const gap = p.t - prevT; prevT = p.t;
    if (gap > C.lostMs && j.step !== "body") go("body"); // アプリが裏に回っていた
    if (!p.shoulders || !p.wrists) { j.lost(p.t); if (j.step === "stance") since = 0; return null; }
    seenAt = p.t; last = p;
    if (j.step === "body") { if (p.hips) { go("stance"); return "body"; } return null; }
    if (j.step === "stance") {
      const ok = p.hips && Math.min(p.lwY, p.rwY) > low(p) && p.speed < C.stillSpeed;
      since = ok ? since || p.t : 0;
      if (since && p.t - since >= C.stanceMs) {
        if (stanceOnly) { go("done"); return "start"; }
        go("raise"); return "stance";
      }
    } else if (j.step === "raise") {
      since = p.handY < line(p) ? since || p.t : 0;
      j.raise = since ? Math.min(1, (p.t - since) / C.raiseMs) : 0;
      if (since && p.t - since >= C.raiseMs) { go("swing"); j.hint = ""; return "raise"; }
    } else if (j.step === "swing") {
      below = p.handY < line(p) ? 0 : below || p.t; // 上げている間は待つ。下げ始めてから数える
      if (below && p.t - below > C.swingWithinMs) return fail();
    }
    return null;
  };
  // m: 検出できた一振り、speedLine: 「入門」の速さの線（m/s）
  j.swing = (m, speedLine) => {
    if (!last || m.dir[1] < C.downDir) return null; // 下向きだけ
    if (j.step === "raise") return fail();          // 振りかぶりが足りない
    if (j.step !== "swing") return null;
    const amp = j.relaxed ? C.relaxAmp : C.amp;
    if (m.amp >= amp && m.peak >= speedLine && last.handY > low(last)) { go("done"); return "start"; }
    return fail();
  };
  j.press = () => { if (j.step === "camera" || j.step === "done") return false; go("done"); return true; };
  return j;
}

const CSS = `
#cue .ss{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:10px;padding:96px 16px 88px;text-align:center;background:rgba(5,8,15,.5);font-family:var(--f-display);color:var(--washi);text-shadow:0 2px 10px #000}
#cue .ss svg{width:120px;height:120px;overflow:visible}
#cue .ss .ss-body{fill:rgba(235,229,213,.35)}#cue .ss.seen .ss-body{fill:var(--moe)}
#cue .ss .ss-ring{fill:none;stroke:var(--kin);stroke-width:5;transform:rotate(-90deg);transform-origin:50% 50%}
#cue .ss b{font-size:clamp(1.7rem,9vw,3rem);line-height:1.15;font-weight:400}
#cue .ss .ss-sub{font-size:1.05rem;line-height:1.4;max-width:22em}
#cue .ss .ss-hint{color:var(--kin);font-size:1.4rem;line-height:1.2;min-height:1.2em}
#cue .ss button{pointer-events:auto;font-size:.95rem;min-height:44px}
#cue .ss-go{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;font-family:var(--f-display);font-size:clamp(3.4rem,20vw,7rem);color:var(--kin);text-shadow:0 0 22px rgba(214,171,76,.9),0 4px 10px #000}
#cue .ss-go i{position:absolute;inset:-10%;background:rgba(5,8,15,.75);animation:ssA .7s ease-in .12s forwards}
#cue .ss-go i.l{clip-path:polygon(0 0,62% 0,38% 100%,0 100%)}
#cue .ss-go i.r{clip-path:polygon(62% 0,100% 0,100% 100%,38% 100%);animation-name:ssB}
#cue .ss-go span{position:relative}
@keyframes ssA{to{transform:translate(-60%,8%);opacity:0}}@keyframes ssB{to{transform:translate(60%,-8%);opacity:0}}
`;

// 画面の部分。d: { $, t, esc, showCue, clearCue, play, setPhase, startCamera, camera(), resetDetector, speedLine(m) }
export async function createStartSwing(d) {
  let C = { ...START_DEFAULTS };
  try { C = { ...C, ...((await (await fetch("config/app.json")).json()).startSwing || {}) }; } catch { /* 読めなければ既定の数字 */ }
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  let j = null, then = null, tick = null, timers = [], since = 0, helped = false, shown = "";
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function end() { clearInterval(tick); tick = null; timers.forEach(clearTimeout); timers = []; j = null; then = null; shown = ""; }
  function finish() {
    const f = then, cur = j;
    d.resetDetector(); // この一振りの続きを、戦いの一振りに数えない
    d.showCue(`<div class="ss-go"><i class="l"></i><i class="r"></i><span>${d.esc(d.t("start.go"))}</span></div>`);
    d.play("crit_katana"); d.play("taiko");
    later(() => { if (j !== cur) return; end(); d.clearCue(); f(); }, C.afterMs);
  }
  function count() { // 「押して始める」: iPhone から離れる時間をとってから始める
    let n = C.pressSec;
    const cur = j;
    const draw = () => d.showCue(`<div class="full" style="background:rgba(5,8,15,.45)"></div><div class="label"><span class="ready-n num">${n}</span><br>${d.esc(d.t("ready.place"))}</div>`);
    const step = () => {
      if (j !== cur) return;
      if (d.camera() === "on" && !document.hidden) n--; // カメラが止まっている間・裏にいる間は減らさない
      if (n <= 0) return finish();
      draw(); if (n <= 3) d.play("beep");
      later(step, 1000);
    };
    draw(); d.play("beep"); later(step, 1000);
  }
  function on(ev) {
    if (!ev || !j) return;
    if (ev === "stance") d.play("taiko", { rate: 0.7, vol: 0.8 });
    else if (ev === "raise") d.play("draw");
    else if (ev === "retry") d.play("suzu");
    if (ev === "start") return finish();
    paint();
  }
  function paint() {
    if (!j || j.step === "done") return;
    const cam = d.camera(), key = j.step === "camera" ? (cam === "off" ? "camOff" : "cam") : j.step;
    const seen = !["cam", "camOff", "body"].includes(key), help = helped && !["cam", "camOff"].includes(key);
    const id = [key, j.hint, j.relaxed, help].join();
    if (id !== shown) {
      shown = id;
      d.showCue(`<div class="ss${seen ? " seen" : ""}" data-step="${key}">
        ${key === "camOff" ? "" : `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ss-body" cx="50" cy="26" r="12"/><path class="ss-body" d="M30 42h40l-5 24h-4l4 26H35l4-26h-4z"/><circle class="ss-ring" cx="50" cy="50" r="48" pathLength="1" stroke-dasharray="0 1"/></svg>`}
        <b>${d.esc(d.t("start." + key))}</b><div class="ss-sub">${d.esc(d.t("start." + key + ".sub"))}</div>
        <div class="ss-hint" role="status">${help ? d.esc(d.t("start.help")) : j.hint && seen ? d.esc(d.t("start." + j.hint)) : ""}</div>
        ${seen || key === "body" ? `<button type="button" id="ss-press">${d.esc(d.t("start.press"))}</button>` : ""}</div>`);
      const b = d.$("ss-press");
      if (b) b.onclick = () => { if (j && j.press()) count(); };
    }
    const ring = document.querySelector("#cue .ss-ring");
    if (ring) ring.setAttribute("stroke-dasharray", (j.step === "swing" ? 1 : j.raise) + " 1");
  }
  return {
    enabled: C.mode === "swing",
    begin(fn, opt) {
      end();
      then = fn; j = createStartJudge(C, opt); since = performance.now(); helped = false;
      d.setPhase("ready");
      if (d.camera() === "off") d.startCamera();
      j.camera(d.camera() === "on"); paint(); d.play("beep");
      tick = setInterval(() => {
        if (!j || j.step === "done") return;
        j.camera(d.camera() === "on");
        if (j.step === "camera") since = performance.now();
        if (!helped && performance.now() - since > C.helpSec * 1000) { helped = true; d.play("ring"); }
        paint();
      }, 250);
    },
    cancel() { end(); },
    pose(p) { if (j) { on(j.pose(p)); paint(); } },
    lost(t) { if (j) j.lost(t); },
    // 「試し振り」は、カメラが使えない時だけ START になる（本人がボタンを押した時だけ）
    swing(m) {
      if (!j || j.step === "done") return;
      if (m.demo) { if (d.camera() === "off") { j.step = "done"; finish(); } return; }
      on(j.swing(m, d.speedLine(m)));
    },
  };
}
