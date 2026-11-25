import {laneCompany} from "./lane-company.mjs?v=canyon-silhouette1";
export function makeWaveBatches(T,scene,heightAt,markFighter) {
  const company=laneCompany(T,scene,heightAt,markFighter);
  return {start:company.start,draw:company.draw,reset:company.reset,dispose:company.dispose,
    protect(box,canvas){company.protect(box,canvas.clientWidth,canvas.clientHeight);}};
}
// One camera-facing batch. The fill changes on the damage frame and the amber edge
// briefly holds its old position, so a player can see how much that strike took.
export function placeClearBar(box,reserved,width,height){
  const left=box.left,right=box.right,top=box.top,bottom=box.bottom;
  const blocked=(x,y)=>reserved.some(o=>right+x>o.left-1&&left+x<o.right+1&&bottom+y>o.top-1&&top+y<o.bottom+1);
  if(!blocked(0,0))return true;
  let best=Infinity,bx=0,by=0;
  function tryPlace(x,y){
    const cost=Math.abs(y)+Math.abs(x)*1.24+(y>0?8:0);
    if(cost>=best||left+x<1||right+x>width-1||top+y<1||bottom+y>height-1||blocked(x,y))return;
    best=cost;bx=x;by=y;
  }
  for(const o of reserved){
    tryPlace(0,o.top-bottom-3);tryPlace(o.left-right-3,0);
    tryPlace(o.right-left+3,0);tryPlace(0,o.bottom-top+3);
  }
  if(best===Infinity)for(const a of reserved)for(const b of reserved){
    tryPlace(a.left-right-3,b.top-bottom-3);tryPlace(a.right-left+3,b.top-bottom-3);
    tryPlace(a.left-right-3,b.bottom-top+3);tryPlace(a.right-left+3,b.bottom-top+3);
  }
  if(best===Infinity)return false;
  box.left+=bx;box.right+=bx;box.top+=by;box.bottom+=by;
  return true;
}

export function unitBars(T,scene){
  const unitPoint=new T.Vector3(),size={w:0,h:0},pool=new Map();
  const sheet=document.createElement("canvas");
  sheet.width=32*16;sheet.height=32;
  const pen=sheet.getContext("2d");
  pen.fillStyle="#fff";pen.font="bold 25px system-ui";pen.textAlign="center";pen.textBaseline="middle";
  for(let level=1;level<=15;level++)pen.fillText(String(level),level*32+16,16.5,29);
  const digits=new T.CanvasTexture(sheet);
  digits.generateMipmaps=false;digits.minFilter=T.LinearFilter;
  const uniforms={viewport:{value:new T.Vector2(1,1)},digitAtlas:{value:digits}};
  const reserved=[],seenRoots=new WeakMap();
  const material=new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
    vertexShader:`attribute vec4 life;attribute vec4 metrics;attribute vec2 nudge;
      uniform vec2 viewport;varying vec2 panelUV;varying vec4 barLife;varying vec4 barMetrics;
      void main(){
        panelUV=uv;barLife=life;barMetrics=metrics;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        float badge=metrics.w>.5?metrics.y*2.12:metrics.z>3.5?metrics.y*1.87:0.;
        vec2 outer=vec2(metrics.x+badge,max(metrics.y,badge));
        gl_Position.xy+=(position.xy*outer-vec2(.5*badge,0.)+nudge)*2./viewport*gl_Position.w;
      }`,
    fragmentShader:`varying vec2 panelUV;varying vec4 barLife;varying vec4 barMetrics;
      uniform sampler2D digitAtlas;
      float stroke(vec2 p,vec2 a,vec2 b){
        vec2 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.));
      }
      void main(){
        vec2 wh=barMetrics.xy;
        float badge=barMetrics.w>.5?wh.y*2.12:barMetrics.z>3.5?wh.y*1.87:0.;
        vec2 whole=vec2(wh.x+badge,max(wh.y,badge)),p=panelUV*whole;
        if(badge>0.&&p.x<badge){
          vec2 local=p/badge;
          if(barMetrics.z>3.5){
            vec2 q=vec2(abs(local.x-.5),local.y);
            float outer=length((local-.5)*vec2(.98,1.05));
            float fade=1.-smoothstep(.42,.51,outer);if(fade<.02)discard;
            bool deer=barMetrics.z>4.5;
            float mark=deer?min(stroke(q,vec2(.05,.28),vec2(.23,.74)),
              stroke(q,vec2(.145,.52),vec2(.29,.58))):
              min(stroke(q,vec2(.04,.35),vec2(.20,.43)),stroke(q,vec2(.20,.43),vec2(.25,.65)));
            vec3 trim=deer?vec3(.68,.84,.70):vec3(.91,.71,.44);
            vec3 base=mix(vec3(.13,.17,.14),trim,smoothstep(.34,.43,outer));
            gl_FragColor=vec4(mix(base,vec3(.99,.93,.77),1.-smoothstep(.034,.092,mark)),fade);return;
          }
          float d=length((local-.5)*badge),radius=badge*.48;
          float aa=clamp(fwidth(d),.65,1.4);
          float alpha=1.-smoothstep(radius-aa*.55,radius+aa*.45,d);
          if(alpha<.015)discard;
          vec3 metal=mix(vec3(.49,.39,.20),vec3(.96,.88,.61),local.y);
          vec3 face=mix(vec3(.11,.18,.19),metal,smoothstep(radius-1.85,radius-.75,d));
          float glyph=texture2D(digitAtlas,vec2((barMetrics.w+local.x)/16.,local.y)).a;
          gl_FragColor=vec4(mix(face,vec3(1.,.97,.83),glyph),alpha);return;
        }
        p-=vec2(badge,(whole.y-wh.y)*.5);
        if(p.y<0.||p.y>wh.y)discard;
        vec2 uv=p/wh;
        float cut=max(abs(uv.x-.5)*wh.x+abs(uv.y-.5)*wh.y-(wh.x+wh.y)*.5+1.45,0.);
        float a=1.-smoothstep(.05,1.05,cut);
        vec2 edge=min(p,wh-p);
        float border=min(edge.x,edge.y);
        vec3 colour=mix(vec3(.055,.09,.12),vec3(.21,.28,.32),uv.y);
        float x=clamp((p.x-1.6)/(wh.x-3.2),0.,1.);
        float band=smoothstep(.65,1.45,border);
        float role=barMetrics.z;
        vec3 ink=role<.5?vec3(.65,.86,.37):role<1.5?vec3(.20,.72,.88):role<2.5?vec3(.93,.35,.34):role>4.5?vec3(.51,.79,.64):vec3(.90,.65,.28);
        float glint=smoothstep(.48,.85,uv.y),aa=1./wh.x;
        vec3 fill=mix(ink*.72,min(vec3(1.),ink*1.13+.04),uv.y*.56+glint*.44);
        float tail=1.-smoothstep(barLife.y-aa,barLife.y+aa,x);
        float shield=1.-smoothstep(barLife.z-aa,barLife.z+aa,x);
        float hp=1.-smoothstep(barLife.x-aa,barLife.x+aa,x);
        vec3 inside=mix(vec3(.087,.125,.145),vec3(1.,.73,.36),tail);
        inside=mix(inside,mix(vec3(.67,.84,.91),vec3(.91,.97,1.),step(.70,fract((p.x-p.y)/4.))),shield);
        fill=mix(fill,vec3(1.,.97,.81),barLife.w*.62);
        inside=mix(inside,fill,hp);
        float lost=step(.018,barLife.y-barLife.z);
        float cutEdge=(1.-smoothstep(.25,1.55,abs(x-barLife.z)*wh.x))*lost;
        inside=mix(inside,vec3(1.,.96,.75),cutEdge*.88);
        float ticks=(1.-smoothstep(.03,.10,abs(fract(x*4.+.5)-.5)))*smoothstep(.48,.79,uv.y)*step(.02,x)*step(x,.98);
        inside=mix(inside,vec3(.13,.19,.20),ticks*.48);
        colour=mix(colour,inside,band);
        gl_FragColor=vec4(colour,a*.98);
      }`
  });
  const base=new T.PlaneGeometry(1,1),matrix=new T.Matrix4();
  let mesh,geometry,life,metrics,nudge,capacity=0,seen=0,priorTime=-1;
  function release(){
    if(!mesh)return;
    mesh.removeFromParent();mesh.dispose();geometry.dispose();mesh=null;
  }
  function reserve(n){
    if(n<=capacity)return;
    release();capacity=Math.max(n,32,capacity*2);geometry=base.clone();
    life=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);
    metrics=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);
    nudge=new T.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('life',life);geometry.setAttribute('metrics',metrics);geometry.setAttribute('nudge',nudge);
    mesh=new T.InstancedMesh(geometry,material,capacity);mesh.frustumCulled=false;mesh.count=0;
    mesh.name='英雄与建筑血条';mesh.renderOrder=7;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
  }
  function anchor(root,kind){
    const p=root.position,s=root.scale;
    const height=root.userData.barHeight??(kind==='hero'?2.90:kind==='keeper'?1.78:4.40);
    return unitPoint.set(p.x,p.y+height*s.y,p.z);
  }
  function measure(root,kind,camera,width,height){
    anchor(root,kind).applyMatrix4(camera.matrixWorldInverse);
    const pixel=height*camera.projectionMatrix.elements[5]/(2*Math.max(.2,-unitPoint.z));
    const phone=width<600,hero=kind==='hero';
    size.w=Math.min(phone?47:72,Math.max(phone?31:40,pixel*(hero?1.58:1.84)*root.scale.x));
    size.h=phone?5.8:7;
    size.nameWidth=Math.min(width<620?Math.min(65,width*.20):79,2.28*pixel*root.scale.x);
  }
  function draw(units,models,playerId,now,camera,width,height,level=1,bodyBox=null,faces=[],placeName=null){
    if(now<priorTime)pool.clear();priorTime=now;
    reserved.length=0;if(bodyBox)reserved.push(bodyBox);
    for(const face of faces)reserved.push(face);
    uniforms.viewport.value.set(Math.max(width,1),Math.max(height,1));reserve(models.size);
    if(!mesh)return;
    const stamp=++seen;let used=0;
    const player=units.find(u=>u.id===playerId);
    for(let i=-1;i<units.length;i++){
      const u=i<0?player:units[i];
      if(!u||i>=0&&u.id===playerId)continue;
      if(u.kind==='minion'||u.sceneryOnly||u.dead||u.hp<=0)continue;
      const model=models.get(u.id),root=model?.g;if(!root?.visible)continue;
      let s=pool.get(u.id);
      if(!s){s={last:u.hp,trail:u.hp,struck:-10,time:now,stamp,box:{},pair:{},name:{}};pool.set(u.id,s);}
      if(u.hp<s.last-.01){s.trail=Math.max(s.trail,s.last);s.struck=now;}
      else if(now-s.struck>.28)s.trail=Math.max(u.hp,s.trail-u.maxHp*Math.min(.08,Math.max(0,now-s.time))*.95);
      s.last=u.hp;s.time=now;s.stamp=stamp;
      const shield=Math.max(0,u.shield||0),total=Math.max(u.maxHp,u.hp+shield);
      measure(root,u.kind,camera,width,height);anchor(root,u.kind);matrix.makeTranslation(unitPoint.x,unitPoint.y,unitPoint.z);
      unitPoint.project(camera);
      const x=(.5+.5*unitPoint.x)*width,y=(.5-.5*unitPoint.y)*height;
      const rank=u.kind==="hero"?Math.min(15,Math.max(1,u.level||(u.id===playerId?level:1))):0;
      const badge=rank?size.h*2.12:u.kind==="camp"?size.h*1.87:0,outerH=Math.max(size.h,badge);
      const left=x-size.w*.5-badge,top=y-outerH*.5;
      const box=s.box;box.left=left;box.right=x+size.w*.5;box.top=top;box.bottom=y+outerH*.5;
      if(box.right>0&&box.left<width&&box.bottom>0&&box.top<height&&unitPoint.z<1&&unitPoint.z>-1){
        const showName=placeName&&model.identity?.group.visible;
        const nameWidth=showName?size.nameWidth:0,nameHeight=nameWidth*.62/2.28;
        const middle=(box.left+box.right)*.5,nameLeft=middle-nameWidth*.5;
        const pair=s.pair;
        const panelLeft=Math.min(left,nameLeft),panelTop=showName?top-nameHeight-2:top;
        pair.left=panelLeft;pair.right=Math.max(box.right,middle+nameWidth*.5);
        pair.top=panelTop;pair.bottom=box.bottom;
        const edgeX=Math.max(0,1-pair.left)+Math.min(0,width-1-pair.right);
        const edgeY=Math.max(0,1-pair.top)+Math.min(0,height-1-pair.bottom);
        pair.left+=edgeX;pair.right+=edgeX;pair.top+=edgeY;pair.bottom+=edgeY;
        const fits=placeClearBar(pair,reserved,width,height);
        if(fits){
          const dx=pair.left-panelLeft,dy=pair.top-panelTop;
          box.left+=dx;box.right+=dx;box.top+=dy;box.bottom+=dy;
          if(showName){
            const name=s.name;name.left=nameLeft+dx;name.right=name.left+nameWidth;
            name.top=pair.top;name.bottom=box.top-2;
            placeName(model.identity,root,camera,width,height,name);
          }
          reserved.push(pair);
        }else{
          if(showName)model.identity.group.visible=false;
          placeClearBar(box,reserved,width,height);reserved.push(box);
        }
      }else if(model.identity)model.identity.group.visible=false;
      seenRoots.set(root,s);
      nudge.setXY(used,box.left-left,top-box.top);
      mesh.setMatrixAt(used,matrix);
      life.setXYZW(used,u.hp/total,Math.min(1,(Math.max(u.hp,s.trail)+shield)/total),(u.hp+shield)/total,Math.max(0,1-(now-s.struck)/.14));
      const role=u.id===playerId?0:u.team===0?1:u.team===1?2:u.kind!=="camp"?3:u.species==="boar"?4:5;
      metrics.setXYZW(used,size.w,size.h,role,rank);used++;
    }
    for(const [key,s] of pool)if(s.stamp!==stamp)pool.delete(key);
    mesh.count=used;mesh.visible=used>0;
    if(used)for(const a of [mesh.instanceMatrix,life,metrics,nudge]){
      a.clearUpdateRanges();a.addUpdateRange(0,used*a.itemSize);a.needsUpdate=true;
    }
  }
  function projectHero(root,camera,width,height,out){
    if(!root?.visible)return false;
    const state=seenRoots.get(root);if(!state||state.stamp!==seen)return false;
    const b=state.box;out.barLeft=b.left;out.barRight=b.right;out.barTop=b.top;out.barBottom=b.bottom;return true;
  }
  return {draw,projectHero,reserved,reset(){pool.clear();reserved.length=0;priorTime=-1;if(mesh){mesh.count=0;mesh.visible=false;}},
    dispose(){release();base.dispose();material.dispose();digits.dispose();pool.clear();}};
}
