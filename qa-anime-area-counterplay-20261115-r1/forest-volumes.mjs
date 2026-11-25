// Each stand grows from its map coordinate. Solid stone and soft foliage share
// vertex buffers, but stone establishes real depth before the fighters are drawn.
import {garden,groundContact,riverbedHeight,stoneLandmarks} from "./estuary-map.mjs?v=canyon-bank-grove2";
import {rockRings} from "./garden-stones.mjs?v=canyon-archway1";
import {fieldVisibility} from "./field-visibility.mjs?v=canyon-eaves-batch1";
import {spellVertex} from "./surface-impact.mjs?v=canyon-timber-bay1";
import {sceneryOcclusion} from "./scenery-occlusion.mjs?v=canyon-eave-batch1";

// The two halves are a pine spray and a willow spray. Alpha cuts out the actual
// spaces between leaves. Red stores the rolled blade colour and green the midrib.
// The independent blue channel still supplies bark and mineral grain.
function surfaceMarks(T){
  const size=96,width=2*size,data=new Uint8Array(width*size*4);
  let seed=29717;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<data.length;i+=4){data[i]=128;data[i+1]=122;data[i+2]=128;}
  function grain(x,y,rx,ry,angle,value){
    const c=Math.cos(angle),s=Math.sin(angle),reach=Math.ceil(Math.max(rx,ry));
    for(let j=-reach;j<=reach;j++)for(let i=-reach;i<=reach;i++){
      const u=(i*c+j*s)/rx,v=(j*c-i*s)/ry,k=1-u*u-v*v;if(k<=0)continue;
      const at=4*((y+j+size)%size*width+(x+i+width)%width)+2;
      data[at]=Math.min(226,Math.max(27,data[at]+value*k));
    }
  }
  for(let j=0;j<105;j++)grain(Math.floor(next()*width),Math.floor(next()*size),
    3+next()*8,.7+next()*1.2,.14+next()*.61,next()>.47?59:-61);
  function blade(half,x0,y0,x1,y1,r,bend,tone,stem=false){
    const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    const pad=Math.ceil(r+Math.abs(bend)+1);
    const left=Math.max(0,Math.floor(Math.min(x0,x1))-pad),right=Math.min(size-1,Math.ceil(Math.max(x0,x1))+pad);
    const low=Math.max(0,Math.floor(Math.min(y0,y1))-pad),high=Math.min(size-1,Math.ceil(Math.max(y0,y1))+pad);
    for(let y=low;y<=high;y++)for(let x=left;x<=right;x++){
      const ax=x+.5-x0,ay=y+.5-y0,t=(ax*dx+ay*dy)/(len*len);
      if(t<=0||t>=1)continue;
      const wave=Math.sin(Math.PI*t),offset=ax*nx+ay*ny-bend*wave;
      const w=r*(stem?.80+.20*wave:Math.pow(wave,.68)*(1.16-.28*t));
      const coverage=Math.round(255*Math.max(0,Math.min(1,w+.55-Math.abs(offset))));
      if(!coverage)continue;
      const i=4*(y*width+x+half*size);
      if(coverage<data[i+3]*.55)continue;
      const lateral=offset/Math.max(.45,w),vein=1-Math.min(1,Math.abs(offset)/.86);
      data[i]=Math.round(Math.max(16,Math.min(240,tone+29*t+(lateral<0?21:-11)*wave)));
      data[i+1]=Math.round(83+60*t+38*vein*wave);
      data[i+3]=Math.max(data[i+3],coverage);
    }
  }
  const pine=t=>46+6*Math.sin(t*2.3)-2*t;
  for(let j=0;j<9;j++){
    const t=j/9,y=7+78*t,sx=pine(t);
    blade(0,sx,y-2,pine(t+1/9),y+12,1.65-t*.74,.35,103,true);
    for(const sign of [-1,1]){
      const span=12+23*Math.sin(Math.PI*(.11+t*.83));
      const tx=sx+sign*span,ty=y+15+5*t;
      blade(0,sx,y,tx,ty,1.45,sign*.7,105,true);
      for(let k=0;k<5;k++){
        const f=(k+.20)/5,px=sx+(tx-sx)*f,py=y+(ty-y)*f;
        blade(0,px,py,px+sign*(5+next()*4),py+8.2+6*next(),1.5+1.05*next(),sign*.75,97+43*next());
        if(k<4)blade(0,px+.6*sign,py,px+sign*(9+3.8*next()),py-2.5+4*next(),1.5+.75*next(),-sign*.60,88+38*next());
      }
    }
  }
  const willow=t=>47+5*Math.sin(t*3.3)-4*t;
  for(let j=0;j<15;j++){
    const t=j/15,y=4+82*t,sx=willow(t),sign=j%2?-1:1;
    blade(1,sx,y-1,willow(t+1/15),y+8,1.18-.57*t,sign*.22,92,true);
    const span=(12+24*Math.sin(Math.PI*(.12+t*.86)))*(.88+.21*next());
    const end=Math.min(94,y+14+10*(1-t)+3*next());
    blade(1,sx,y,sx+sign*span,end,2.35+1.55*(1-t)+.65*next(),
      sign*(3.6+2.2*next()),89+47*next()+12*t);
  }
  blade(1,willow(.91),79,47,94,1.42,1.1,157);
  const tex=new T.DataTexture(data,width,size);
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;
  tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  return tex;
}

export function growRiverGarden(T,lighting,hasStencil=false){
  const positions=[],ink=[],normals=[],roots=[],leaves=[],foliage=[],stones=[],stands=[];
  let triangles=foliage;
  const palette=new Map(),axis=new T.Vector3(),side=new T.Vector3(),across=new T.Vector3(),up=new T.Vector3(0,1,0);
  let site,seed,finish=0;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function vertex(x,y,z,nx,ny,nz,color,gain=1,leaf=0,u=site.x,v=site.z){
    if(!palette.has(color))palette.set(color,[(color>>16)/255,((color>>8)&255)/255,(color&255)/255]);
    const c=palette.get(color),d=1/(Math.hypot(nx,ny,nz)||1),index=leaves.length;
    positions.push(site.x+x*site.size,site.y+y*site.size,site.z+z*site.size);
    normals.push(nx*d,ny*d,nz*d);ink.push(c[0]*gain,c[1]*gain,c[2]*gain);
    roots.push(u,v,finish);leaves.push(leaf);return index;
  }
  function trunk(a,b,r0,r1,colour,k=7){
    finish=0;
    axis.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
    side.crossVectors(axis,Math.abs(axis.y)>.91?new T.Vector3(1,0,0):up).normalize();across.crossVectors(axis,side);
    const from=leaves.length;
    for(let end=0;end<2;end++)for(let j=0;j<k;j++){
      const angle=j*2*Math.PI/k,cs=Math.cos(angle),sn=Math.sin(angle);
      const nx=side.x*cs+across.x*sn,ny=side.y*cs+across.y*sn,nz=side.z*cs+across.z*sn;
      const c=end?b:a,r=end?r1:r0;
      vertex(c[0]+nx*r,c[1]+ny*r,c[2]+nz*r,nx,ny,nz,colour,.90+.12*(j%3)/2);
    }
    for(let j=0;j<k;j++){const i=from+j,n=from+(j+1)%k;triangles.push(i,n,n+k,i,n+k,i+k);}
  }
  function timber(points,radii,colour,sides){
    finish=0;
    let previous=null;
    for(let r=0;r<points.length;r++){
      const centre=points[r],before=points[Math.max(0,r-1)],after=points[Math.min(points.length-1,r+1)];
      axis.set(after[0]-before[0],after[1]-before[1],after[2]-before[2]).normalize();
      if(previous)side.copy(previous).addScaledVector(axis,-previous.dot(axis)).normalize();
      else side.crossVectors(axis,Math.abs(axis.y)>.87?new T.Vector3(1,0,0):up).normalize();
      if(!previous)previous=new T.Vector3();previous.copy(side);across.crossVectors(axis,side);
      const first=leaves.length;
      for(let i=0;i<sides;i++){
        const a=i*2*Math.PI/sides,co=Math.cos(a),si=Math.sin(a);
        const nx=side.x*co+across.x*si,ny=side.y*co+across.y*si,nz=side.z*co+across.z*si;
        const radius=radii[r]*(1+.055*Math.sin(a*3+.4));
        vertex(centre[0]+nx*radius,centre[1]+ny*radius,centre[2]+nz*radius,nx,ny,nz,
          colour,.80+.11*(1+Math.sin(a*3+.4))*.5+.095*r/(points.length-1));
        if(r>0){const j=first+(i+1)%sides,k=first+i;triangles.push(k-sides,j-sides,j,k-sides,j,k);}
      }
    }
  }
  function spray(a,b,c,width,roll,colour,pine,brightness){
    finish=pine?4:5;
    const hx=c[0]-a[0],hz=c[2]-a[2],plan=Math.hypot(hx,hz)||1;
    const sx=-hz/plan,sz=hx/plan;
    const first=leaves.length;
    for(let row=0;row<3;row++){
      const t=row*.5,h=1-t,u=2*h*t;
      const twist=roll+(pine?.13:.44)*(t-.4),tilt=Math.sin(twist),flat=Math.cos(twist);
      const x=a[0]*h*h+b[0]*u+c[0]*t*t,y=a[1]*h*h+b[1]*u+c[1]*t*t,z=a[2]*h*h+b[2]*u+c[2]*t*t;
      const dx=h*(b[0]-a[0])+t*(c[0]-b[0]),dy=h*(b[1]-a[1])+t*(c[1]-b[1]),dz=h*(b[2]-a[2])+t*(c[2]-b[2]);
      // Face the sky under the fixed sun while preserving the curve and twist of the shoot.
      let nx=dy*sz*flat-dz*tilt,ny=dz*sx*flat-dx*sz*flat,nz=dx*tilt-dy*sx*flat;
      if(ny<0){nx=-nx;ny=-ny;nz=-nz;}
      const norm=Math.max(.0001,Math.hypot(nx,ny,nz));
      for(let j=0;j<3;j++){
        const q=j-1,w=width*(.76+.24*(1-Math.abs(2*t-1))),ridge=j===1?w*.16:0;
        vertex(x+q*w*sx*flat,y+q*w*tilt+ridge,z+q*w*sz*flat,
          nx/norm+q*sx*.23,ny/norm+.20,nz/norm+q*sz*.23,colour,
          brightness*(.83+.16*t+(j===1?.025:0)),.12+.84*t,(j*.5)*.96+.02,t*.96+.02);
      }
    }
    for(let r=0;r<2;r++)for(let j=0;j<2;j++){
      const i=first+r*3+j;triangles.push(i,i+1,i+3,i+1,i+4,i+3);
    }
  }
  // Fit an airy envelope around each bough's actual shoots. Tint leaves and
  // bark by their intervening foliage towards the fixed sun at generation time.
  function boughVolume(first){
    let xmin=Infinity,ymin=Infinity,zmin=Infinity,xmax=-Infinity,ymax=-Infinity,zmax=-Infinity;
    for(let i=first;i<positions.length;i+=3){
      const x=positions[i],y=positions[i+1],z=positions[i+2];
      xmin=Math.min(xmin,x);ymin=Math.min(ymin,y);zmin=Math.min(zmin,z);
      xmax=Math.max(xmax,x);ymax=Math.max(ymax,y);zmax=Math.max(zmax,z);
    }
    const pad=site.size*.040,rx=1/((xmax-xmin)*.55+pad),ry=1/((ymax-ymin)*.53+pad),rz=1/((zmax-zmin)*.55+pad);
    const dx=-.380*rx,dy=.878*ry,dz=.293*rz;
    return {x:(xmin+xmax)*.5,y:(ymin+ymax)*.5,z:(zmin+zmax)*.5,rx,ry,rz,dx,dy,dz,inv:1/(dx*dx+dy*dy+dz*dz)};
  }
  function filterDaylight(first,volumes){
    const bias=site.size*.052,invSize=1/site.size;
    for(let i=first;i<positions.length;i+=3){
      const x=positions[i],y=positions[i+1],z=positions[i+2];let depth=0;
      for(const b of volumes){
        const ox=(x-b.x)*b.rx,oy=(y-b.y)*b.ry,oz=(z-b.z)*b.rz;
        const along=-(ox*b.dx+oy*b.dy+oz*b.dz),centre=along*b.inv;
        const span=1-(ox*ox+oy*oy+oz*oz-along*centre);
        if(span<=0)continue;
        const reach=Math.sqrt(span*b.inv),end=centre+reach;
        if(end>bias)depth+=Math.max(0,end-Math.max(bias,centre-reach));
      }
      const shelter=1-Math.exp(-3.0*depth*invSize);
      ink[i]*=1-.50*shelter;ink[i+1]*=1-.36*shelter;ink[i+2]*=1-.22*shelter;
    }
  }
  function tree(pine){
    const first=positions.length,volumes=[];
    const turn=site.lean??rand()*Math.PI*2,co=Math.cos(turn),si=Math.sin(turn);
    const bark=pine?0x856c51:0x826f53;
    const tones=pine?[0x426b60,0x508668,0x6b9869,0x94a76c]:[0x4a7562,0x659059,0x87aa63,0xaabd71];
    const map=(x,y,z)=>[co*x-si*z,y,si*x+co*z];
    const spine=h=>[.026*Math.sin(h*8)+(pine?.18:.24)*h*h,h,.05*Math.sin(h*5.1)];
    const heights=[-.035,.17,.38,.61,.81,pine?.99:.91];
    timber(heights.map(h=>map(...spine(h))),pine?[.112,.084,.066,.051,.029,.008]:[.110,.078,.062,.045,.024,.008],bark,7);
    for(let j=0;j<3;j++){
      const a=j*2.10+.31;
      timber([map(Math.cos(a)*.25,.006,Math.sin(a)*.21),map(.013,.05,.01),map(.021,.19,.018)],[.014,.062,.070],bark,5);
    }
    const count=pine?8:7,phase=rand()*Math.PI*2;
    const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
    for(let branch=0;branch<count;branch++){
      const tier=Math.floor(branch/3),slot=branch%3;
      const level=pine?tier*.37+slot*.035:branch/(count-1);
      const angle=phase+(pine?tier*1.13+slot*2*Math.PI/(tier===2?2:3):branch*2.397)+.23*(rand()-.5);
      const ux=Math.cos(angle),uz=Math.sin(angle);
      const base=spine((pine?.31:.32)+level*(pine?.65:.48));
      const reach=(pine?.49-.27*level:.51-.17*level)*(.88+.23*rand());
      const swing=(pine?.030:.077)*(1-level*.45);
      const elbow=[base[0]+ux*reach*.48+swing,base[1]+(pine?.015:.160),base[2]+uz*reach*.48];
      const tip=[base[0]+ux*reach+swing,base[1]+(pine?.105:.254)-.034*level,base[2]+uz*reach];
      timber([map(...base),map(...elbow),map(...tip)],[.037-.015*level,.022-.008*level,.006],bark,5);
      const firstShoot=positions.length;
      for(const flank of [-1,0,1]){
        const branchAngle=angle+flank*(pine?.71:.77)+.13*(rand()-.5);
        const fx=Math.cos(branchAngle),fz=Math.sin(branchAngle);
        const fork=flank?[elbow[0]+fx*reach*.47,elbow[1]+(pine?.061:.100),elbow[2]+fz*reach*.47]:tip;
        if(flank)timber([map(...elbow),map(...fork)],[.016,.004],bark,4);
        const glint=Math.max(0,-(co*fx-si*fz)*.64+(si*fx+co*fz)*.46);
        const count=pine?(flank?1:2):3;
        for(let k=0;k<count;k++){
          let start,distance,drop,rise,width,az;
          if(pine){
            const inner=!flank&&k===0;
            start=inner?mix(base,elbow,.70):mix(elbow,fork,flank?.48:.64);
            distance=(inner?.31:.28)+.075*rand()-.045*level;drop=.012+.062*rand()-.030*level;
            rise=.064+.040*rand();width=(inner?.129:.113)+.034*rand();
            az=branchAngle+(inner?-.34:flank*.14)+.24*(rand()-.5);
          }else{
            start=mix(elbow,fork,[.39,.78,.96][k]-.10*rand());
            distance=[.28,.19,.105][k]+.066*rand(); drop=[.084,.282,.444][k]+.12*rand()-.055*level;
            rise=[.114,.093,.042][k];width=[.124,.092,.053][k]+.029*rand();
            az=branchAngle+[-.35,.36,-.08][k]+.34*(rand()-.5);
          }
          const dx=Math.cos(az),dz=Math.sin(az);
          const middle=map(start[0]+dx*distance*.78,start[1]+rise,start[2]+dz*distance*.78);
          const end=map(start[0]+dx*distance+.026,start[1]-drop,start[2]+dz*distance);
          const exposure=level*.58+glint*.42+.13*rand()+(k===2?.045:0);
          const idx=exposure>.79?3:exposure>.49?2:exposure>.25?1:0;
          spray(map(...start),middle,end,width,flank*.22+(k-.8)*.20+(rand()-.5)*.77,
            tones[idx],pine,.94+.10*glint+.05*rand());
        }
      }
      if(!pine){
        // Short, ascending inner shoots fill the upper crown. The long willow
        // switches stay at the extremities of the same branch.
        for(let j=0;j<(level>.51?2:1);j++){
          const at=mix(base,elbow,.20+j*.37),angleIn=angle+(j?.92:-.68);
          const dx=Math.cos(angleIn),dz=Math.sin(angleIn),length=.31-.065*level;
          spray(map(...at),map(at[0]+dx*length*.68,at[1]+.125,at[2]+dz*length*.68),
            map(at[0]+dx*length,at[1]+.054-.075*j,at[2]+dz*length),
            .132+.025*level,(j-.4)*.51,tones[level>.69?2:1],false,.98+.05*level);
        }
      }
      volumes.push(boughVolume(firstShoot));
    }
    if(pine){
      const firstShoot=positions.length;
      for(let k=0;k<4;k++){
        const a=phase+k*1.57,h=.825+k*.035,[x,,z]=spine(h),dx=Math.cos(a),dz=Math.sin(a);
        const reach=.22-k*.029;
        spray(map(x,h,z),map(x+dx*reach*.65,h+.14,z+dz*reach*.65),
          map(x+dx*reach,h+.085,z+dz*reach),.092-k*.011,k*.20-.23,tones[k===3?3:2],true,1.03);
      }
      volumes.push(boughVolume(firstShoot));
    }
    filterDaylight(first,volumes);
  }
  function leaf(base,angle,length,width,color){
    finish=2;
    const co=Math.cos(angle),si=Math.sin(angle),[x,y,z]=base;
    const i=vertex(x,y,z,0,1,0,color,.79,.3),m=vertex(x+length*.43*co-si*width,y+.052,z+length*.43*si+co*width,-si,.85,co,color,1,.7);
    const tip=vertex(x+length*co,y+.007,z+length*si,co,.5,si,color,.96,1);
    const right=vertex(x+length*.41*co+si*width,y+.039,z+length*.41*si-co*width,si,.89,-co,color,.91,.7);
    triangles.push(i,m,tip,i,tip,right);
  }
  function bamboo(){
    for(let j=0;j<5;j++){
      const a=j*2.39,co=Math.cos(a),si=Math.sin(a),x=co*.16,z=si*.15,h=.55+rand()*.49,dx=co*.12,dz=si*.10;
      trunk([x,0,z],[x+dx,h,z+dz],.022,.013,0x9b9d63,5);
      for(let tier=1;tier<=3;tier++){
        const t=tier*.245,at=[x+dx*t,h*t,z+dz*t],theta=a+tier*2.4,end=[at[0]+.19*Math.cos(theta),at[1]+.08,at[2]+.19*Math.sin(theta)];
        trunk(at,end,.012,.004,0x778252,4);
        for(let q=-1;q<=1;q++)leaf(end,theta+q*.7,.17+.07*rand(),.026, q===0?0xa6ad72:0x779866);
      }
    }
  }
  function rock({cx,cy,cz,rx,ry,rz,colour,count,tilt,hull}){
    finish=3;
    const rings=rockRings.map(([rad,h],j)=>hull.map(([x,z,top])=>
      [cx+rx*(x*rad+.052*j),cy+ry*h*top,cz+rz*(z*rad-.023*j)]));
    function face(vertices,c,gain){
      const [a,b,d]=vertices,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],
        vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const n=leaves.length;for(const v of vertices)vertex(...v,nx,ny,nz,c,gain);
      triangles.push(n,n+1,n+2);if(vertices.length===4)triangles.push(n,n+2,n+3);
    }
    for(let i=0;i<count;i++){
      const k=(i+1)%count;
      for(let j=0;j<3;j++)face([rings[j][i],rings[j+1][i],rings[j+1][k],rings[j][k]],colour,[.66,.91,1.0][j]);
      face([rings[3][k],rings[3][i],[cx+rx*.07,cy+ry*(1.01+.02*tilt),cz-rz*.08]],colour,1.06);
    }
  }
  function stoneGrass(){
    for(let j=0;j<5;j++)leaf([-.27+.11*j,.065,.19],j*1.4,.19,.038,j%2?0x819168:0x9ca36f);
  }
  const point=new T.Vector3(),box=new T.Box3(),centre=new T.Vector3(),size=new T.Vector3();
  for(const [index,p] of garden.entries()){
    site={...p,y:riverbedHeight(p.x,p.z)};seed=15497+index*7307;
    if(p.kind===2){
      triangles=stones;
      for(const piece of stoneLandmarks[index].pieces)rock(piece);
      triangles=foliage;
    }
    const firstVertex=positions.length,start=foliage.length;
    if(p.kind<2)tree(p.riverTree?p.riverTree==="pine":p.kind===0);else if(p.kind===2)stoneGrass();else bamboo();
    box.makeEmpty();
    for(let i=firstVertex;i<positions.length;i+=3)box.expandByPoint(point.fromArray(positions,i));
    box.expandByScalar(.04); // Includes the furthest branch sway.
    box.getCenter(centre);box.getSize(size).multiplyScalar(.5);
    stands.push({start,count:triangles.length-start,x:centre.x,y:centre.y,z:centre.z,
      rx:size.x,ry:size.y,rz:size.z,selected:false});
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Int8BufferAttribute(Int8Array.from(normals,v=>Math.round(v*127)),3,true));
  geo.setAttribute('color',new T.Uint8BufferAttribute(Uint8Array.from(ink,v=>Math.round(Math.max(0,Math.min(1,v))*255)),3,true));geo.setAttribute('rootSite',new T.Float32BufferAttribute(roots,3));
  geo.setAttribute('leafWeight',new T.Uint8BufferAttribute(Uint8Array.from(leaves,v=>Math.round(Math.min(1,v)*255)),1,true));geo.setIndex(triangles);geo.computeBoundingSphere();
  const wind={value:0},marks=surfaceMarks(T);
  const soft=hasStencil?{}:{softBounds:{value:Array.from({length:3},()=>new T.Vector4(-8,-8,1,1))},
    softDepth:{value:new Float32Array(3)},screenScale:{value:new T.Vector2(1,1)}};
  const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,side:T.DoubleSide,toneMapped:false,
    defines:hasStencil?{}:{SOFT_FOREGROUND:1},
    uniforms:{...lighting.uniforms,...soft,wind,marks:{value:marks},veil:{value:0}},
    vertexShader:`precision highp float;
      in vec3 position,normal,color;in vec3 rootSite;in float leafWeight;
      uniform mat4 modelViewMatrix,projectionMatrix;uniform float wind;
      out lowp vec3 albedo;out mediump vec2 materialUv;flat out lowp float finish;
      ${spellVertex}
      void main(){
        vec3 v=position;float willow=step(4.5,rootSite.z);
        float flex=rootSite.z>3.5?mix(.012,.032,willow):.024;
        float move=leafWeight*sin(position.x*.73+position.z*.41+wind)*flex;
        v.x+=move;v.z+=move*.44;v.y+=move*.18*willow;
        vec3 n=normalize(normal),sun=normalize(vec3(-.43,1.,.34));float lit=dot(n,sun);
        float daylight=smoothstep(-.42,.85,lit);
        vec3 light=rootSite.z>3.5?mix(vec3(.62,.77,.80),vec3(1.17,1.10,.91),daylight):
          mix(vec3(.74,.82,.91),vec3(1.12,1.065,.94),daylight);
        albedo=color*light+spellAt(v,n)*(.12+.33*color);
        finish=rootSite.z;
        materialUv=finish>3.5?vec2((rootSite.x+step(4.5,finish))*.5,rootSite.y):
          (v.xz-rootSite.xy*.38+vec2(.32,-.57)*v.y)*vec2(.385,.77);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);
      }`,
    fragmentShader:`precision mediump float;
      in lowp vec3 albedo;in mediump vec2 materialUv;flat in lowp float finish;
      uniform sampler2D marks;uniform lowp float veil;out vec4 paint;
      #ifdef SOFT_FOREGROUND
      uniform highp vec4 softBounds[3];uniform highp float softDepth[3];uniform highp vec2 screenScale;
      #endif
      void main(){
        vec4 sampleInk=texture(marks,materialUv);
        vec3 coloured;
        if(finish>3.5){
          if(sampleInk.a<.31)discard;
          float fold=sampleInk.r-.5,vein=sampleInk.g-.5;
          coloured=albedo*(1.+fold*.71)+max(0.,vein)*vec3(.11,.13,.036);
        }else{
          float grain=sampleInk.b-.5;
          coloured=albedo*(1.+grain*.53)+max(0.,grain)*vec3(.039,.047,.017);
        }
        float covered=veil;
        #ifdef SOFT_FOREGROUND
        highp vec2 pt=gl_FragCoord.xy*screenScale-1.;
        highp float depth=1./gl_FragCoord.w;
        for(int i=0;i<3;i++){
          highp vec2 d=(pt-softBounds[i].xy)*softBounds[i].zw;
          float silhouette=1.-smoothstep(.65,1.32,dot(d,d));
          covered=max(covered,silhouette*smoothstep(0.,.40,softDepth[i]-depth));
        }
        #endif
        float surface=finish>3.5?.15:.18;
        paint=vec4(coloured,mix(1.,surface,covered));}`});
  const mesh=new T.Mesh(geo,material);mesh.name="实景林石与竹丛";
  const rockGeometry=new T.BufferGeometry();
  for(const [name,attribute] of Object.entries(geo.attributes))rockGeometry.setAttribute(name,attribute);
  rockGeometry.setIndex(stones);
  rockGeometry.boundingSphere=geo.boundingSphere;
  const rockMaterial=new T.RawShaderMaterial({glslVersion:material.glslVersion,side:material.side,
    toneMapped:material.toneMapped,vertexShader:material.vertexShader,fragmentShader:material.fragmentShader,
    uniforms:material.uniforms});
  const solid=new T.Mesh(rockGeometry,rockMaterial);solid.name="实心岸石";solid.renderOrder=2.2;
  mesh.add(solid);
  const cover=sceneryOcclusion(T,mesh,stands,geo.index.array,groundContact,hasStencil);
  const cullPlants=fieldVisibility(T,geo,3.75,.035),cullRocks=fieldVisibility(T,rockGeometry,3.75);
  mesh.userData.cull=frustum=>{cullRocks(frustum);cullPlants(frustum);};
  mesh.userData.markFighter=cover.mark;
  mesh.userData.sight=cover.update;
  mesh.userData.tick=(time,tier)=>{wind.value=tier<2?time*.72:0;};
  mesh.userData.start=()=>{};
  mesh.userData.close=()=>{
    cover.dispose();solid.removeFromParent();
    // The foliage geometry owns the shared vertex buffers.
    for(const name of Object.keys(rockGeometry.attributes))rockGeometry.deleteAttribute(name);
    rockGeometry.dispose();rockMaterial.dispose();marks.dispose();
  };
  return mesh;
}
