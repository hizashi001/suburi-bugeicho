from PIL import Image, ImageSequence
import numpy as np, json
# key: anchor ('c' centre of the union box, 'b' bottom centre)
SPEC={'bolt':'c','moon':'c','wind':'c','aoFire':'b','ringB':'c','akaFire':'b','orbB':'c','explode':'c','flame':'b',
      'pillarG':'b','dome':'b','spark':'c','thunder':'b','puff':'c','ringO':'c','ink':'c'}
tiles=[];meta={}
for k,anc in SPEC.items():
    im=Image.open(k+'.gif'); fr=[];du=[]
    for f in ImageSequence.Iterator(im):
        fr.append(np.asarray(f.convert('RGBA')).copy()); du.append(f.info.get('duration',80))
    al=np.zeros(fr[0].shape[:2],bool)
    for f in fr: al|=f[...,3]>0
    ys=np.where(al.any(1))[0]; xs=np.where(al.any(0))[0]
    x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    keep=[f for f in fr if (f[...,3]>0).any()]
    meta[k]={'w':int(x1-x0),'h':int(y1-y0),'ax':int((x1-x0)//2),'ay':int((y1-y0) if anc=='b' else (y1-y0)//2),'fd':round(np.mean(du)/1000,3),'f':[]}
    for f in keep: tiles.append((k,f[y0:y1,x0:x1]))
SW=1024;x=y=rowh=0;pos=[]
for k,t in tiles:
    h,w=t.shape[:2]
    if x+w>SW: x=0;y+=rowh+1;rowh=0
    pos.append((x,y));x+=w+1;rowh=max(rowh,h)
sheet=np.zeros((y+rowh,SW,4),np.uint8)
for (k,t),(px,py) in zip(tiles,pos):
    sheet[py:py+t.shape[0],px:px+t.shape[1]]=t; meta[k]['f'].append([px,py])
Image.fromarray(sheet).save('/home/claude/ghost/sprite/fx.png',optimize=True)
json.dump(meta,open('/home/claude/ghost/sprite/fx.json','w'),separators=(',',':'))
for k,m in meta.items(): print(k,m['w'],m['h'],len(m['f']),m['fd'])
print(sheet.shape)
