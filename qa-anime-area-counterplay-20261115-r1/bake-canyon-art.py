"""Bake the canyon's diffuse ground and masonry from the playable map. No image inputs.
Run with Python 3, NumPy, OpenCV, Pillow and Node. The map module lives beside this file.
"""
import json
import math
import re
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from flagstone_relief import flagstones

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
cv2.setNumThreads(1)
rng = np.random.default_rng(70419)
raw = subprocess.check_output(["node", "--input-type=module", "-e",
    "import {routes,jungles,streams,homes,garden,keeps,floorHeight} from './estuary-map.mjs';"
    "const elevation=Array.from({length:97},(_,j)=>Array.from({length:97},(_,i)=>floorHeight(i*.75-36,j*.75-36)));"
    "console.log(JSON.stringify({routes:routes.map(r=>r.points),jungles:jungles.map(r=>r.points),river:streams.points,homes,garden,keeps,elevation}));"
], cwd=ROOT)
world = json.loads(raw)
ASSETS.mkdir(exist_ok=True)
flagstones(ASSETS / "canyon-sunlit-flags.webp")
N = 1280
S = (N-1)/72
Y, X = np.mgrid[:N,:N].astype(np.float32)
X = X/S-36
Y = Y/S-36

def pix(x,z):
    return (int(round((x+36)*S)),int(round((z+36)*S)))

def field(lines):
    image = np.full((N,N),255,np.uint8)
    for path in lines:
        pts=np.array([pix(pt["x"],pt["z"]) for pt in path],np.int32)
        cv2.polylines(image,[pts],False,0,1)
    return cv2.distanceTransform(image,cv2.DIST_L2,5)/S

def noise(w,h=None):
    sample=rng.random((h or w,w),dtype=np.float32)-.5
    return cv2.resize(sample,(N,N),interpolation=cv2.INTER_CUBIC)

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

def mix(a,b,t):
    return a+(b-a)*t[...,None]

def rgb(t):
    return np.array(t,dtype=np.float32)

lane=field(world["routes"]);wood=field(world["jungles"]);river=field([world["river"]])
broad=noise(15);tufts=noise(88);grain=noise(260)
grass=mix(rgb([82,113,89]),rgb([151,164,106]),np.clip(.49+.75*broad+.18*tufts,0,1))
grass+=(3.7*grain+2.2*tufts)[...,None]
grass=mix(grass,rgb([93,130,105]),(1-smooth(2.6,8.7,river))*.47)
earth=rgb([152,144,113])+(16*broad+8*tufts+5*grain)[...,None]
ground=mix(grass,earth,1-smooth(.44,1.37,wood+.30*tufts))
stone=rgb([160,159,137])+(12*broad+4*grain)[...,None]
# A narrow shoulder of compacted grit meets the grass. The render-time flag
# material breaks on individual stones along its inner edge.
shoulder=lane+.10*tufts+.038*grain
grit=rgb([151,137,108])+(15*broad+9*tufts+11*grain)[...,None]
ground=mix(ground,grit,1-smooth(1.92,2.18,shoulder))
ground=mix(ground,stone,1-smooth(1.50,1.81,shoulder))
bank=rgb([170,170,130])+(14*tufts+8*broad)[...,None]
ground=mix(ground,bank,1-smooth(2.54,3.33,river+.15*tufts))
depth=1-smooth(.2,2.87,river)
water=mix(rgb([104,165,149]),rgb([44,111,120]),depth)
water+=(8*broad+4*tufts+1.8*grain)[...,None]
ground=mix(ground,water,1-smooth(2.39,2.73,river+.16*tufts))

# Fractured slate lies under the shallow water, with more uninterrupted open
# colour in the deep channel. Rounded-off Voronoi corners avoid a second paved road.
river_seed=np.random.default_rng(87629)
under=Image.new("L",(N,N),128);etch=ImageDraw.Draw(under)
spacing=24;vor=cv2.Subdiv2D((0,0,N,N))
for row in range(0,N,spacing):
    for col in range(0,N,spacing):
        cy=int(np.clip(row+river_seed.uniform(3,21),1,N-2));cx=int(np.clip(col+river_seed.uniform(2,22),1,N-2))
        if river[cy,cx]<5.3:
            vor.insert((float(cx),float(cy)))
facets,centres=vor.getVoronoiFacetList([])
for corners,centre in zip(facets,centres):
    cx,cy=np.clip(centre,0,N-1).astype(int)
    if river[cy,cx]>3.18 or len(corners)<3:continue
    flat=river[cy,cx]>1.30 or lane[cy,cx]<3.0
    inset=river_seed.uniform(.73,.92) if flat else river_seed.uniform(.48,.78)
    c=np.array([cx,cy],dtype=float);rim=c+(corners-c)*inset
    polygon=[]
    for j,v in enumerate(rim):
        polygon.extend([v*.79+rim[j-1]*.21,v*.81+rim[(j+1)%len(rim)]*.19])
    polypts=[tuple(np.rint(v).astype(int)) for v in polygon]
    etch.polygon(polypts,fill=int(river_seed.integers(125,148)))
    for j,v in enumerate(polygon):
        nxt=polygon[(j+1)%len(polygon)];mid=(v+nxt)*.5-c
        if np.dot(mid,[-.69,-.72])>2:
            etch.line([polypts[j],polypts[(j+1)%len(polygon)]],fill=161,width=1)
        elif mid[1]>3:
            etch.line([polypts[j],polypts[(j+1)%len(polygon)]],fill=98,width=1)
relief=np.asarray(under).astype(np.float32)-128
visibility=(1-smooth(2.5,2.96,river))*(.30+.52*smooth(.32,2.1,river)+.27*(1-smooth(2.5,5.6,lane)))
ground+=(relief*visibility)[...,None]*rgb([.72,1.03,.92])
canvas=Image.fromarray(np.uint8(np.clip(ground,0,255)));draw=ImageDraw.Draw(canvas)

# The established verge and masonry use the map's original PCG sequence.
# Give those drawings a fixed starting point independent of the paving layout.
rng = np.random.default_rng(70419)
rng.bit_generator.advance(41581)
rng.integers(0, 1 << 32, dtype=np.uint32)
rng.random(2)

# Grass has strokes in families at the verge, not a frame of random noise over the whole map.
for unused in range(9100):
    u,v=map(int,rng.integers(2,N-2,2))
    if river[v,u]<2.85 or lane[v,u]<2.03 or wood[v,u]<.72:continue
    if tufts[v,u]+broad[v,u]*.46<-.08:continue
    base=np.array(canvas.getpixel((u,v)),dtype=int)
    tips=int(rng.integers(2,6));light=float(rng.uniform(.84,1.14))
    for j in range(tips):
        cx=u+int(rng.integers(-4,5));cy=v+int(rng.integers(-3,4));rise=int(rng.integers(2,6))
        ink=tuple(np.uint8(np.clip(base*light+np.array([1,4,-5]),0,255)))
        draw.line([(cx,cy),(cx+1+rise//3,cy-rise)],fill=ink)
chips=np.random.default_rng(41907)
for u,v in chips.integers(2,N-3,(6800,2)):
    if not (1.72<shoulder[v,u]<2.14 and river[v,u]>3.08):continue
    colour=np.array(canvas.getpixel((u,v)),dtype=int)
    colour=np.uint8(np.clip(colour*chips.uniform(.89,1.07)+[6,5,1],0,255))
    draw.line([(u,v),(u+int(chips.integers(1,3)),v-1)],fill=tuple(colour))
# Smooth projected canopy shade and a dense contact patch follow the locations of the real meshes.
mask=np.zeros((N,N),np.uint8)
for tree in world["garden"]:
    x,z,sz,k=tree["x"],tree["z"],tree["size"],tree["kind"]
    dense=94 if k<2 else 72
    cv2.ellipse(mask,pix(x+.30*sz,z-.22*sz),(int(S*sz*(.59 if k<2 else .43)),int(S*sz*(.34 if k<2 else .27))),-22,0,360,dense,-1)
shade=cv2.GaussianBlur(mask,(0,0),S*.19).astype(np.float32)/255
mask.fill(0)
for t in world["garden"]:
    cv2.ellipse(mask,pix(t["x"],t["z"]),(max(2,int(t["size"]*S*.26)),max(2,int(t["size"]*S*.17))),0,0,360,95,-1)
shade+=cv2.GaussianBlur(mask,(0,0),1.9).astype(np.float32)/255
raw=np.asarray(canvas).astype(np.float32)*(1-shade[...,None]*rgb([.40,.32,.23]))
raw+=(2.8*grain+2.2*tufts)[...,None]
ASSETS.mkdir(exist_ok=True)
Image.fromarray(np.uint8(np.clip(raw,0,255))).save(ASSETS/"canyon-verge-ground.webp",quality=88,method=5)

# Stone, glazed roof tile, timber, deck joint, neutral lime, terracotta, shale and the bridge flagstone face.
tile=192
sheet=Image.new("RGB",(tile*2,tile*4))
colours=[(194,182,150),(83,128,119),(139,92,60),(173,172,151),(240,238,221),(148,91,78),(145,157,147),(131,138,135)]
ty,tx=np.mgrid[:tile,:tile].astype(np.float32)
for idx,colour in enumerate(colours):
    vals=cv2.resize(rng.normal(0,1,(9,9)).astype(np.float32),(tile,tile),interpolation=cv2.INTER_CUBIC)
    if idx in (1,5):
        # Fired pieces have different pigments. The renderer supplies the
        # directional highlight from the matching curved tile and overlap.
        u=((tx+.5)/tile-.009)/.982*10
        v=((ty+.5)/tile-.009)/.982*6
        kiln=np.sin(np.floor(u)*5.73+np.floor(v)*23.17+idx)*437.87
        kiln=kiln-np.floor(kiln)-.5
        dust=(.5+.5*np.cos(2*np.pi*(u-.70)))**3
        lap=np.exp(-(1-np.cos(2*np.pi*v))*24)
        detail=12*kiln+4.3*vals+4*dust-4*lap
    elif idx==2:
        bend=2.4*vals+2*np.exp(-((ty-126)/24)**2)*np.sin(tx*.07)
        fibre=np.sin(tx*.151+bend+ty*.008)
        detail=4.6*vals+4.5*fibre-5.2*np.maximum(0,fibre)**7+1.8*np.sin(tx*.55+ty*.013)
    elif idx==4:detail=vals*1.3
    elif idx==7:
        seam=abs(np.sin(tx*.026+ty*.019+.47*vals))
        detail=4.8*vals+5.0*np.exp(-(seam/.067)**2)+2.5*np.sin(tx*.23+ty*.12+.48*vals)
    else:detail=vals*3+np.sin(tx*.047+ty*.081+vals*.37)*(2.3 if idx==6 else 1.5)
    detail+=rng.normal(0,1.05,(tile,tile)).astype(np.float32)
    cell=Image.fromarray(np.uint8(np.clip(rgb(colour)+detail[...,None],0,255)));pen=ImageDraw.Draw(cell)
    if idx in (0,3,6,7):
        # Thin irregular mineral veins rather than high-contrast photographic cracks.
        for j in range(9):
            x=int(rng.integers(tile));y=int(rng.integers(tile));pts=[(x,y)]
            for k in range(4):pts.append((pts[-1][0]+int(rng.integers(3,13)),pts[-1][1]+int(rng.integers(-5,4))))
            pen.line(pts,fill=tuple(max(0,v-13) for v in colour))
    sheet.paste(cell,((idx%2)*tile,(idx//2)*tile))
sheet.save(ASSETS/"canyon-fired-tile.webp",quality=88,method=5)

# The draft screen uses a chart of the actual battle map. Its inline paths scale
# from a phone to desktop, and need no image download or additional GL context.
def course(points):
    xy=np.array([[p["x"],p["z"]] for p in points],np.float32)
    anchors=cv2.approxPolyDP(xy,.14,False).reshape(-1,2)
    return "M"+"L".join(f"{x:.1f},{y:.1f}" for x,y in anchors)

chart=['<svg id="selection-chart" viewBox="-38 -38 76 76" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" fill="none" stroke-linejoin="round">']
height=np.array(world["elevation"]); outlines=[]
for cutoff in (.25,.41,.479,.499,.516,.535):
    contours,_=cv2.findContours(np.uint8(height>cutoff),cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    for line in contours:
        if cv2.arcLength(line,True)<28:continue
        coords=cv2.approxPolyDP(line,.85,True).reshape(-1,2)*.75-36
        outlines.append("M"+"L".join(f"{x:.1f},{z:.1f}" for x,z in coords)+"Z")
chart.append('<path d="'+"".join(outlines)+'" stroke="#9ca97c" opacity=".29" stroke-width=".075"/>')
def linework(paths,colour,width,extra=""):
    paths="".join(course(p) for p in paths)
    chart.append(f'<path d="{paths}" stroke="{colour}" stroke-width="{width}" {extra}/>')
linework([world["river"]],"#365e62",4.7)
linework([world["river"]],"#55827f",.15)
linework(world["routes"],"#aa9b70",.55,'opacity=".59"')
linework(world["jungles"],"#b2a87e",.14,'opacity=".53" stroke-dasharray=".38 .3"')
for keep in world["keeps"]:
    chart.append(f'<circle cx="{keep["x"]:.1f}" cy="{keep["z"]:.1f}" r=".42" fill="#d6bf86" stroke="#385154" stroke-width=".16"/>')
for base in world["homes"]:
    chart.append(f'<circle cx="{base["x"]}" cy="{base["z"]}" r="1.45" stroke="#e3ca8e" stroke-width=".24"/>')
chart.append("</svg>")
entry=ROOT/"index.html"
html=entry.read_text()
marker='<!--draft-map-->'
if marker not in html:
    key='<section id="menu" class="veil">'
    assert html.count(key)==1
    html=html.replace(key,key+marker+'<!--/draft-map-->')
html,count=re.subn(r'<!--draft-map-->.*?<!--/draft-map-->',marker+"".join(chart)+'<!--/draft-map-->',html,flags=re.S)
assert count==1
entry.write_text(html)
print("Baked ground, masonry and the draft chart from the playable map",N)
