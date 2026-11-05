import re,json,sys
src=open('index.html',encoding='utf8').read()
ja=json.load(open('lang/ja.json',encoding='utf8'));en=json.load(open('lang/en.json',encoding='utf8'))
keys=set(re.findall(r'''\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]''',src))
keys|=set(re.findall(r'''nameHtml\(\s*["'`]([a-zA-Z0-9_.]+)["'`]''',src))
keys|=set(re.findall(r'data-i18n(?:-html|-title)?="([^"]+)"',src))
dyn=set(re.findall(r'''(?:\bt|nameHtml)\(\s*`([a-zA-Z0-9_.]*)\$\{''',src))
print("dynamic prefixes:",sorted(dyn))
print("missing ja:",sorted(k for k in keys if k not in ja))
print("missing en:",sorted(k for k in keys if k not in en))
print("en-ja diff:",sorted(set(ja)^set(en))[:50])
pre=tuple(dyn)
unused=[k for k in ja if k not in keys and not k.startswith(pre) and not k.endswith('.gloss') and not k.startswith(('sword.','_'))]
print("possibly unused:",unused)
