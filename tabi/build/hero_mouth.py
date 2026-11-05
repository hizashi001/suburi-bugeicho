# hero.json（hero_build.py の出力）に、各コマの口の位置 mx,my（足元基準）を足して heroM.json を作る。呼吸の白い息の発生位置に使う
import json, numpy as np, sys
from PIL import Image
P=sys.argv[1] if len(sys.argv)>1 else '../page/'
h=json.load(open(P+'hero.json')); im=np.asarray(Image.open(P+'hero.png').convert('RGBA'))
for k,fl in h.items():
  for f in fl:
    a=im[f['y']:f['y']+f['h'], f['x']:f['x']+f['w'],3]>0
    t=np.where(a.any(1))[0].min()
    top=np.where(a[t:t+8].any(0))[0]; hc=(top.min()+top.max())/2
    cols=np.where(a[t+9:t+17].any(0))[0]; near=cols[(cols>=hc-14)&(cols<=hc+16)]
    f['mx']=int(f['ox']+(near.max() if len(near) else hc+6)); f['my']=int(f['oy']+t+13)
json.dump(h,open(P+'heroM.json','w'),separators=(',',':'))
