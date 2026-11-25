// The four slopes meet at real hip ridges. Surface normals follow the curved
// section of each slope, including its upswept corner, independent of the mesh diagonal.
const directions=[[0,-1,1,0],[1,0,0,1],[0,1,-1,0],[-1,0,0,-1]];
const across=[-1,-.64,-.30,0,.30,.64,1],up=[0,.32,.66,1];

export function pavilionRoof(y,rise,span,colors,tri,quad){
  const tile=(side,u,t)=>{
    const [ox,oz,tx,tz]=directions[side],ratio=1-.86*t,radius=span*ratio;
    const lift=.17*Math.min(1,span),corner=u*u*(.65+.35*u*u);
    const height=y+.07+rise*(.20*t+.80*t*t)+lift*corner*(1-t)**2;
    const dr=-.86*span;
    const dydu=lift*(1.3*u+1.4*u**3)*(1-t)**2;
    const dydt=rise*(.2+1.6*t)-2*lift*corner*(1-t);
    const along=(dydt-u*dr*dydu/radius)/(-dr),sideSlope=-dydu/radius;
    const nx=ox*along+tx*sideSlope,nz=oz*along+tz*sideSlope,len=Math.hypot(nx,1,nz);
    return {p:[(ox+u*tx)*radius,height,(oz+u*tz)*radius],
      n:[nx/len,1/len,nz/len],uv:[.5+.5*u*ratio,1-t]};
  };
  const offset=(p,x,h,z)=>[p[0]+x,p[1]+h,p[2]+z];
  function skin(a,b,c){
    tri(a.p,b.p,c.p,colors.roof,[a.uv,b.uv,c.uv],[a.n,b.n,c.n]);
  }
  for(let side=0;side<4;side++){
    const [ox,oz,tx,tz]=directions[side],grid=up.map(t=>across.map(u=>tile(side,u,t)));
    for(let row=0;row<grid.length-1;row++)for(let i=0;i<across.length-1;i++){
      skin(grid[row][i+1],grid[row][i],grid[row+1][i]);
      skin(grid[row][i+1],grid[row+1][i],grid[row+1][i+1]);
    }
    const edge=grid[0].map(v=>v.p),bottom=edge.map(p=>offset(p,-.012*ox,-.073,-.012*oz));
    const inner=across.map(u=>[(ox+tx*u)*span*.78,y-.074,(oz+tz*u)*span*.78]);
    for(let i=0;i<across.length-1;i++){
      quad(bottom[i+1],bottom[i],edge[i],edge[i+1],colors.edge);
      quad(inner[i],bottom[i],bottom[i+1],inner[i+1],"#735a45");
    }
    tri([0,y-.074,0],inner[0],inner.at(-1),"#69493a");
    const upper=grid.at(-1);
    tri([0,upper[0].p[1],0],upper.at(-1).p,upper[0].p,colors.edge);

    // Five fired-clay end caps along the eave interrupt the fascia at playing distance.
    // They end on its outer face, with no strips laid over the slope.
    for(let j=0;j<5;j++){
      const u=(j-2)*.36,p=tile(side,u,0).p,r=Math.min(.056,.051*span);
      const centre=offset(p,.018*ox,-.050,.018*oz),rim=[];
      for(let k=0;k<=4;k++){
        const a=Math.PI*k/4;rim.push(offset(centre,tx*r*Math.cos(a),r*Math.sin(a),tz*r*Math.cos(a)));
      }
      for(let k=0;k<4;k++)tri(centre,rim[k],rim[k+1],colors.cap);
    }

    const sx=ox-tx,sz=oz-tz,px=-sz/Math.SQRT2,pz=sx/Math.SQRT2;
    const ridge=up.map(t=>{
      const p=tile(side,-1,t).p,w=Math.min(.053,.05*span)*(1-.30*t);
      return [[-1,.01],[-.72,.72],[0,1],[.72,.72],[1,.01]].map(([v,h])=>offset(p,px*w*v,w*h+.007,pz*w*v));
    });
    for(let j=0;j<ridge.length-1;j++)for(let k=0;k<4;k++)
      quad(ridge[j][k+1],ridge[j][k],ridge[j+1][k],ridge[j+1][k+1],colors.edge);
    for(let k=1;k<4;k++)tri(ridge[0][0],ridge[0][k],ridge[0][k+1],colors.cap);
  }
}
