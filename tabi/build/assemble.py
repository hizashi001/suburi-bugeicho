# page/index.html を code/ のブロックから組み立てる。ブロックやアトラスを変えたら毎回実行する
import os
R=os.path.dirname(os.path.abspath(__file__))+'/../'
r=lambda n: open(R+'code/'+n,encoding='utf-8').read()
pre="\n<script>\n(() => {\n'use strict';\nconst $ = id => document.getElementById(id);\nconst ATLAS = __ATLAS__;\nconst YATLAS = __YATLAS__;\nconst FXATLAS = __FXATLAS__;\nconst VFXATLAS = __VFXATLAS__;\nconst ITEMATLAS = __ITEMS__;\n"
BLOCKS=['moves11.js','canvas_sound7.js','drawframe3.js','drawslash.js','drawarc3.js','samples.js','fx3.js','ink3.js','game12.js','skills4.js','ui4.js']
tpl=r('shell_head9.html')+pre+''.join(r(b) for b in BLOCKS)
P=R+'page/'
out=tpl.replace('__ATLAS__',open(P+'heroM.json').read()).replace('__YATLAS__',open(P+'yokai.json').read()).replace('__FXATLAS__',open(P+'fx.json').read()).replace('__VFXATLAS__',open(P+'vfx.json').read()).replace('__ITEMS__',open(P+'items.json').read())
open(P+'index.html','w',encoding='utf-8').write(out)
print('index.html', len(out))
