# Writes docs/素材の登録状況.md: which images and sounds are in the repository, which the manifest still
# expects, and the import history (data/asset_imports.json). Run from the repository root:
#   python3 tools/asset_list.py
import json, os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
man = json.load(open("assets/ghost_asset_manifest.json", encoding="utf-8"))["assets"]
hist = json.load(open("data/asset_imports.json", encoding="utf-8"))["imports"]
SOUNDS = ["swing_katana", "swing_tanto", "hit_katana", "hit_tanto", "crit_katana", "crit_tanto", "slay", "parry",
          "deden", "waza", "tally_tick", "tally_total", "kettei", "cue_crouch", "cue_guard", "cue_step", "taiko", "chime",
          "hurt", "breath", "draw", "ring", "suzu", "lvup", "fanfare", "gong", "whistle", "beep", "ambience_night",
          "voice_fuseyo", "voice_ukeyo", "voice_tobe", "voice_todome", "voice_zanshin",
          "bgm_title", "bgm_menu", "bgm_run", "bgm_boss1", "bgm_boss2", "bgm_climb", "bgm_tabata", "bgm_shop"]
SECTION_JA = {"yokai": "妖怪", "boss": "ボス・座敷童", "mask": "鬼面", "gear": "防具・御守", "sword": "刀の部品・名物", "shadow": "影絵"}

expected = defaultdict(list)
for a in man:
    expected[a["section"]].append(a)
L = ["# 素材の登録状況", "",
     "このファイルは `python3 tools/asset_list.py` で作り直す（手で直さない）。新しく画像や音を作る前に、ここで**まだ無いもの**を確かめる。", "",
     "- 置き場所：画像は `assets/images/{区分}/`、音は `assets/sounds/`",
     "- 同じ名前で入れ直すと上書きになる（作り直しはこれでよい）",
     "- 名前は英小文字・数字・アンダーバーと `.png`／`.mp3` だけ。`.mp3.MP3` や `.png4.jpg` のような二重の拡張子に注意", ""]

total_have = total_need = 0
summary, detail = [], []
for sec in ["yokai", "boss", "mask", "gear", "sword", "shadow"]:
    folder = f"assets/images/{sec}"
    present = set(f for f in os.listdir(folder) if f.endswith(".png")) if os.path.isdir(folder) else set()
    names = [a["file"] for a in expected[sec]]
    have = [n for n in names if n in present]; need = [n for n in names if n not in present]
    extra = sorted(present - set(names))
    total_have += len(have); total_need += len(need)
    summary.append(f"| {SECTION_JA[sec]}（{sec}） | {len(have)} | {len(need)} | {len(names)} |")
    detail += [f"### {SECTION_JA[sec]}（`{folder}/`）", "",
               f"**登録済み {len(have)}**：" + ("、".join(f"`{n}`" for n in have) if have else "なし"), "",
               f"**まだ無い {len(need)}**：" + ("、".join(f"`{n}`" for n in need) if need else "なし（そろった）"), ""]
    if extra:
        detail += ["**一覧（manifest）に無い名前**（名前の間違いの可能性）：" + "、".join(f"`{n}`" for n in extra), ""]

snd = set(f[:-4] for f in os.listdir("assets/sounds") if f.endswith(".mp3"))
s_have = [s for s in SOUNDS if s in snd]; s_need = [s for s in SOUNDS if s not in snd]; s_extra = sorted(snd - set(SOUNDS))

L += ["## まとめ", "", "| 区分 | 登録済み | まだ無い | 全部 |", "| --- | --- | --- | --- |", *summary,
      f"| **画像の合計** | **{total_have}** | **{total_need}** | **{total_have + total_need}** |",
      f"| 音（効果音・BGM） | {len(s_have)} | {len(s_need)} | {len(SOUNDS)} |", "",
      "## 画像", "", *detail,
      "## 音（`assets/sounds/`）", "",
      f"**登録済み {len(s_have)}**：" + "、".join(f"`{s}.mp3`" for s in s_have), "",
      f"**まだ無い {len(s_need)}**（無い間はアプリの合成音で鳴る。BGMは無ければ鳴らない）：" + "、".join(f"`{s}.mp3`" for s in s_need), ""]
if s_extra:
    L += ["**アプリが使っていない名前**：" + "、".join(f"`{s}.mp3`" for s in s_extra), ""]
L += ["## 取り込みの記録", "", "新しいものから。ファイル名の一覧は `data/asset_imports.json` にある。", ""]
for h in reversed(hist):
    L += [f"### {h['date']}　{h['via']}", "", f"- {len(h['files'])}件" + (f"：{h['note']}" if h.get("note") else ""), ""]
L += ["## サブゲーム「侍の旅」", "", "`tabi/` に一式がある。素材の一覧は `tabi/HANDOFF.md` と `tabi/VFX_CATALOG.md`。", ""]
open("docs/素材の登録状況.md", "w", encoding="utf-8").write("\n".join(L))
print(f"images {total_have}/{total_have + total_need}, sounds {len(s_have)}/{len(SOUNDS)} -> docs/素材の登録状況.md")
