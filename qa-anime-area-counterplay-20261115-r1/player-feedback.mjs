// Local combat marks are driven by actual simulation events. All strokes share one draw call.
const accents=["#ffc779","#80dbff","#bb9cfa","#ffe49b","#ff9276"];
const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
export function playerFeedback(T,scene,ground){
  const point=new T.Vector3(),cache=new Map(),effects=[],labels=[],onScreen=[];
  const maxVertices=1500,positions=new Float32Array(maxVertices*3),colors=new Float32Array(maxVertices*4);
  const geo=new T.BufferGeometry(),pos=new T.BufferAttribute(positions,3),rgb=new T.BufferAttribute(colors,4);
  pos.setUsage(T.DynamicDrawUsage);rgb.setUsage(T.DynamicDrawUsage);geo.setAttribute("position",pos);geo.setAttribute("color",rgb);
  const mat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  const mesh=new T.Mesh(geo,mat);mesh.frustumCulled=false;mesh.renderOrder=8;mesh.visible=false;scene.add(mesh);
  const layer=document.createElement("div");layer.className="field-floats";layer.setAttribute("aria-hidden","true");document.body.appendChild(layer);
  for(let i=0;i<8;i++){
    const node=document.createElement("span"),leader=document.createElement("i");
    leader.className="damage-leader";leader.hidden=node.hidden=true;layer.append(leader,node);labels.push({node,leader,until:-1});
  }
  let last=0,index=0,name=0;
  function push(kind,x,z,angle,t,life,hue,reach=1){
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    if(effects.length>=14)effects.shift();const f={kind,x,z,angle,t,life,hue,reach};effects.push(f);return f;
  }
  function caption(x,z,start,word,kind,y,who=null){
    const f=labels.find(l=>l.until<=start)||labels[name++%labels.length];
    Object.assign(f,{x,z,start,until:start+(kind==="coin"?.92:.53),y,kind,who});f.node.hidden=false;
    f.node.className="field-float "+kind;f.node.textContent=word;
  }
  function consume(match){
    const player=match.units.find(u=>u.id===match.playerId);if(!player)return;
    for(const e of match.events){
      if(e.id<=last)continue;last=e.id;
      const own=e.source===player.id,t=match.time,hue=accents[player.hero]||accents[0];
      if(e.type==="lastCoin"){
        const coin=push("coin",e.x,e.z,0,t,.55,"#f3c15b");
        if(coin){coin.toX=player.x;coin.toZ=player.z;}
        caption(player.x,player.z,t+.29,"补刀 +"+e.coins,"coin",1.74);continue;
      }
      if(!own&&e.target!==player.id)continue;
      if(e.type==="hit"&&e.damage>0){
        const shade=own?hue:"#ff8a7d";
        push("impact",e.targetX,e.targetZ,e.face||0,t,.19,shade,e.targetKind==="tower"?1.35:1);
        caption(e.targetX,e.targetZ,t,String(e.damage),own?"dealt":"taken",e.targetKind==="tower"?2.8:1.56,e.target);
      }else if(own&&e.type==="windup"&&e.actionKind==="attack"){
        push("ready",e.x,e.z,e.face||0,t,e.windup,hue,player.radius);
      }else if(own&&player.hero!==1&&(e.type==="attack"||e.type==="miss")){
        const ranged=player.hero===2||player.hero===3,miss=e.type==="miss";
        push(ranged?"launch":"jab",e.fromX??e.x,e.fromZ??e.z,e.face||0,t,miss?.16:.22,miss?"#aabac1":hue,Math.min(2.3,player.range*.75));
      }
    }
  }
  function coordinates(x,y,z,c,alpha){
    const k=index++;positions[k*3]=x;positions[k*3+1]=y;positions[k*3+2]=z;
    colors[k*4]=c.r;colors[k*4+1]=c.g;colors[k*4+2]=c.b;colors[k*4+3]=alpha;
  }
  function vertex(p,c,alpha){coordinates(p[0],p[1],p[2],c,alpha);}
  function line(a,b,width,hue,alpha){
    if(index+6>maxVertices)return;
    if(!cache.has(hue))cache.set(hue,new T.Color(hue));const c=cache.get(hue);
    const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,nx=-dz*width/len,nz=dx*width/len;
    const p=[a[0]+nx,a[1],a[2]+nz],q=[a[0]-nx,a[1],a[2]-nz],r=[b[0]-nx*.50,b[1],b[2]-nz*.50],s=[b[0]+nx*.50,b[1],b[2]+nz*.50];
    vertex(p,c,alpha);vertex(q,c,alpha);vertex(r,c,alpha);vertex(r,c,alpha);vertex(s,c,alpha);vertex(p,c,alpha);
  }
  function paint(f,u){
    const y=ground(f.x,f.z),sin=Math.sin(f.angle),cos=Math.cos(f.angle);
    const loc=(forward,side,height)=>[f.x+sin*forward+cos*side,y+height,f.z+cos*forward-sin*side];
    const fade=1-u;
    if(f.kind==="coin"){
      const smooth=u*u*(3-2*u),lift=Math.sin(Math.PI*u);
      const x=f.x+(f.toX-f.x)*smooth,z=f.z+(f.toZ-f.z)*smooth;
      const h=ground(x,z)+.32+lift*.96+u*.61;
      const rx=.19*(.67+.33*Math.cos(u*9)),rise=.17;
      for(let j=0;j<8;j++){
        const a=j*Math.PI/4,b=a+Math.PI/4;
        const pt=k=>[x+rx*Math.cos(k),h+rise*Math.sin(k),z-.065*Math.sin(k)];
        line(pt(a),pt(b),.043,j<4?"#fff3a8":"#d49132",.95);
      }
      if(u<.4){
        const pulse=.25+.65*u;
        for(let j=0;j<4;j++){
          const a=j*Math.PI/2;line([f.x+pulse*Math.cos(a),y+.15,f.z+pulse*Math.sin(a)],
            [f.x+(pulse+.14)*Math.cos(a),y+.15,f.z+(pulse+.14)*Math.sin(a)],.035,"#ffe58e",1-u*2);
        }
      }
    }else if(f.kind==="walk"||f.kind==="pick"||f.kind==="ready"){
      const isReady=f.kind==="ready",r=isReady?f.reach*(1.55-.30*u):.32+.52*u;
      for(let j=0;j<4;j++){
        const a=j*Math.PI*.5+.16;
        if(isReady&&j>1)break;
        const lift=isReady?.19:.13;
        for(let k=0;k<4;k++){
          const l=a+k*.23,h=l+.23;
          line(loc(Math.sin(l)*r,Math.cos(l)*r,lift),loc(Math.sin(h)*r,Math.cos(h)*r,lift),isReady?.035:.052,f.hue,isReady?.4+.57*u:fade);
        }
      }
    }else if(f.kind==="impact"){
      for(let j=0;j<6;j++){
        const a=j*1.047+.20,l=(.25+.54*u)*(j%2?.82:1.18)*f.reach;
        const h=.89+(j%3)*.11;
        line(loc(Math.cos(a)*l*.35,Math.sin(a)*l*.35,h),loc(Math.cos(a)*l,Math.sin(a)*l,h+.16+u*.13),.067*fade+.012,j%2?f.hue:"#fff4ce",fade);
      }
    }else{
      const thrust=f.kind==="launch"?.72:f.reach,front=.36+thrust*(.58+.42*u);
      for(let j=-1;j<=1;j++)line(loc(front-.55*fade,j*.065,.89+j*.13),loc(front,j*.10,1.02+j*.13),j===0?.059:.025,j===0?"#fff0cd":f.hue,fade);
    }
  }
  function draw(match,camera,width,height){
    consume(match);const t=match.time;index=0;
    const hero=match.units.find(u=>u.id===match.playerId);
    if(hero?.recall){
      const progress=clamp((t-hero.recall.start)/5),yy=ground(hero.x,hero.z)+.13;
      for(let j=0;j<36*progress;j++){const a=j*Math.PI/18,b=Math.min(j+1,36*progress)*Math.PI/18;
        line([hero.x+1.22*Math.cos(a),yy,hero.z+1.22*Math.sin(a)],[hero.x+1.22*Math.cos(b),yy,hero.z+1.22*Math.sin(b)],.054,"#c2ffef",.93);}
    }
    for(let i=effects.length-1;i>=0;i--){const f=effects[i],u=(t-f.t)/f.life;if(u>=1){effects.splice(i,1);continue;}paint(f,clamp(u));}
    mesh.visible=index>0;if(index){geo.setDrawRange(0,index);pos.needsUpdate=true;rgb.needsUpdate=true;}
    onScreen.length=0;
    for(const f of labels){
      f.leader.hidden=true;
      if(f.until<=t||t<f.start){if(!f.node.hidden)f.node.hidden=true;continue;}
      const u=clamp((t-f.start)/(f.until-f.start));
      if(f.who!=null){const target=match.units.find(a=>a.id===f.who);if(target){f.x=target.x;f.z=target.z;}}
      const floor=ground(f.x,f.z);point.set(f.x,floor+f.y+u*.87,f.z).project(camera);
      const inShot=point.z>=-1&&point.z<=1&&Math.abs(point.x)<=.98&&Math.abs(point.y)<=.96;f.node.hidden=!inShot;
      if(!inShot)continue;
      f.px=f.drawX=(point.x*.5+.5)*width;f.py=(.5-point.y*.5)*height;f.u=u;f.crowded=false;
      point.set(f.x,floor+f.y*.65,f.z).project(camera);f.contactY=(.5-point.y*.5)*height;onScreen.push(f);
    }
    onScreen.sort((a,b)=>a.px-b.px||(a.who??0)-(b.who??0));
    for(let j=1;j<onScreen.length;j++){
      const l=onScreen[j-1],r=onScreen[j];if(l.kind==="coin"||r.kind==="coin"||l.who===r.who||Math.abs(l.py-r.py)>27)continue;
      const gap=r.drawX-l.drawX;if(gap>=30)continue;
      const push=(30-gap)*.5;l.drawX-=push;r.drawX+=push;l.crowded=r.crowded=true;
    }
    for(const f of onScreen){
      f.drawX=clamp(f.drawX,16,width-16);const opacity=Math.min(1,(1-f.u)*3);
      f.node.style.transform="translate("+f.drawX.toFixed(1)+"px,"+f.py.toFixed(1)+"px) translate(-50%,-70%) scale("+(1+.20*Math.sin(Math.PI*Math.min(1,f.u*3))).toFixed(2)+")";f.node.style.opacity=String(opacity);
      if(!f.crowded)continue;
      const dx=f.px-f.drawX,dy=f.contactY-f.py-2;
      f.leader.hidden=false;f.leader.style.width=Math.hypot(dx,dy).toFixed(1)+"px";f.leader.style.opacity=String(opacity*.87);
      f.leader.style.transform="translate("+f.drawX.toFixed(1)+"px,"+(f.py+2).toFixed(1)+"px) rotate("+Math.atan2(dy,dx)+"rad)";
    }
  }
  function reset(){last=0;effects.length=0;mesh.visible=false;for(const f of labels){f.until=-1;f.node.hidden=f.leader.hidden=true;}}
  return {draw,reset,point(x,z,hostile,t){push(hostile?"pick":"walk",x,z,0,t,.43,hostile?"#ff947e":"#b9ffdf");},
    dispose(){layer.remove();scene.remove(mesh);geo.dispose();mat.dispose();}};
}
