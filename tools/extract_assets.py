from PIL import Image
import numpy as np, os, colorsys
from scipy import ndimage
exec(open(__file__.replace('extract_assets.py','extract_assets_crops.py')).read().split("manifest={}")[0].replace("im=Image.open(SRC).convert('RGBA')","im=Image.open(SRC).convert('RGBA')"))
A=np.array(im)
alpha=A[...,3]>20
lab,n=ndimage.label(ndimage.binary_dilation(alpha,iterations=2))
def save(k,arr):
    p=f'{OUT}/{k}.png'; os.makedirs(os.path.dirname(p),exist_ok=True)
    Image.fromarray(arr).save(p)
for k,(y0,x0,y1,x1) in items.items():
    if k=='decorations/pill-red': y0,x0,y1,x1=(310,182,410,307)
    by0,bx0,by1,bx1=max(0,y0-P),max(0,x0-P),min(1024,y1+P),min(1536,x1+P)
    sub=A[by0:by1,bx0:bx1].copy()
    L=lab[by0:by1,bx0:bx1]
    keep=np.zeros(L.shape,bool)
    for lid in np.unique(L):
        if lid==0: continue
        ys,xs=np.nonzero(lab==lid)
        cy,cx=ys.mean(),xs.mean()
        if y0<=cy<=y1 and x0<=cx<=x1: keep|=(L==lid)
    if k.startswith('avatars/'):
        h,w=L.shape; cy=(by1-by0)/2; cx=cy+ (x0-bx0) - (y0-by0)  # circle left-aligned
        yy,xx=np.mgrid[0:h,0:w]
        r=(min(h,w))/2-P+1
        circ=((yy-cy)**2+(xx-(P+r))**2)<=r*r
        keep=np.where((yy>cy-r*0.55)&(yy<cy+r*0.8), keep&circ, keep)
        keep&= xx < P+2*r+2
    if k=='decorations/pill-red':
        keep=np.ones(L.shape,bool)
    sub[...,3]=np.where(keep,sub[...,3],0)
    # trim
    ys,xs=np.nonzero(sub[...,3]>8)
    sub=sub[max(0,ys.min()-2):ys.max()+3, max(0,xs.min()-2):xs.max()+3]
    save(k,sub)

# --- recolour action cards ---
def body(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(float)
    h,w=a.shape[:2]; px=a[int(h*0.12),int(w*0.18),:3]  # body region near top-left
    return px
def to_hsv(arr):
    r,g,b=[arr[...,i]/255 for i in range(3)]
    mx=np.max(arr[...,:3],axis=-1)/255; mn=np.min(arr[...,:3],axis=-1)/255
    d=mx-mn; h=np.zeros_like(mx)
    m=d>1e-6
    rc=np.where(m,(mx-r)/np.where(m,d,1),0); gc=np.where(m,(mx-g)/np.where(m,d,1),0); bc=np.where(m,(mx-b)/np.where(m,d,1),0)
    h=np.where(r==mx,bc-gc,np.where(g==mx,2+rc-bc,4+gc-rc)); h=(h/6)%1; h=np.where(m,h,0)
    s=np.where(mx>0,d/np.where(mx>0,mx,1),0)
    return h,s,mx
def from_hsv(h,s,v):
    i=np.floor(h*6).astype(int)%6; f=h*6-np.floor(h*6)
    p=v*(1-s); q=v*(1-s*f); t=v*(1-s*(1-f))
    r=np.choose(i,[v,q,p,p,t,v]); g=np.choose(i,[t,v,v,q,p,p]); b=np.choose(i,[p,p,t,v,v,q])
    return np.stack([r,g,b],-1)*255
cols={c:body(f'{OUT}/cards/number-{c}.png') for c in ['red','yellow','green','blue']}
print({k:v.tolist() for k,v in cols.items()})
def recolor(src,sc,tc,dst):
    a=np.array(Image.open(f'{OUT}/cards/{src}.png').convert('RGBA')).astype(float)
    h,s,v=to_hsv(a)
    sh,ss,sv=[x.item() for x in to_hsv(cols[sc][None,None,:])]
    th,ts,tv=[x.item() for x in to_hsv(cols[tc][None,None,:])]
    dh=np.abs(((h-sh)+0.5)%1-0.5)
    w=np.clip(1-(dh-0.08)/0.06,0,1)*np.clip((s-0.55*ss)/(0.3*ss),0,1)
    nh=th; ns=np.clip(s*ts/ss,0,1); nv=np.clip(v*tv/sv,0,1)
    new=from_hsv(np.full_like(h,nh),ns,nv)
    out=a.copy(); out[...,:3]=a[...,:3]*(1-w[...,None])+new*w[...,None]
    Image.fromarray(out.clip(0,255).astype(np.uint8)).save(f'{OUT}/cards/{dst}.png')
for src,sc in [('skip-red','red'),('reverse-yellow','yellow'),('draw2-green','green')]:
    base=src.split('-')[0]
    for tc in ['red','yellow','green','blue']:
        if tc!=sc: recolor(src,sc,tc,f'{base}-{tc}')
