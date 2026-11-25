// A stone's rings describe both the visible cut faces and its walkable boundary.
// A low chip can decorate a rim without making an invisible obstacle on the lane.
export const rockRings=[[.91,-.06],[1,.57],[.90,.82],[.78,1]];

function outerHull(points) {
  points.sort((a,b)=>a.x-b.x || a.z-b.z);
  function append(chain,p) {
    while(chain.length>=2) {
      const a=chain[chain.length-2],b=chain[chain.length-1];
      if((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x)>1e-9)break;
      chain.pop();
    }
    chain.push(p);
  }
  const low=[],high=[];
  for(const p of points)append(low,p);
  for(let i=points.length-1;i>=0;i--)append(high,points[i]);
  low.pop();high.pop();
  return low.concat(high);
}

export function stoneSites(garden) {
  return garden.map((site,index)=>{
    if(site.kind!==2)return null;
    const pieces=[],corners=[];
    let seed=15497+index*7307;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    function rock(cx,cy,cz,rx,ry,rz,colour,count=7) {
      const hull=[],tilt=(random()-.5)*.30;
      for(let j=0;j<count;j++) {
        const a=j*2*Math.PI/count+.43+.15*(random()-.5),co=Math.cos(a),si=Math.sin(a);
        const r=.82+.24*random(),x=Math.sign(co)*Math.abs(co)**.62*r,z=Math.sign(si)*Math.abs(si)**.68*r;
        const top=.89+.11*random()+tilt*x;
        hull.push([x,z,top]);
        if((cy+ry)*site.size<.25)continue;
        for(let k=0;k<rockRings.length;k++) {
          const radial=rockRings[k][0];
          corners.push({x:site.x+site.size*(cx+rx*(x*radial+.052*k)),
            z:site.z+site.size*(cz+rz*(z*radial-.023*k))});
        }
      }
      pieces.push({cx,cy,cz,rx,ry,rz,colour,count,tilt,hull});
    }
    if(site.art===2 || site.art===4) {
      for(let layer=0;layer<3;layer++)for(let j=0;j<3-layer*.52;j++) {
        const x=-.38+j*.32+.085*(layer%2),z=.02*Math.sin(j*3);
        rock(x,layer*.125-.025,z,.205,.145,.17,layer===2?0xa5ab91:0x8b9487,5);
      }
      rock(.44,-.014,.14,.17,.15,.13,0x858e77);
    } else {
      rock(-.12,-.045,0,.46,.32,.31,0x8f9b94);
      rock(.22,-.026,.10,.255,.16,.19,0xa6ada0);
      rock(.06,-.018,.26,.14,.10,.10,0x7d8b81);
    }
    const hull=outerHull(corners),edges=[];
    let xl=Infinity,xh=-Infinity,zl=Infinity,zh=-Infinity;
    for(let i=0;i<hull.length;i++) {
      const p=hull[i],q=hull[(i+1)%hull.length],dx=q.x-p.x,dz=q.z-p.z;
      const length=Math.hypot(dx,dz);
      edges.push({x:p.x,z:p.z,dx,dz,invLength2:1/(length*length),nx:dz/length,nz:-dx/length});
      xl=Math.min(xl,p.x);xh=Math.max(xh,p.x);zl=Math.min(zl,p.z);zh=Math.max(zh,p.z);
    }
    return {id:-1000-index,hp:1,kind:"stone",x:(xl+xh)*.5,z:(zl+zh)*.5,
      rx:(xh-xl)*.5,rz:(zh-zl)*.5,pieces,hull,edges};
  });
}

// Signed disk-to-polygon clearance. Projection is exact on a flat face and
// rounded around an exposed corner. The same calculation repairs spawn or
// displacement states whose centres already lie within the rock.
export function stoneClearance(rock,x,z,radius,contact) {
  let nearest=Infinity,closestX=0,closestZ=0,sideX=0,sideZ=0,inside=true;
  for(const edge of rock.edges) {
    const dx=x-edge.x,dz=z-edge.z;
    if(dx*edge.nx+dz*edge.nz>0)inside=false;
    const along=Math.max(0,Math.min(1,(dx*edge.dx+dz*edge.dz)*edge.invLength2));
    const px=edge.x+edge.dx*along,pz=edge.z+edge.dz*along,ox=x-px,oz=z-pz,dist=ox*ox+oz*oz;
    if(dist<nearest) {nearest=dist;closestX=px;closestZ=pz;sideX=edge.nx;sideZ=edge.nz;}
  }
  const distance=Math.sqrt(nearest);
  if(contact) {
    const n=!inside && distance>1e-8;
    contact.x=closestX+(n?(x-closestX)/distance:sideX)*(radius+.00008);
    contact.z=closestZ+(n?(z-closestZ)/distance:sideZ)*(radius+.00008);
  }
  return (inside?-distance:distance)-radius;
}

const projected={x:0,z:0};
export function stopAtStone(rock,actor,radius,fromX,fromZ) {
  if(Math.abs(actor.x-rock.x)>rock.rx+radius || Math.abs(actor.z-rock.z)>rock.rz+radius)return false;
  if(stoneClearance(rock,actor.x,actor.z,radius,projected)>=0)return false;
  if(Number.isFinite(fromX) && Number.isFinite(fromZ) && stoneClearance(rock,fromX,fromZ,radius)>=0) {
    // A blink may land beyond a barrier. An endpoint inside it resolves to
    // the entry side approached by this cast.
    const dx=actor.x-fromX,dz=actor.z-fromZ;
    let lo=0,hi=1;
    for(let i=0;i<14;i++) {
      const t=(lo+hi)*.5;
      if(stoneClearance(rock,fromX+dx*t,fromZ+dz*t,radius)<0)hi=t;
      else lo=t;
    }
    actor.x=fromX+dx*lo;actor.z=fromZ+dz*lo;
  } else {
    actor.x=projected.x;actor.z=projected.z;
  }
  return true;
}
