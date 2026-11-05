# 妖怪のアトラス（page/yokai.png, page/yokai.json）を作る。build/ フォルダの位置から相対パスで動く
from PIL import Image, ImageSequence
import numpy as np, json, cv2, os
R=os.path.dirname(os.path.abspath(__file__))+'/../'
def frames(n):
    fr=[np.asarray(f.convert('RGBA')).copy() for f in ImageSequence.Iterator(Image.open(R+'art/'+n))]
    # a looping GIF repeats its first picture at the end; drop the repeat so the loop does not stutter
    if len(fr)>2 and (np.abs(fr[0].astype(int)-fr[-1].astype(int)).sum(2)>30).sum()<40: fr=fr[:-1]
    for f in fr:   # drop a stray ground line under the feet
        a=f[...,3]>0; ys=np.where(a.any(1))[0]
        for y in range(ys.max()-2, ys.max()+1):
            if a[y].sum()>60: f[y, ~a[y-3], 3]=0
    return fr
def scale(f, s):
    H,W=f.shape[:2]; a=f[...,3:4]/255.0
    pre=np.dstack([f[...,:3]*a,a[...,0]]).astype(np.float32)
    nw,nh=max(1,round(W*s)),max(1,round(H*s))
    r=cv2.resize(pre,(nw,nh),interpolation=cv2.INTER_AREA)
    al=r[...,3]; col=r[...,:3]/np.maximum(al[...,None],1e-4)
    pal=np.unique(f[f[...,3]>0][:,:3],axis=0).astype(np.float32)
    keep=al>0.5; px=col[keep]; o=np.zeros((nh,nw,4),np.uint8)
    if len(px):
        best=np.empty(len(px),int)
        for i in range(0,len(px),3000):
            d=((px[i:i+3000,None,:]-pal[None])**2).sum(-1); best[i:i+3000]=d.argmin(1)
        o[keep,:3]=pal[best].astype(np.uint8); o[keep,3]=255
    return o
SPEC=[ # key, file (under art/), target height, anchor ('feet' or 'center')
 ('shutenIdle','yokai/y00.gif',176,'feet'),('shutenAtk','yokai/y01.gif',176,'feet'),
 ('zashiki','yokai_new/zashiki.gif',60,'feet'),('yamaotoko','yokai/y03.png',108,'feet'),('karasu','yokai_new/karasu.gif',122,'feet'),
 ('hitotsume','yokai/y05b.gif',80,'feet'),('tanukiT','yokai/y06.png',140,'feet'),('kappaT','yokai/y07.png',146,'feet'),
 ('chochin','yokai/y08b.gif',84,'feet'),('kappa','yokai/y09.png',102,'feet'),('tanuki','yokai_new/tanuki.gif',100,'feet'),('ittan','yokai/y11b.gif',88,'center'),
 ('kubi','yokai_new/kubi.gif',70,'center')]
tiles=[];meta={}
ref={}
for key,fn,th,anc in SPEC:
    fr=frames(fn)
    base=fr[0]; a=base[...,3]>0; ys=np.where(a.any(1))[0]; xs=np.where(a.any(0))[0]
    if key=='shutenAtk': s,ax,ay=ref['shuten']
    else:
        s=th/(ys.max()-ys.min()+1)
        # feet anchor: bottom of the figure, x at the centre of the lowest fifth (where it stands)
        y1=ys.max(); low=a[int(y1-(y1-ys.min())*0.2):y1+1]; lx=np.where(low.any(0))[0]
        ax=(lx.min()+lx.max())/2 if anc=='feet' else (xs.min()+xs.max())/2
        ay=y1+1 if anc=='feet' else (ys.min()+ys.max())/2
        if key=='shutenIdle': ref['shuten']=(s,ax,ay)
    lst=[]
    for f in fr:
        sf=scale(f,s); al=sf[...,3]>0
        if not al.any(): continue
        yy=np.where(al.any(1))[0]; xx=np.where(al.any(0))[0]
        x0,x1,y0,y1=xx.min(),xx.max()+1,yy.min(),yy.max()+1
        tiles.append(sf[y0:y1,x0:x1]); lst.append({'ox':int(round(x0-ax*s)),'oy':int(round(y0-ay*s))})
    meta[key]=lst
    print(key,len(lst),'scale',round(s,2),'h',th)
SW=1024; x=y=rowh=0; pos=[]
for t in tiles:
    h,w=t.shape[:2]
    if x+w>SW: x=0; y+=rowh+1; rowh=0
    pos.append((x,y)); x+=w+1; rowh=max(rowh,h)
sheet=np.zeros((y+rowh,SW,4),np.uint8)
for (px_,py),t in zip(pos,tiles): sheet[py:py+t.shape[0],px_:px_+t.shape[1]]=t
Image.fromarray(sheet).save(R+'page/yokai.png',optimize=True)
i=0
for k in meta:
    for fr in meta[k]:
        t=tiles[i]; fr.update({'x':pos[i][0],'y':pos[i][1],'w':t.shape[1],'h':t.shape[0]}); i+=1
json.dump(meta,open(R+'page/yokai.json','w'),separators=(',',':'))
print(sheet.shape)
# preview at game scale next to the hero chudan
hero=Image.open(R+'page/hero.png'); hm=json.load(open(R+'page/hero.json'))
sh=Image.fromarray(sheet)
o=Image.new('RGBA',(1650,240),(30,34,74,255))
def put(img,m,x,base=220):
    t=img.crop((m['x'],m['y'],m['x']+m['w'],m['y']+m['h'])); o.alpha_composite(t,(int(x+m['ox']),int(base+m['oy'])))
put(hero,hm['atk'][0],60)
xx=170
for k in ['hitotsume','chochin','ittan','kubi','kappa','tanuki','yamaotoko','karasu','kappaT','tanukiT','shutenIdle','zashiki']:
    m=meta[k][0]; put(sh,m,xx, 120 if k in ('ittan','kubi') else 220); xx+=max(70,m['w']+10)
o.save(R+'build/ylineup.png')
