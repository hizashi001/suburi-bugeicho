// 外から読み込んでいる物（MediaPipe・推定モデル・フォント）を app/vendor/ に取り込む。
// 一度だけ実行して、vendor/ はリポジトリに入れる（Codemagic では実行しない＝組み立てのたびに外へ取りに行かない）。
//   node scripts/fetch-vendor.mjs
// 版を上げるときは下の定数を変えて実行し直す。index.html などの URL も build-www.mjs の REWRITES に合わせる。
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = join(ROOT, "vendor");
const MP = "0.10.14";
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FONTS = "https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@700;800&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap";
// woff2 を返してもらうため、今の Safari のふりをする
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

async function get(url, binary = true) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
}
async function save(rel, data) {
  const p = join(V, rel);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
  console.log(`${(data.length / 1024).toFixed(0).padStart(7)} KB  ${rel}`);
}

// 1) MediaPipe Tasks Vision。.mjs は iOS で JavaScript と判定されない恐れがあるので .js で置く
await save("mediapipe/vision_bundle.js", await get(`${MP_BASE}/vision_bundle.mjs`));
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  await save(`mediapipe/wasm/${f}`, await get(`${MP_BASE}/wasm/${f}`));
}
await save("mediapipe/LICENSE.txt", await get(`${MP_BASE}/LICENSE`).catch(() => Buffer.from("Apache License 2.0 — https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE\n")));

// 2) 骨格推定のモデル
await save("models/pose_landmarker_lite.task", await get(MODEL));

// 3) フォント（Google Fonts の CSS と、文字の範囲ごとに分かれた woff2 をすべて）
let css = await get(FONTS, false);
const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
let n = 0;
for (const u of urls) {
  const name = u.replace(/^https:\/\/fonts\.gstatic\.com\/s\//, "").replace(/\//g, "_");
  await save(`fonts/files/${name}`, await get(u));
  css = css.split(u).join(`files/${name}`);
  n++;
}
await save("fonts/fonts.css", Buffer.from(css));
await save("fonts/LICENSE.txt", Buffer.from(
  "Shippori Mincho B1 (FONTDASU) / Zen Kaku Gothic New (Yoshimichi Ohira) — SIL Open Font License 1.1\nhttps://openfontlicense.org/\n"));
console.log(`fonts: ${n} files`);
