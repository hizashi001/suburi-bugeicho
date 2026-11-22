// GHOST アプリ版だけの部品。ブラウザ版には入らない（app/scripts/build-www.mjs が各ページの先頭に差し込む）。
// ページのモジュールより先に動き、ブラウザの機能をアプリの部品に差し替える:
//   振動（navigator.vibrate → Haptics）、画面を消さない（navigator.wakeLock → KeepAwake）、
//   共有（navigator.share / canShare → Filesystem に書いて Share シート）
// 本編（index.html）では、最初の起動の「安全の注意」と、メニューの奥の「心付け」（アプリ内課金・消耗型）を足す。
// 心付けは config/app.json の tipEnabled を false にすると、ボタンも画面も出ない。
(function () {
  "use strict";
  var Cap = window.Capacitor;
  var NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  if (!NATIVE) return; // ブラウザで開いたときは何もしない
  var P = Cap.Plugins || {};

  // ---------- 言語（本編と同じ決め方: 保存した設定 → 端末の言語） ----------
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem("suburi-bugeicho.v1") || "{}"); } catch (e) {}
  var JA = saved.lang ? saved.lang === "ja" : (navigator.language || "").toLowerCase().indexOf("ja") === 0;
  var TXT = {
    ja: {
      safetyTitle: "はじめる前に",
      safety: [
        "<b>本物の刃物は絶対に使わない。</b>木刀・棒・箒・タオルなどで振ります（何も持たなくても遊べます）。",
        "前後左右に「腕＋得物」より広い空間を空け、<b>人・ペット・家具・照明・窓</b>から離れて振ってください。",
        "iPhone は倒れない所に縦に立て、2〜3m 離れます。床が滑らないか確かめてください。",
        "痛み・息苦しさ・めまいを感じたら、すぐにやめて休んでください。子どもは大人と一緒に遊んでください。",
        "カメラの映像は iPhone の中だけで使い、外へ送りません（シェア動画は、あなたが共有を選んだときだけ）。"
      ],
      safetyOk: "わかった・はじめる",
      tipTile: "師範に心付け",
      tipTileDesc: "お礼のチップ",
      tipTitle: "師範に心付け",
      tipLead: "GHOST を楽しんでもらえたら、師範にお茶を一服ごちそうしてください。<b>これはお礼（チップ）です。遊びの機能や強さは何も増えません。</b>",
      tiers: { ippuku: ["一服", "師範の声「かたじけない」"], chagashi: ["茶と菓子", "声＋茶碗の印"], chakai: ["茶会", "声＋金の茶碗の印"] },
      total: "これまでに出したお茶: {n} 杯",
      marks: "茶碗の印",
      noMarks: "まだありません",
      deviceNote: "茶碗の印とお茶の数は、この iPhone の中にだけ残ります。アプリを消すと消えます（アカウントがないため）。",
      thanks: "かたじけない。",
      buying: "手続き中…",
      failed: "購入できませんでした（{err}）。時間をおいて、もう一度お試しください。",
      unavailable: "いまは心付けを受け付けられません。",
      close: "閉じる"
    },
    en: {
      safetyTitle: "Before you start",
      safety: [
        "<b>Never use a real blade.</b> Swing a bokuto, a stick, a broom or a towel (you can also play empty-handed).",
        "Keep more than arm-plus-weapon length clear in every direction, away from <b>people, pets, furniture, lights and windows</b>.",
        "Stand the iPhone upright where it cannot fall, and step 2–3 m back. Make sure the floor is not slippery.",
        "If you feel pain, shortness of breath or dizziness, stop and rest. Children should play with an adult.",
        "Camera video is used only on this iPhone and never sent anywhere (a share video leaves only when you choose to share it)."
      ],
      safetyOk: "Got it — let's start",
      tipTile: "Tip the master",
      tipTileDesc: "A thank-you tip",
      tipTitle: "Tip the master",
      tipLead: "If you enjoy GHOST, treat the master to a bowl of tea. <b>This is a thank-you tip. It does not unlock or strengthen anything in the game.</b>",
      tiers: { ippuku: ["A bowl of tea", "The master's voice: “Katajikenai”"], chagashi: ["Tea and sweets", "Voice + tea-bowl mark"], chakai: ["Tea ceremony", "Voice + golden tea-bowl mark"] },
      total: "Bowls of tea so far: {n}",
      marks: "Tea-bowl marks",
      noMarks: "None yet",
      deviceNote: "Your marks and tea count stay only on this iPhone and are lost if you delete the app (there are no accounts).",
      thanks: "Katajikenai — thank you.",
      buying: "Processing…",
      failed: "The purchase did not go through ({err}). Please try again later.",
      unavailable: "Tips are not available right now.",
      close: "Close"
    }
  };
  var T = JA ? TXT.ja : TXT.en;
  var fill = function (s, v) { return s.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; }); };

  // ---------- 振動: navigator.vibrate → Haptics（iPhone のブラウザには振動がない） ----------
  function vibrate(p) {
    if (!P.Haptics) return false;
    var ms = Array.isArray(p) ? p.reduce(function (a, b, i) { return i % 2 ? a : a + b; }, 0) : Number(p) || 0;
    if (ms <= 0) return true;
    P.Haptics.impact({ style: ms >= 120 ? "HEAVY" : ms >= 40 ? "MEDIUM" : "LIGHT" }).catch(function () {});
    return true;
  }
  try { Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true }); } catch (e) {}

  // ---------- 画面を消さない: アプリを開いている間はずっと（離れて振るゲームなので） ----------
  function keepAwake() { if (P.KeepAwake) P.KeepAwake.keepAwake().catch(function () {}); }
  keepAwake();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) keepAwake(); });
  var sentinel = function () {
    return { released: false, type: "screen", onrelease: null,
      release: function () { this.released = true; return Promise.resolve(); },
      addEventListener: function () {}, removeEventListener: function () {} };
  };
  try { Object.defineProperty(navigator, "wakeLock", { value: { request: function () { keepAwake(); return Promise.resolve(sentinel()); } }, configurable: true }); } catch (e) {}

  // ---------- 共有: ファイルを一時フォルダに書いて、iPhone の共有シートを出す ----------
  function toBase64(blob) {
    return new Promise(function (ok, ng) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { ng(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function abortError() { try { return new DOMException("Share canceled", "AbortError"); } catch (e) { var x = new Error("Share canceled"); x.name = "AbortError"; return x; } }
  function canShare(data) {
    if (!P.Share) return false;
    if (!data) return true;
    if (data.files) return Array.prototype.every.call(data.files, function (f) { return f instanceof Blob; });
    return !!(data.url || data.text || data.title);
  }
  async function share(data) {
    data = data || {};
    var files = [];
    if (data.files && data.files.length) {
      if (!P.Filesystem) throw new Error("Filesystem plugin missing");
      for (var i = 0; i < data.files.length; i++) {
        var f = data.files[i];
        var name = (f.name || ("ghost_" + Date.now() + "_" + i)).replace(/[^\w.\-]/g, "_");
        var res = await P.Filesystem.writeFile({ path: "share/" + name, data: await toBase64(f), directory: "CACHE", recursive: true });
        files.push(res.uri);
      }
    }
    try {
      await P.Share.share({ title: data.title, text: data.text, url: data.url, files: files.length ? files : undefined, dialogTitle: data.title });
    } catch (e) {
      if (/cancel/i.test(String((e && e.message) || e))) throw abortError();
      throw e;
    }
  }
  try {
    Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true });
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
  } catch (e) {}

  // ここから先は本編（index.html）だけ
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (page !== "index.html") return;

  var CFG = null;
  var cfgReady = fetch("config/app.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (c) { CFG = c; return c; });

  // ---------- 見た目（本編の色に合わせる） ----------
  var css = "" +
    ".gx-ov{position:fixed;inset:0;z-index:9999;background:rgba(8,12,24,.86);display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom))}" +
    ".gx-box{width:100%;max-width:420px;max-height:100%;overflow:auto;background:var(--ai-2,#1b2945);color:var(--washi,#ebe5d5);border:1px solid rgba(235,229,213,.18);border-radius:14px;padding:18px 16px;font-family:'Zen Kaku Gothic New',system-ui,sans-serif;line-height:1.6;font-size:15px}" +
    ".gx-box h2{margin:0 0 10px;font-family:'Shippori Mincho B1',serif;font-size:22px;color:var(--kin,#d6ab4c)}" +
    ".gx-box ul{margin:0 0 14px;padding-left:1.2em}.gx-box li{margin:6px 0}" +
    ".gx-btn{display:block;width:100%;margin:8px 0 0;padding:12px 14px;border-radius:10px;border:1px solid rgba(235,229,213,.2);background:var(--ai-3,#24365a);color:inherit;font:inherit;text-align:left;cursor:pointer}" +
    ".gx-btn.kin{background:var(--kin,#d6ab4c);color:#131d33;font-weight:700;text-align:center}" +
    ".gx-btn b{font-size:17px}.gx-btn .gx-p{float:right;font-weight:700;color:var(--kin,#d6ab4c)}.gx-btn small{display:block;opacity:.8}" +
    ".gx-btn[disabled]{opacity:.5}" +
    ".gx-note{font-size:12.5px;opacity:.75;margin-top:12px}" +
    ".gx-marks{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px;font-size:22px}.gx-gold{filter:sepia(1) saturate(4) hue-rotate(5deg) brightness(1.15)}" +
    ".gx-msg{min-height:1.4em;margin-top:10px;color:var(--kin,#d6ab4c);font-weight:700}";
  function addStyle() { var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }

  function overlay(html) {
    var ov = document.createElement("div");
    ov.className = "gx-ov";
    ov.innerHTML = '<div class="gx-box" role="dialog" aria-modal="true">' + html + "</div>";
    document.body.appendChild(ov);
    return ov;
  }

  // ---------- 最初の起動の安全の注意（審査 1.4.5） ----------
  var SAFETY_KEY = "ghost-app.safety.v1";
  function showSafety() {
    var ov = overlay("<h2>" + T.safetyTitle + "</h2><ul>" + T.safety.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ul>" +
      '<button class="gx-btn kin" type="button">' + T.safetyOk + "</button>");
    ov.querySelector("button").addEventListener("click", function () {
      try { localStorage.setItem(SAFETY_KEY, String(Date.now())); } catch (e) {}
      ov.remove();
    });
  }

  // ---------- 心付け（消耗型のアプリ内課金。端末の中にだけ記録） ----------
  var TIP_KEY = "ghost-app.tip.v1";
  function tipState() { try { return JSON.parse(localStorage.getItem(TIP_KEY) || "{}"); } catch (e) { return {}; } }
  function saveTip(s) { try { localStorage.setItem(TIP_KEY, JSON.stringify(s)); } catch (e) {} }
  var products = null; // id → 価格の文字
  async function loadProducts() {
    if (products || !P.NativePurchases) return products || {};
    try {
      var ids = CFG.tipProducts.map(function (p) { return p.id; });
      var res = await P.NativePurchases.getProducts({ productIdentifiers: ids, productType: "inapp" });
      products = {};
      (res.products || []).forEach(function (p) { products[p.identifier] = p.priceString; });
    } catch (e) { products = {}; }
    return products;
  }
  function playThanks() {
    if (!CFG.thanksVoice) return;
    try { var a = new Audio(CFG.thanksVoice); a.play().catch(function () {}); } catch (e) {}
  }
  function marksHtml(s) {
    var n = s.bowls || 0, g = s.goldBowls || 0, out = "";
    for (var i = 0; i < g; i++) out += '<span class="gx-gold" title="金の茶碗">🍵</span>';
    for (var j = 0; j < n; j++) out += "<span>🍵</span>";
    return out || '<span style="font-size:14px;opacity:.7">' + T.noMarks + "</span>";
  }
  async function openTip() {
    var s = tipState();
    var ov = overlay("<h2>" + T.tipTitle + "</h2><p>" + T.tipLead + "</p>" +
      CFG.tipProducts.map(function (p) {
        var t = T.tiers[p.tier] || [p.tier, ""];
        return '<button class="gx-btn" type="button" data-id="' + p.id + '" data-tier="' + p.tier + '"><span class="gx-p">' + p.fallbackPrice + "</span><b>" + t[0] + "</b><small>" + t[1] + "</small></button>";
      }).join("") +
      '<div class="gx-msg" aria-live="polite"></div>' +
      '<p style="margin:12px 0 0">' + fill(T.total, { n: s.total || 0 }) + "</p>" +
      '<div style="font-size:13px;opacity:.85">' + T.marks + '</div><div class="gx-marks">' + marksHtml(s) + "</div>" +
      '<p class="gx-note">' + T.deviceNote + "</p>" +
      '<button class="gx-btn kin" type="button" data-close>' + T.close + "</button>");
    var msg = ov.querySelector(".gx-msg");
    ov.querySelector("[data-close]").addEventListener("click", function () { ov.remove(); });
    var btns = ov.querySelectorAll("[data-id]");
    loadProducts().then(function (pr) {
      btns.forEach(function (b) { if (pr[b.dataset.id]) b.querySelector(".gx-p").textContent = pr[b.dataset.id]; });
    });
    btns.forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!P.NativePurchases) { msg.textContent = T.unavailable; return; }
        btns.forEach(function (x) { x.disabled = true; });
        msg.textContent = T.buying;
        try {
          await P.NativePurchases.purchaseProduct({ productIdentifier: b.dataset.id, productType: "inapp", quantity: 1 });
          var st = tipState();
          st.total = (st.total || 0) + 1;
          st[b.dataset.tier] = (st[b.dataset.tier] || 0) + 1;
          if (b.dataset.tier === "chagashi") st.bowls = (st.bowls || 0) + 1;
          if (b.dataset.tier === "chakai") st.goldBowls = (st.goldBowls || 0) + 1;
          st.last = Date.now();
          saveTip(st);
          playThanks();
          msg.textContent = T.thanks;
          ov.querySelector(".gx-marks").innerHTML = marksHtml(st);
          ov.querySelector("p[style]").textContent = fill(T.total, { n: st.total });
          if (navigator.vibrate) navigator.vibrate(60);
        } catch (e) {
          var m = String((e && (e.message || e.code)) || e);
          msg.textContent = /cancel/i.test(m) ? "" : fill(T.failed, { err: m.slice(0, 80) });
        }
        btns.forEach(function (x) { x.disabled = false; });
      });
    });
  }
  function addTipTile() {
    var setup = document.getElementById("go-setup");
    if (!setup || document.getElementById("go-tip")) return;
    var b = document.createElement("button");
    b.className = "tile-btn"; b.id = "go-tip"; b.type = "button";
    b.innerHTML = "<b>" + T.tipTile + "</b><span>" + T.tipTileDesc + "</span>";
    b.addEventListener("click", openTip);
    setup.parentNode.appendChild(b); // メニューの一番奥に置く（遊びの途中では勧めない）
  }

  function start() {
    addStyle();
    cfgReady.then(function (c) {
      var seen = null;
      try { seen = localStorage.getItem(SAFETY_KEY); } catch (e) {}
      if (c.safetyNotice !== false && !seen) showSafety();
      if (c.tipEnabled && Array.isArray(c.tipProducts) && c.tipProducts.length) addTipTile();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
