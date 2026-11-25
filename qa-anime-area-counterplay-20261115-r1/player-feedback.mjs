// Local combat marks are driven by actual simulation events. All strokes share one draw call.
const accents=["#ffc779","#80dbff","#bb9cfa","#ffe49b","#ff9276"];
const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
const labelPriority={ "hero-hit":3, taken:2, coin:2, missed:1, dealt:1, "minion-hit":0 };
const labelRows=[0,-1,1,-2,2,-3,3,-4,4];
export function playerFeedback(T,scene,ground,roster=[],showNamedHit=null){
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
  const panels=["top","objective","routeHint"].map(id=>document.getElementById?.(id)).filter(Boolean);
  let reserved=[],layoutDirty=true,lastWidth=0,lastHeight=0;
  function invalidateLayout(){layoutDirty=true;}
  const sizeWatcher=typeof ResizeObserver==="function"?new ResizeObserver(invalidateLayout):null;
  const stateWatcher=typeof MutationObserver==="function"?new MutationObserver(invalidateLayout):null;
  for(const panel of panels){
    sizeWatcher?.observe(panel);
    stateWatcher?.observe(panel,{attributes:true,attributeFilter:["class","hidden"]});
  }
  function hudBoxes(width,height){
    if(layoutDirty||width!==lastWidth||height!==lastHeight){
      lastWidth=width;lastHeight=height;layoutDirty=false;
      reserved=panels.filter(p=>!p.hidden).map(p=>p.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
    }
    return reserved;
  }
  let last=0,index=0;
  function push(kind,x,z,angle,t,life,hue,reach=1){
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    if(effects.length>=14)effects.shift();const f={kind,x,z,angle,t,life,hue,reach};effects.push(f);return f;
  }
  function caption(x,z,now,word,kind,y,who=null,heroName=""){
    const priority=labelPriority[kind];
    let f=labels.find(label=>label.until<=now);
    if(!f){
      f=labels.reduce((a,b)=>b.priority<a.priority||(b.priority===a.priority&&b.until<a.until)?b:a);
      if(f.priority>priority)return;
    }
    const start=now+(kind==="coin" ? .29 : 0);
    const life=heroName ? .68 : kind==="coin" ? .92 : .53;
    Object.assign(f,{x,z,start,until:start+life,y,kind,who,heroName,word,priority});
    f.node.className="field-float "+kind;f.node.textContent=word;f.node.dataset.hero=heroName;
    f.leader.className=heroName?"damage-leader hero-leader":"damage-leader";
    f.node.hidden=start>now;
  }
  function consume(match){
    const player=match.units.find(u=>u.id===match.playerId);if(!player)return;
    for(const e of match.events){
      if(e.id<=last)continue;last=e.id;
      const own=e.source===player.id,t=match.time,hue=accents[player.hero]||accents[0];
      if(e.type==="lastCoin"){
        const coin=push("coin",e.x,e.z,0,t,.55,"#f3c15b");
        if(coin){coin.toX=player.x;coin.toZ=player.z;}
        caption(player.x,player.z,t,"补刀 +"+e.coins,"coin",1.74);continue;
      }
      if(!own&&e.target!==player.id)continue;
      if(e.type==="hit"&&e.damage>0){
        const shade=own?hue:"#ff8a7d";
        push("impact",e.targetX,e.targetZ,e.face||0,t,.19,shade,e.targetKind==="tower"?1.35:1);
        const heroName=own&&e.targetKind==="hero"?(roster[e.targetHero]?.name||"敌将"):"";
        const kind=heroName?"hero-hit":!own?"taken":e.targetKind==="minion"?"minion-hit":"dealt";
        const lift=heroName?2.16:e.targetKind==="tower"?2.8:kind==="minion-hit"?1.04:1.56;
        caption(e.targetX,e.targetZ,t,String(e.damage),kind,lift,e.target,heroName);
      }else if(own&&e.type==="miss"&&e.gadget==="air"){
        push("emptyAir",e.targetX,e.targetZ,e.face||0,t,.37,"#a6d7da");
        const dx=e.targetX-e.fromX,dz=e.targetZ-e.fromZ,length=Math.hypot(dx,dz)||1;
        const near=Math.min(3.3,length)/length;
        caption(e.fromX+dx*near,e.fromZ+dz*near,t,"落空","missed",1.12);
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
    }else if(f.kind==="emptyAir"){
      for(const side of [-1,1]){
        const spread=side*(.13+.43*u),front=.10+.36*u;
        line(loc(front-.42,spread*.62,.80),loc(front,spread,1.03+.07*u),.071*fade+.014,f.hue,fade);
        line(loc(front,spread,1.03+.07*u),loc(front+.17,spread*1.67,1.10+.17*u),.050*fade+.010,f.hue,fade*.82);
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
    // These marks reuse the combat stroke batch and stay on the tower side of the player's feet.
    if(hero && !hero.dead) {
      for(const lane of match.fieldKeeps[1-hero.team]) for(const tower of lane) {
        const primed=tower.action?.phase==="windup" && tower.action.target===hero.id;
        if(tower.dead || (tower.guardTargetId!==hero.id && !primed))continue;
        const dx=tower.x-hero.x,dz=tower.z-hero.z,len=Math.hypot(dx,dz)||1;
        const ux=dx/len,uz=dz/len;
        const mark=(forward,side)=>{
          const x=hero.x+ux*forward+uz*side,z=hero.z+uz*forward-ux*side;
          return [x,ground(x,z)+.16,z];
        };
        const tip=mark(.79,0),left=mark(1.27,-.34),right=mark(1.27,.34);
        line(left,tip,.105,"#792b2a",.96);line(right,tip,.105,"#792b2a",.96);
        line(left,tip,.058,"#ffe3a1",1);line(right,tip,.058,"#ffe3a1",1);
        if(primed)line(mark(1.54,0),mark(1.31,0),.072,"#ff695c",1);
      }
    }
    if(hero?.recall){
      const progress=clamp((t-hero.recall.start)/5),yy=ground(hero.x,hero.z)+.13;
      for(let j=0;j<36*progress;j++){const a=j*Math.PI/18,b=Math.min(j+1,36*progress)*Math.PI/18;
        line([hero.x+1.22*Math.cos(a),yy,hero.z+1.22*Math.sin(a)],[hero.x+1.22*Math.cos(b),yy,hero.z+1.22*Math.sin(b)],.054,"#c2ffef",.93);}
    }
    for(let i=effects.length-1;i>=0;i--){const f=effects[i],u=(t-f.t)/f.life;if(u>=1){effects.splice(i,1);continue;}paint(f,clamp(u));}
    mesh.visible=index>0;if(index){geo.setDrawRange(0,index);pos.needsUpdate=true;rgb.needsUpdate=true;}
    onScreen.length=0;
    for(const f of labels){
      if(f.until<=t||t<f.start){
        if(!f.node.hidden)f.node.hidden=true;
        if(!f.leader.hidden)f.leader.hidden=true;
        continue;
      }
      const u=clamp((t-f.start)/(f.until-f.start));
      if(f.who!=null){const target=match.units.find(a=>a.id===f.who);if(target){f.x=target.x;f.z=target.z;}}
      const floor=ground(f.x,f.z);point.set(f.x,floor+f.y+u*.87,f.z).project(camera);
      const inShot=point.z>=-1&&point.z<=1&&Math.abs(point.x)<=.98&&Math.abs(point.y)<=.96;
      if(f.node.hidden===inShot)f.node.hidden=!inShot;
      if(!inShot){if(!f.leader.hidden)f.leader.hidden=true;continue;}
      f.px=(point.x*.5+.5)*width;f.py=(.5-point.y*.5)*height;f.u=u;
      const font=clamp(width*.0125,14,21),pop=1+.20*Math.sin(Math.PI*Math.min(1,u*3));
      const textWidth=f.kind==="coin"?font*(f.word.length+.8):font*.78*f.word.length+5;
      f.halfWidth=(f.heroName?f.heroName.length*11+f.word.length*14+22:textWidth)*pop*.5;
      f.boxHeight=(f.heroName?26:font+3)*pop;f.pop=pop;
      point.set(f.x,floor+f.y*.65,f.z).project(camera);
      f.contactX=(point.x*.5+.5)*width;f.contactY=(.5-point.y*.5)*height;onScreen.push(f);
    }
    for(const f of onScreen){
      f.hasBar=Boolean(f.heroName&&showNamedHit&&showNamedHit(f.who,camera,width,height,f));
    }
    onScreen.sort((a,b)=>b.priority-a.priority||a.start-b.start||(a.who??0)-(b.who??0));
    const fixed=onScreen.length?hudBoxes(width,height):[];
    for(let j=0;j<onScreen.length;j++){
      const f=onScreen[j],margin=f.halfWidth+3;
      f.drawX=clamp(f.px,margin,width-margin);
      // Keep the highest-priority label over its target. Fit later labels against the
      // eight pooled screen boxes without triggering DOM measurement during combat.
      let best=Infinity;
      for(const row of labelRows){
        const home=f.hasBar?Math.min(f.py,f.barTop-6):f.py;
        const y=clamp(home+row*(f.boxHeight+3),f.boxHeight+3,height-3);
        let overlap=0;
        for(const box of fixed){
          const across=Math.min(f.drawX+f.halfWidth,box.right+3)-Math.max(f.drawX-f.halfWidth,box.left-3);
          const down=Math.min(y,box.bottom+3)-Math.max(y-f.boxHeight,box.top-3);
          if(across>0&&down>0)overlap+=9*across*down;
        }
        for(const owner of onScreen){
          if(!owner.hasBar)continue;
          const across=Math.min(f.drawX+f.halfWidth,owner.barRight+3)-Math.max(f.drawX-f.halfWidth,owner.barLeft-3);
          const down=Math.min(y,owner.barBottom+3)-Math.max(y-f.boxHeight,owner.barTop-3);
          if(across>0&&down>0)overlap+=4*across*down;
        }
        for(let k=0;k<j;k++){
          const other=onScreen[k];
          const across=f.halfWidth+other.halfWidth+3-Math.abs(other.drawX-f.drawX);
          const down=Math.min(y,other.drawY)-Math.max(y-f.boxHeight,other.drawY-other.boxHeight)+3;
          if(across>0&&down>0)overlap+=across*down;
        }
        if(overlap<best){f.drawY=y;best=overlap;}
        if(overlap===0)break;
      }
      const opacity=Math.min(1,(1-f.u)*3);
      f.node.style.transform="translate("+f.drawX.toFixed(1)+"px,"+f.drawY.toFixed(1)+"px) translate(-50%,-100%) scale("+f.pop.toFixed(2)+")";f.node.style.opacity=String(opacity);
      const showLeader=Boolean(f.heroName)||Math.abs(f.drawY-f.py)>=2||Math.abs(f.drawX-f.px)>=2;
      if(f.leader.hidden===showLeader)f.leader.hidden=!showLeader;
      if(!showLeader)continue;
      let sx=f.drawX,sy=f.drawY+2;
      if(f.hasBar && sy<=f.barBottom+3 && f.contactY>f.barBottom+3){
        const cut=f.barBottom+3,dxAtBar=(f.contactX-sx)*(cut-sy)/(f.contactY-sy);
        if(sx+dxAtBar>=f.barLeft-3&&sx+dxAtBar<=f.barRight+3){sx+=dxAtBar;sy=cut;}
      }
      const dx=f.contactX-sx,dy=f.contactY-sy;
      f.leader.style.width=Math.hypot(dx,dy).toFixed(1)+"px";f.leader.style.opacity=String(opacity*.87);
      f.leader.style.transform="translate("+sx.toFixed(1)+"px,"+sy.toFixed(1)+"px) rotate("+Math.atan2(dy,dx)+"rad)";
    }
  }
  function reset(){last=0;effects.length=0;mesh.visible=false;for(const f of labels){f.until=-1;f.node.hidden=f.leader.hidden=true;}}
  return {draw,reset,point(x,z,hostile,t){push(hostile?"pick":"walk",x,z,0,t,.43,hostile?"#ff947e":"#b9ffdf");},
    dispose(){sizeWatcher?.disconnect();stateWatcher?.disconnect();layer.remove();scene.remove(mesh);geo.dispose();mat.dispose();}};
}
