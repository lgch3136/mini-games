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
    const edge=grid[0].map(v=>v.p);
    const lip=edge.map(p=>offset(p,.022*ox,-.039,.022*oz));
    const bottom=edge.map(p=>offset(p,-.016*ox,-.125,-.016*oz));
    const inner=across.map(u=>[(ox+tx*u)*span*.78,y-.074,(oz+tz*u)*span*.78]);
    for(let i=0;i<across.length-1;i++){
      quad(lip[i+1],lip[i],edge[i],edge[i+1],colors.edge);
      quad(bottom[i+1],bottom[i],lip[i],lip[i+1],colors.soffit);
      quad(inner[i],bottom[i],bottom[i+1],inner[i+1],"#735a45");
    }
    tri([0,y-.074,0],inner[0],inner.at(-1),"#69493a");
    const upper=grid.at(-1);
    tri([0,upper[0].p[1],0],upper.at(-1).p,upper[0].p,colors.edge);

    // The relief map has ten barrel tiles with their crowns at phase .24.
    // Carry each crown around the edge into a protruding ceramic lip and a recessed mouth.
    for(let j=0;j<10;j++){
      const u=2*(j+.24)/10-1,p=tile(side,u,0).p;
      const radius=span*Math.min(.078,.85*(1-Math.abs(u)));
      const depth=Math.min(.047,.041*span),height=Math.min(.071,radius);
      // The top of each cap starts under the continuous drip edge, including on the far silhouette.
      const end=(v,h,out)=>offset(p,tx*v*radius+ox*out,-.030+height*(h-.84),tz*v*radius+oz*out);
      const profile=[[-1,0],[-.56,.84],[.56,.84],[1,0]];
      const front=profile.map(([v,h])=>end(v,h,depth));
      const heel=end(0,.83,-.008),cup=end(0,.24,depth-.026);
      for(let k=0;k<3;k++){
        tri(heel,front[k+1],front[k],colors.edge);
        tri(front[k],front[k+1],cup,k===1?colors.cap:colors.soffit);
      }
      tri(front[3],front[0],cup,colors.soffit);
    }

    const sx=ox-tx,sz=oz-tz,px=-sz/Math.SQRT2,pz=sx/Math.SQRT2;
    // Ridge covers are bedded one over the next. Their projecting mouths
    // interrupt the highlight and cast a narrow shadow across the hip.
    function capSection(t,mouth){
      const p=tile(side,-1,t).p,w=Math.min(.088,.083*span)*(1-.30*t);
      const width=w*(mouth?1:.76),height=w*(mouth?1.10:.68);
      return [[-1,.01],[-.72,.66],[0,1],[.72,.66],[1,.01]].map(
        ([v,h])=>offset(p,px*width*v,height*h+.006,pz*width*v));
    }
    let head=null;
    for(let row=0;row<5;row++){
      const mouth=capSection(row/5,true),upper=capSection((row+1)/5,false);
      for(let k=0;k<4;k++){
        if(head)quad(head[k+1],head[k],mouth[k],mouth[k+1],k===1||k===2?colors.cap:colors.soffit);
        quad(mouth[k+1],mouth[k],upper[k],upper[k+1],colors.edge);
      }
      if(!head)for(let k=1;k<4;k++)tri(mouth[0],mouth[k],mouth[k+1],colors.cap);
      head=upper;
    }
  }
}
