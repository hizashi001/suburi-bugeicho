from PIL import Image
import numpy as np, json, cv2
clips=[[np.asarray(f,dtype=np.uint8) for f in c] for c in np.load("clips.npy",allow_pickle=True)]
walk,run,atk=[[np.asarray(f,dtype=np.uint8) for f in x] for x in np.load("../plab/anims_old.npy",allow_pickle=True)]
def anchor(f):
    a=f[...,3]>0; ys=np.where(a.any(1))[0]; y0,y1=ys.min(),ys.max()
    top=a[y0:y0+int((y1-y0)*0.3)]; xs=np.where(top.any(0))[0]; return (xs.min()+xs.max())/2, y1+1
def scale_frame(f,s,ax,ay):
    H,W=f.shape[:2]; a=f[...,3:4]/255.0
    pre=np.dstack([f[...,:3]*a,a[...,0]]).astype(np.float32)
    M=np.array([[s,0,(1-s)*ax],[0,s,(1-s)*ay]],np.float32)
    r=cv2.warpAffine(pre,M,(W,H),flags=cv2.INTER_AREA)
    al=r[...,3]; col=r[...,:3]/np.maximum(al[...,None],1e-4)
    pal=np.unique(f[f[...,3]>0][:,:3],axis=0).astype(np.float32)
    keep=al>0.5; px=col[keep]; o=np.zeros_like(f)
    if len(px):
        best=np.empty(len(px),int)
        for i in range(0,len(px),4000):
            d=((px[i:i+4000,None,:]-pal[None])**2).sum(-1); best[i:i+4000]=d.argmin(1)
        o[keep,:3]=pal[best].astype(np.uint8); o[keep,3]=255
    return o
S=0.79
nax,nay=anchor(clips[1][0])          # new chudan (clip 2, frame 0)
groups={}
for i,c in enumerate(clips,1):
    groups['c%d'%i]=([scale_frame(f,S,nax,nay) for f in c],(nax,nay))
from PIL import ImageSequence
for i in range(17):
    fr=[np.asarray(f.convert('RGBA')).copy() for f in ImageSequence.Iterator(Image.open('../moves2/g%02d.gif'%i))]
    groups['d%02d'%i]=([scale_frame(f,S,nax,nay) for f in fr],(nax,nay))
oax,oay=anchor(atk[0])               # old chudan
groups['atk']=(atk,(oax,oay))
wax,way=anchor(walk[0]); a9x,_=anchor(clips[8][0]); wax=wax-S*(a9x-nax); print('walk shift',S*(a9x-nax)); groups['walk']=(walk,(wax,way))
# run keeps the anchor used before (median over frames)
rx=np.median([anchor(f)[0] for f in run]); ry=max(anchor(f)[1] for f in run); groups['run']=(run,(rx,ry))
tiles=[];meta={}
for name,(frs,(ax,ay)) in groups.items():
    lst=[]
    for f in frs:
        a=f[...,3]>0; ys=np.where(a.any(1))[0]; xs=np.where(a.any(0))[0]
        x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        tiles.append(f[y0:y1,x0:x1]); lst.append({'ox':int(round(x0-ax)),'oy':int(round(y0-ay))})
    meta[name]=lst
SW=2048; x=y=rowh=0; pos=[]
for t in tiles:
    h,w=t.shape[:2]
    if x+w>SW: x=0; y+=rowh+1; rowh=0
    pos.append((x,y)); x+=w+1; rowh=max(rowh,h)
sheet=np.zeros((y+rowh,SW,4),np.uint8)
for (px_,py),t in zip(pos,tiles): sheet[py:py+t.shape[0],px_:px_+t.shape[1]]=t
Image.fromarray(sheet).save('/home/claude/ghost/sprite/hero.png',optimize=True)
i=0
for name in meta:
    for fr in meta[name]:
        t=tiles[i]; fr.update({'x':pos[i][0],'y':pos[i][1],'w':t.shape[1],'h':t.shape[0]}); i+=1
json.dump(meta,open('/home/claude/ghost/sprite/hero.json','w'),separators=(',',':'))
print(sheet.shape, {k:len(v) for k,v in meta.items()})
# check heights: chudan old vs new
def h(f): a=f[...,3]>0; ys=np.where(a.any(1))[0]; return ys.max()-ys.min()
print('old chudan h',h(atk[0]),'new chudan h',h(groups['c2'][0][0]),'new stand h',h(groups['c9'][0][0]),'old stand',h(walk[0]))
