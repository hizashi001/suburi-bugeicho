// GHOST のブラウザ版から、アプリに入れる物だけを選んで app/www/ に組み立てる。
//   node scripts/build-www.mjs
// ・元のファイル（index.html など）は書き換えない。www/ の写しだけを書き換える
// ・外から読み込む URL（MediaPipe・推定モデル・Google Fonts）を、同梱した vendor/ に差し替える
// ・試験用のページとボタン（3Dの影・刀の学習・影の試験場など）は入れない
// ・アプリだけの部品（振動・共有・画面を消さない・安全の注意・心付け）は js/native.js として差し込む
// ・最後に「外の URL が残っていないか」「参照しているファイルがそろっているか」を調べ、だめなら止まる
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(APP, "..");            // suburi-bugeicho（ブラウザ版）
const WWW = join(APP, "www");
const APPCFG = JSON.parse(await readFile(join(APP, "config", "app.json"), "utf8"));

// アプリに入れるページ（1.0 の中身: 本編・影の書庫・鬼面のシェア動画）
const PAGES = ["index.html", "ghost.html", "share.html"];
// 本編のメニューから外す試験用のボタン（id）
const DROP_TILES = ["go-ghost3d", "go-swordlab", "go-shadowlab"];
// 入れる画像の区分（manifest の section）。3D の試験モデル（assets/images/3d・assets/models）は入れない
const IMAGE_SECTIONS = ["yokai", "boss", "mask", "gear", "sword", "shadow"];
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const REWRITES = [
  [`${MP}/vision_bundle.mjs`, "./vendor/mediapipe/vision_bundle.js"],
  [`${MP}/wasm`, "vendor/mediapipe/wasm"],
  ["https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", "vendor/models/pose_landmarker_lite.task"],
];
const FONT_LINKS = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/;

const log = (...a) => console.log(...a);
const write = async (rel, data) => { const p = join(WWW, rel); await mkdir(dirname(p), { recursive: true }); await writeFile(p, data); };
const copy = async (rel, to = rel) => { await mkdir(dirname(join(WWW, to)), { recursive: true }); await cp(join(SRC, rel), join(WWW, to), { recursive: true }); };

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });

// 1) ページ: URL の差し替え、試験用ボタンを外す、native.js を一番先に読む
const jsNeeded = new Set();
for (const page of PAGES) {
  let html = await readFile(join(SRC, page), "utf8");
  for (const [from, to] of REWRITES) html = html.split(from).join(to);
  html = html.replace(FONT_LINKS, '<link rel="stylesheet" href="vendor/fonts/fonts.css">');
  for (const id of DROP_TILES) html = html.replace(new RegExp(`\\s*<button[^>]*id="${id}"[\\s\\S]*?</button>`), "");
  // 文字コードの宣言のすぐあとに、普通の <script> で差し込む（ページのモジュールより先に動き、振動・共有などを差し替える）
  html = html.replace(/(<meta charset="utf-8">)/i, '$1<script src="js/native.js"></script>');
  if (!html.includes('src="js/native.js"')) throw new Error(`${page}: native.js を差し込めませんでした`);
  for (const m of html.matchAll(/from\s+["']\.\/(js\/[\w.-]+\.js)["']/g)) jsNeeded.add(m[1]);
  await write(page, html);
}
// ページが読む js と、その js がさらに読む js
const queue = [...jsNeeded];
while (queue.length) {
  const f = queue.shift();
  const src = await readFile(join(SRC, f), "utf8");
  for (const m of src.matchAll(/from\s+["']\.\/([\w.-]+\.js)["']/g)) {
    const dep = `js/${m[1]}`;
    if (!jsNeeded.has(dep)) { jsNeeded.add(dep); queue.push(dep); }
  }
}
for (const f of jsNeeded) await copy(f);
log(`js: ${[...jsNeeded].join(", ")}`);

// 2) データ（小さい JSON はまとめて）
for (const d of ["config", "data"]) await copy(d);
await copy("assets/ghost_asset_manifest.json");
// 言語ファイル: アプリ用の言い換え（「ページを開き直す」→「アプリを開き直す」など）を上書きで重ねる
for (const f of await readdir(join(SRC, "lang"))) {
  const base = JSON.parse(await readFile(join(SRC, "lang", f), "utf8"));
  const ovPath = join(APP, "native", "lang", f);
  const ov = existsSync(ovPath) ? JSON.parse(await readFile(ovPath, "utf8")) : {};
  await write(`lang/${f}`, JSON.stringify({ ...base, ...ov }));
}

// 3) 画像: manifest にあって、ファイルが実在するものだけ
const manifest = JSON.parse(await readFile(join(SRC, "assets/ghost_asset_manifest.json"), "utf8"));
let nImg = 0;
for (const a of manifest.assets) {
  if (!IMAGE_SECTIONS.includes(a.section)) continue;
  const rel = `assets/images/${a.section}/${a.file}`;
  if (existsSync(join(SRC, rel))) { await copy(rel); nImg++; }
}
// 鬼面は data/masks.json の名前で直接読むので、区分 mask は丸ごと
await copy("assets/images/mask");
log(`images: ${nImg} 枚（manifest のうち実在するもの）＋ mask フォルダ`);

// 4) 音
await copy("assets/sounds");
if (existsSync(join(APP, "native", "sounds"))) await cp(join(APP, "native", "sounds"), join(WWW, "assets", "sounds"), { recursive: true });

// 5) 同梱した外部の物とアプリだけの部品
await cp(join(APP, "vendor"), join(WWW, "vendor"), { recursive: true });
await cp(join(APP, "native", "native.js"), join(WWW, "js", "native.js"));
if (existsSync(join(APP, "native", "img"))) await cp(join(APP, "native", "img"), join(WWW, "assets", "app"), { recursive: true });
await write("config/app.json", JSON.stringify(APPCFG, null, 2));

// 6) 調べる: 外の URL が残っていないか（実行コード・データを外から読まない＝審査 2.5.2・4.2）
const bad = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!p.includes(join("vendor", "mediapipe"))) await walk(p); continue; }
    if (!/\.(html|js|css)$/.test(e.name)) continue;
    const s = await readFile(p, "utf8");
    for (const m of s.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)|fetch\(\s*["'`](https?:\/\/[^"'`]+)|import\(\s*["'`](https?:\/\/[^"'`]+)|url\((https?:\/\/[^)]+)\)|modelAssetPath:\s*["'](https?:\/\/[^"']+)|forVisionTasks\(\s*["'](https?:\/\/[^"']+)/g)) {
      bad.push(`${relative(WWW, p)}: ${m.slice(1).find(Boolean)}`);
    }
  }
}
await walk(WWW);
if (bad.length) { console.error("外の URL が残っています:\n" + bad.join("\n")); process.exit(1); }
// 参照している同梱ファイルがあるか
for (const f of ["vendor/mediapipe/vision_bundle.js", "vendor/mediapipe/wasm/vision_wasm_internal.wasm", "vendor/models/pose_landmarker_lite.task", "vendor/fonts/fonts.css", "js/native.js"]) {
  if (!existsSync(join(WWW, f))) { console.error(`ありません: ${f}`); process.exit(1); }
}

// 7) 大きさ
async function size(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    n += e.isDirectory() ? await size(p) : (await stat(p)).size;
  }
  return n;
}
const MB = (n) => (n / 1048576).toFixed(1) + " MB";
for (const d of ["assets/images", "assets/sounds", "vendor"]) log(`${d.padEnd(14)} ${MB(await size(join(WWW, d)))}`);
log(`www 合計        ${MB(await size(WWW))}（心付け: ${APPCFG.tipEnabled ? "出す" : "隠す"}）`);
