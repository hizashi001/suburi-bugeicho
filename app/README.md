# GHOST の iPhone アプリ版（Capacitor で包む）

ブラウザ版（このリポジトリの `index.html` など）を **書き換えずに**、アプリに入れる物だけを選んで `app/www/` に組み立て、Capacitor 8 で iOS アプリにする。組み立ては Codemagic のクラウドの Mac（リポジトリ直下の `codemagic.yaml`）。Mac は要らない。

T-015（2026-11-22）で作成。段取りの資料は `C:\SNS_pipeline\dev\teams\game\output\T-010_AppStore\選定と段取り.md`。

## フォルダ

| 場所 | 中身 |
| --- | --- |
| `package.json` / `package-lock.json` | Capacitor とプラグインの版（固定） |
| `capacitor.config.json` | アプリの ID `jp.yoproject.ghost`・表示名 `GHOST` |
| `config/app.json` | **アプリ版だけの設定**。`tipEnabled: false` で心付けのボタンと画面が消える。心付けの商品 ID、お礼の声のファイル、安全の注意の有無 |
| `scripts/fetch-vendor.mjs` | 外から読み込んでいた MediaPipe 0.10.14・推定モデル（pose_landmarker_lite）・Google Fonts を `vendor/` に取り込む。**一度だけ**実行して `vendor/` をリポジトリに入れてある |
| `scripts/build-www.mjs` | `www/` を組み立てる。ページの URL を `vendor/` に差し替え、試験用のボタンを外し、`js/native.js` を差し込み、最後に「外の URL が残っていないか」を調べて、残っていたら止まる |
| `scripts/patch-ios.mjs` | `npx cap add ios` で作った `ios/` を GHOST 用に直す（説明文・縦固定・iPhone 専用・プライバシーの申告・暗号化の申告・共有スキーム・版番号）。何度実行しても同じ結果 |
| `native/native.js` | アプリだけの部品（下の表） |
| `native/lang/*.json` | アプリ用の言い換え（「ブラウザ」「https のページ」などの文を、アプリ向けに上書き） |
| `native/sounds/` | アプリだけの音を置く（師範の声 `voice_katajikenai.mp3` をここに置く） |
| `ios-extra/` | `PrivacyInfo.xcprivacy`（データは集めない・追跡なし）と、共有スキーム `App.xcscheme` |
| `vendor/` | 同梱した外部の物（MediaPipe 19MB・モデル 5.6MB・フォント 15MB。ライセンスは各フォルダの LICENSE.txt） |
| `www/`・`ios/`・`node_modules/` | 作られる物。リポジトリには入れない（Codemagic で毎回作る） |

## アプリに入れる物・入れない物

| 入れる | 入れない |
| --- | --- |
| `index.html`（本編）・`ghost.html`（影の書庫）・`share.html`（鬼面のシェア動画） | `ghost3d.html`・`swordlab.html`・`shadowlab.html`・`actor.html`（試験用。本編のメニューのボタンも外す） |
| ページが読む js（`loot`・`ghost`・`renkei`・`shadowoutline`・`maskfit`。読み込みをたどって自動で選ぶ） | 3D の影の js、`tools/`、`docs/` |
| `config/`・`data/`・`lang/`・`assets/ghost_asset_manifest.json` | `assets/images/3d`（265MB）・`assets/models`（26MB）・`assets/clips_src`（11MB） |
| 画像は manifest にあって実在する物（区分 yokai・boss・mask・gear・sword・shadow）＋鬼面フォルダ | `tabi/`（侍の旅。12/4 の分かれ道 2 で入れると決まったら、ここに足す） |
| `assets/sounds` | |

大きさ: 元の 390MB 余り → **www は約 88MB**（画像 28MB・音 21MB・同梱の外部の物 37MB）。

## アプリだけの部品（`native/native.js`）

ブラウザで開いたときは何もしない。アプリの中では、ページのモジュールより先に動く。

| 部品 | 中身 |
| --- | --- |
| 振動 | `navigator.vibrate` を Haptics に差し替え（iPhone のブラウザには振動がない）。長さで弱・中・強 |
| 画面を消さない | アプリを開いている間はずっと（KeepAwake）。`navigator.wakeLock` も差し替え |
| 共有 | `navigator.share` / `canShare` を、ファイルを一時フォルダに書いて iPhone の共有シートを出す形に差し替え（シェア動画・影のファイル） |
| 安全の注意 | 最初の起動で1回だけ（刃物を使わない・広い所で・iPhone を倒れない所に・痛みが出たらやめる・映像は外へ送らない） |
| 心付け | メニューの一番奥に「師範に心付け」。一服・茶と菓子・茶会（消耗型のアプリ内課金）。買うと師範の声とお茶の数・茶碗の印（端末の中だけ） |
| 言い換え | カメラが使えないときの文などを、アプリ向けに |

カメラの許可は、iOS の許可の画面だけが出る（Capacitor がアプリの中のブラウザの許可を自動で通す）。

## 手元で試す（Windows）

Node 22 以上が要る。

```
cd app
npm ci
node scripts/build-www.mjs     # www/ を作る
```

`www/` はブラウザでも開ける（`python -m http.server 8091 --directory www`）。外部への通信が 0 件で、骨格推定のモデルが同梱から読めることを確かめてある（2026-11-22）。`npx cap add ios` と `node scripts/patch-ios.mjs` も Windows で通る（組み立ては Mac が要るので Codemagic で）。

## オーナーの作業（Codemagic で組み立てる前に1回だけ）

Apple Developer Program の登録が済んでから。PC のブラウザで行う。

1. **App ID を作る**: developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → ＋ → App IDs → App → Bundle ID は Explicit で `jp.yoproject.ghost`、説明は `GHOST`。機能はそのまま（In-App Purchase は最初から入っている）
2. **App Store Connect にアプリを登録**: マイ App → ＋ → 新規 App → iOS、名前 `NINJA SAMURAI WORKOUT: GHOST`（使えなければ案を出す）、言語 英語、バンドル ID `jp.yoproject.ghost`、SKU `ghost-ios-1`
3. **API キーを作る**: App Store Connect → ユーザとアクセス → 統合 → App Store Connect API → チームキー → ＋。名前 `Codemagic`、アクセス `App Manager`（Admin でも可）。Issuer ID・キー ID を控え、`.p8` を**1回だけ**ダウンロード（誰にも送らない）
4. **Codemagic**: codemagic.io に GitHub でログイン → Add application → `suburi-bugeicho` → 設定は codemagic.yaml
5. Codemagic → Team settings → Team integrations → **Developer Portal** → Connect → 名前を **`GHOST App Store Connect`**（codemagic.yaml と同じ）にして、Issuer ID・キー ID・`.p8` を入れる
6. Codemagic → Team settings → codemagic.yaml settings → **Code signing identities**
   - iOS certificates → Generate certificate → 種類 Apple Distribution、5 の API キーを選ぶ → 名前を付けて保存
   - iOS provisioning profiles → Fetch profiles → `jp.yoproject.ghost` の App Store 用が無ければ、developer.apple.com → Profiles → ＋ → App Store Connect → App ID `jp.yoproject.ghost` → 6 で作った証明書 → 名前 `GHOST App Store` で作ってから、もう一度 Fetch profiles → 取り込む
7. App Store Connect → TestFlight → 内部テスト → グループを作り、ヒデキさんを入れる
8. Codemagic の GHOST → Start new build → ワークフロー `GHOST iOS → TestFlight`。15分ほどで TestFlight に届く（届いたあと Apple の処理に10〜30分）

## 心付けの商品

App Store Connect に登録する値は `C:\SNS_pipeline\dev\teams\game\output\T-015_Capacitor\心付けの登録値.md`。商品 ID は `config/app.json` と同じにする。心付けをやめるときは `config/app.json` の `tipEnabled` を `false` にして組み立て直すだけ（App Store Connect の商品は審査に出さなければよい）。

## 版を上げるとき

- 表示の版（1.0.0）は `package.json` の `version`。組み立て番号は Codemagic の通し番号（`PROJECT_BUILD_NUMBER`）が自動で入る
- MediaPipe の版を上げるときは `scripts/fetch-vendor.mjs` の定数と、`scripts/build-www.mjs` の `REWRITES` を合わせて変え、`node scripts/fetch-vendor.mjs` を実行
- 侍の旅を入れるときは `build-www.mjs` の `PAGES` に足し、`tabi/` の外部の読み込みを同じように `vendor/` へ
