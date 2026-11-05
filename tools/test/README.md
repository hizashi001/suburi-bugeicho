# 試験の台本（偽のカメラで動かす）

ブラウザ（Playwright の Chromium）でアプリを開き、偽のカメラ映像と「偽の骨格推定」で動かして確かめる台本。iPhoneの実機の代わりにはならない（判定の細かさ・重さ・Safari特有の不具合は実機で確かめる）。

## 動かし方

```
cd リポジトリの一番上
python3 -m http.server 8765 &          # アプリを配る
node tools/test/t10.js tools/test run   # 例：妖怪退治を偽のカメラで2秒ごとに振って20秒
```

- 1つ目の引数は、偽の骨格推定のファイル（`fv_*.js`）がある場所。ここでは `tools/test`
- 台本は `https://cdn.jsdelivr.net/npm/@mediapipe/**` の読み込みを `fv_*.js` に差し替える
- 3Dの台本（t29〜t31）は three.js・three-vrm・Kalidokit も差し替える。先に取り寄せておく：
  ```
  cd tools/test && mkdir -p three/t164 libs && (cd three && npm pack three@0.164.1 && tar xzf three-0.164.1.tgz -C t164)
  (cd libs && npm pack @pixiv/three-vrm@2.1.2 kalidokit@1.1.5 && for f in *.tgz; do mkdir -p ${f%.tgz} && tar xzf $f -C ${f%.tgz}; done)
  ```
  （t29 は three@0.160.0 を `three/package` に置く前提の古い版）
- 試験のあとは `pkill -f "http.server 876[5]"` で止める（`[5]` の書き方は、pkill が自分のコマンドを止めないため）

## 偽の骨格推定（fv_*.js）

| ファイル | 動き |
| --- | --- |
| `fakevision.js` | 2秒ごとに真っ向（基本） |
| `fv_zig.js` | 止まらずに真っ向と切り上げを往復（一筆書きのコンボ） |
| `fv_slow.js` | ゆっくり小さな振り（入門の緩さの確認） |
| `fv_side.js` / `fv_side_hi.js` | 横向きの一振り（腰の高さ／肩の高さ。居合と逆胴の見分け） |
| `fv_flick.js` | 手を横へ20cmだけ素早く動かす（受け） |
| `fv_face.js` / `fv_spin.js` | 両目が見える立ち姿／1秒ずつ目が隠れる（鬼面の追いかけ） |
| `fv_body3d.js` / `fv_arm.js` | 全身の3Dの骨格で真っ向／右腕を横へ（3Dの影） |
| `mkfv.js` | 手が A→B へ動く偽の骨格推定を作る道具 |

## 台本

| 台本 | 確かめること |
| --- | --- |
| t10 / t10b | 妖怪退治・TABATAで振るとダメージが入るか（t10b はカメラボタンを押さない今の流れ） |
| t11 | 試し振りでボスのとどめまで |
| t12 | 登頂（続きから・座敷童） |
| t13 | 身支度の画面 |
| t15b / t18 | 受け（パリー）／強敵の連撃 |
| t17 | 一筆書きのコンボ・COMBOの締め・技 |
| t19 | TABATAの曲とタイマー |
| t20 / t21 | 新しい型（居合）の登録と見分け |
| t22 | 効果音とBGMのファイルが読めるか |
| t24 | 妖怪の絵が出るか |
| t25 / t26 | シェアの録画／回転しても面が外れないか |
| t27 / t28 | 影の書庫（録る・再生・書き出し・読み込み）／オーラの影の見た目 |
| t29〜t31 | 3Dの影（マネキン／VRM／Kalidokitの値） |
| `keys.py` | 画面の文言のキーが言語ファイルにそろっているか |

鬼面の加工の道具は `tools/masks/`（背景を抜く `cutout.py`、目の位置でそろえる `align.py` と `anchors.json`、256色に圧縮する `quant.py` など）。
