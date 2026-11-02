from psd_tools import PSDImage
from PIL import Image, ImageDraw, ImageChops
import numpy as np, glob, os
B="/workspace/nightcity/art_src"; psd=PSDImage.open(B+"/nightcity.psd")
W,H=psd.width,psd.height; print("canvas",W,H,psd.color_mode,psd.depth)
for l in psd.descendants():
  print(f"{l.kind:6} vis={l.visible} {l.name!r} bbox={l.bbox} op={l.opacity} blend={l.blend_mode.name} mask={l.has_mask()} clip={l.clipping_layer} parent={l.parent.name if l.parent is not psd else '-'}")
leaves=[l for l in psd.descendants() if not l.is_group()]
outs=[]
for i,l in enumerate(leaves):
  c=Image.new("RGBA",(W,H)); im=l.topil()
  if im: c.paste(im.convert("RGBA"),(l.left,l.top))
  a=np.array(c)[...,3]; ys,xs=np.nonzero(a)
  print(i,l.name,"opaque bbox",(xs.min(),ys.min(),xs.max()+1,ys.max()+1) if len(xs) else None,"cover%.1f"%(100*(a>0).mean()))
  p=f"{B}/layers/{i:02d}_{l.name}.png"; c.save(p); outs.append((l.name,c))
tw=480; th=int(H*tw/W); sheet=Image.new("RGB",(tw*3,(th+20)*((len(outs)+2)//3)),"#222")
for i,(n,c) in enumerate(outs):
  bg=Image.new("RGBA",c.size,(255,0,255,255)); t=Image.alpha_composite(bg,c).resize((tw,th))
  x,y=(i%3)*tw,(i//3)*(th+20); sheet.paste(t,(x,y+20)); ImageDraw.Draw(sheet).text((x+4,y+4),f"{i:02d} {n}",fill="white")
sheet.save("/workspace/nightcity/shots/layers_sheet.png")
comp=psd.composite(force=True).convert("RGBA"); comp.save("/workspace/nightcity/shots/composite.png")
ref=Image.open(B+"/nightcity.png").convert("RGBA"); print("ref",ref.size)
if ref.size==comp.size:
  d=np.abs(np.array(comp,int)-np.array(ref,int)); print("diff mean",d.mean(),"max",d.max(),"px>8:",(d.max(2)>8).mean())
for f in sorted(glob.glob(B+"/layers nightcity/*.png")):
  r=Image.open(f).convert("RGBA"); best=None
  for n,c in outs:
    if c.size==r.size:
      e=np.abs(np.array(c,int)-np.array(r,int)).mean(); best=min(best or (e,n),(e,n))
  print(os.path.basename(f),r.size,"closest",best)
