// `npx cap add ios` で作った ios/ を、GHOST 用に直す。何度実行しても同じ結果になる（Codemagic でも毎回実行する）。
//   node scripts/patch-ios.mjs
// ・Info.plist: カメラ・写真への保存の説明文、縦固定、iPhone のみ、暗号化の申告、言語（英・日）
// ・説明文の日本語版（ja.lproj/InfoPlist.strings）と英語版（en.lproj）
// ・プライバシーの申告ファイル（PrivacyInfo.xcprivacy）
// ・Xcode の設定: iPhone 専用（TARGETED_DEVICE_FAMILY=1）、上の2つをアプリに入れる、版番号
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const IOS = join(APP, "ios", "App");
const EXTRA = join(APP, "ios-extra");
if (!existsSync(IOS)) { console.error("ios/ がありません。先に npx cap add ios"); process.exit(1); }

// 説明文（英語が元。日本語は ja.lproj で差し替え）
const PURPOSE = {
  en: {
    NSCameraUsageDescription: "GHOST uses the front camera to track your body pose on this iPhone and judge your sword swings. The video is processed on the device and is never sent anywhere.",
    NSPhotoLibraryAddUsageDescription: "GHOST saves the share video or shadow file you made to your photo library only when you choose \u201cSave\u201d.",
  },
  ja: {
    NSCameraUsageDescription: "GHOST は前のカメラで体の動きをこの iPhone の中で読み取り、素振りを判定します。映像は端末の中だけで使い、外へ送りません。",
    NSPhotoLibraryAddUsageDescription: "あなたが「保存」を選んだときだけ、作ったシェア動画や影のファイルを写真に保存します。",
  },
};

// ---------- Info.plist ----------
const plistPath = join(IOS, "App", "Info.plist");
let plist = await readFile(plistPath, "utf8");
const xmlEsc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function setKey(key, valueXml) {
  const re = new RegExp(`\\s*<key>${key}</key>\\s*(<string>[\\s\\S]*?</string>|<true/>|<false/>|<array>[\\s\\S]*?</array>)`);
  plist = plist.replace(re, "");
  plist = plist.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n\t<key>${key}</key>\n\t${valueXml}\n</dict>\n</plist>\n`);
}
const arr = (xs) => `<array>\n${xs.map((x) => `\t\t<string>${x}</string>`).join("\n")}\n\t</array>`;
for (const [k, v] of Object.entries(PURPOSE.en)) setKey(k, `<string>${xmlEsc(v)}</string>`);
setKey("UISupportedInterfaceOrientations", arr(["UIInterfaceOrientationPortrait"]));
setKey("UISupportedInterfaceOrientations~ipad", arr(["UIInterfaceOrientationPortrait"]));
setKey("UIRequiresFullScreen", "<true/>");
setKey("ITSAppUsesNonExemptEncryption", "<false/>");
setKey("CFBundleLocalizations", arr(["en", "ja"]));
setKey("CFBundleAllowMixedLocalizations", "<true/>");
setKey("UIRequiredDeviceCapabilities", arr(["arm64"]));
await writeFile(plistPath, plist);

// ---------- 説明文の言語ごとのファイル ----------
for (const lang of ["en", "ja"]) {
  const dir = join(IOS, "App", `${lang}.lproj`);
  await mkdir(dir, { recursive: true });
  const body = Object.entries(PURPOSE[lang]).map(([k, v]) => `"${k}" = "${v.replace(/"/g, '\\"')}";`).join("\n") + "\n";
  await writeFile(join(dir, "InfoPlist.strings"), body);
}
await copyFile(join(EXTRA, "PrivacyInfo.xcprivacy"), join(IOS, "App", "PrivacyInfo.xcprivacy"));
// 共有のスキーム（Codemagic の xcode-project build-ipa が --scheme App で見つけられるように）
const schemeDir = join(IOS, "App.xcodeproj", "xcshareddata", "xcschemes");
await mkdir(schemeDir, { recursive: true });
await copyFile(join(EXTRA, "App.xcscheme"), join(schemeDir, "App.xcscheme"));

// ---------- project.pbxproj ----------
const pbxPath = join(IOS, "App.xcodeproj", "project.pbxproj");
let pbx = await readFile(pbxPath, "utf8");
const ID = { // 固定の ID（24桁の16進）。GHOST 用に決めた値
  privRef: "6A0510000000000000000001", privBuild: "6A0510000000000000000002",
  strGroup: "6A0510000000000000000003", strBuild: "6A0510000000000000000004",
  strEn: "6A0510000000000000000005", strJa: "6A0510000000000000000006",
};
function insertAfter(marker, text) {
  if (!pbx.includes(marker)) throw new Error(`pbxproj に見つかりません: ${marker}`);
  pbx = pbx.replace(marker, marker + text);
}
if (!pbx.includes(ID.privRef)) {
  insertAfter("/* Begin PBXBuildFile section */\n",
    `\t\t${ID.privBuild} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.privRef} /* PrivacyInfo.xcprivacy */; };\n` +
    `\t\t${ID.strBuild} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.strGroup} /* InfoPlist.strings */; };\n`);
  insertAfter("/* Begin PBXFileReference section */\n",
    `\t\t${ID.privRef} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n` +
    `\t\t${ID.strEn} /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = en.lproj/InfoPlist.strings; sourceTree = "<group>"; };\n` +
    `\t\t${ID.strJa} /* ja */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ja; path = ja.lproj/InfoPlist.strings; sourceTree = "<group>"; };\n`);
  // App グループの子に足す
  insertAfter("504EC3131FED79650016851F /* Info.plist */,\n",
    `\t\t\t\t${ID.privRef} /* PrivacyInfo.xcprivacy */,\n\t\t\t\t${ID.strGroup} /* InfoPlist.strings */,\n`);
  // Resources の段に足す
  insertAfter("50B271D11FEDC1A000F3C39B /* public in Resources */,\n",
    `\t\t\t\t${ID.privBuild} /* PrivacyInfo.xcprivacy in Resources */,\n\t\t\t\t${ID.strBuild} /* InfoPlist.strings in Resources */,\n`);
  insertAfter("/* Begin PBXVariantGroup section */\n",
    `\t\t${ID.strGroup} /* InfoPlist.strings */ = {\n\t\t\tisa = PBXVariantGroup;\n\t\t\tchildren = (\n\t\t\t\t${ID.strEn} /* en */,\n\t\t\t\t${ID.strJa} /* ja */,\n\t\t\t);\n\t\t\tname = InfoPlist.strings;\n\t\t\tsourceTree = "<group>";\n\t\t};\n`);
}
pbx = pbx.replace(/knownRegions = \(\n(\s*)en,\n(\s*)Base,\n/, (m, a, b) => `knownRegions = (\n${a}en,\n${a}ja,\n${b}Base,\n`);
pbx = pbx.replace(/TARGETED_DEVICE_FAMILY = "1,2";/g, 'TARGETED_DEVICE_FAMILY = 1;');
// 版番号: 表示名は package.json の version。組み立て番号（CURRENT_PROJECT_VERSION）は Codemagic が毎回上げる
const pkg = JSON.parse(await readFile(join(APP, "package.json"), "utf8"));
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${pkg.version};`);
const build = process.env.BUILD_NUMBER || process.env.PROJECT_BUILD_NUMBER;
if (build && /^\d+$/.test(build)) pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
await writeFile(pbxPath, pbx);

console.log("ios/ を GHOST 用に直しました（説明文・縦固定・iPhone 専用・申告ファイル）");
