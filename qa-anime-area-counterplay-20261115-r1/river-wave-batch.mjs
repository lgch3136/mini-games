import {buildLaneGeometry} from "./lane-minions.mjs?v=river-marching6";
import {laneCompany} from "./lane-company.mjs?v=canyon-look2";

// Bodies, walking feet and health bars keep their original shapes and colours.
// One set of instance matrices per faction replaces five individual meshes per soldier.
export function makeWaveBatches(T,scene,heightAt,prepare) {
  const rig=new T.Object3D(),part=new T.Object3D(),world=new T.Matrix4(),actors=new Map();
  const company=laneCompany(T,scene,heightAt);
  let drewFallback=false;
  const barShape=new T.BoxGeometry(1,1,1);
  const barMaterial=new T.MeshStandardMaterial({roughness:.78});
  const clearBody={value:new T.Vector4(-5,-5,-5,-5)};
  barMaterial.onBeforeCompile=shader=>{
    shader.uniforms.clearBody=clearBody;
    shader.fragmentShader='uniform vec4 clearBody;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nif(all(greaterThan(gl_FragCoord.xy,clearBody.xy))&&all(lessThan(gl_FragCoord.xy,clearBody.zw)))discard;');
  };
  const backs=new T.Color("#162735"),fills=[new T.Color("#6eecd3"),new T.Color("#ff6377")];
  const teams=[0,1].map(team=>{
    const shapes=buildLaneGeometry(T,team);
    const cloth=new T.MeshStandardMaterial({vertexColors:true,roughness:.83,metalness:.08,flatShading:true});
    return {shapes,cloth,capacity:0,used:0,team};
  });
  function releaseMeshes(group) {
    for(const mesh of [group.bodies,group.feet,group.bars]){
      if(!mesh)continue;
      scene.remove(mesh);mesh.dispose();
    }
  }
  function reserve(group,count) {
    if(group.capacity>=count)return;
    releaseMeshes(group);
    const cap=Math.max(18,count,group.capacity*2);
    function batch(geometry,material,capacity,shadow){
      const mesh=new T.InstancedMesh(geometry,material,capacity);
      mesh.name="兵线"+group.team;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=shadow;mesh.receiveShadow=true;
      prepare?.(mesh);scene.add(mesh);return mesh;
    }
    group.bodies=batch(group.shapes.body,group.cloth,cap,true);
    group.feet=batch(group.shapes.foot,group.cloth,cap*2,true);
    group.bars=batch(barShape,barMaterial,cap*2,false);
    for(let i=0;i<cap;i++){group.bars.setColorAt(i*2,backs);group.bars.setColorAt(i*2+1,fills[group.team]);}
    group.bars.instanceColor.needsUpdate=true;group.capacity=cap;
  }
  function place(mesh,index,x,y,z,rx,ry,sx=1,sy=1,sz=1,parent=null){
    part.position.set(x,y,z);part.rotation.set(rx,ry,0);part.scale.set(sx,sy,sz);part.updateMatrix();
    if(parent){world.multiplyMatrices(parent,part.matrix);mesh.setMatrixAt(index,world);}
    else mesh.setMatrixAt(index,part.matrix);
  }
  let serial=0;const impactColour=new T.Color();
  function draw(match,dt,visible) {
    if(company.ready&&company.draw(match,dt,visible)){
      if(drewFallback){clearFallback();drewFallback=false;}
      return;
    }
    company.reset();drewFallback=true;
    serial++;
    for(const team of teams)team.used=0;
    for(const unit of match.units)if(unit.kind==="minion"&&!unit.dead&&unit.hp>0)teams[unit.team].used++;
    for(const team of teams){reserve(team,team.used);team.used=0;team.wounded=0;}
    for(const u of match.units){
      if(u.kind!=="minion"||u.dead||u.hp<=0||visible&&!visible(u.x,u.z))continue;
      const team=teams[u.team],slot=team.used++;
      let pose=actors.get(u.id);
      if(!pose){pose={x:u.x,z:u.z,phase:u.id*.9,strength:0,yaw:Number.isFinite(u.face)?u.face:(u.team?-1:1)*Math.PI/2};actors.set(u.id,pose);}
      const dx=u.x-pose.x,dz=u.z-pose.z,distance=Math.hypot(dx,dz);
      if(dt>0){
        if(distance>.002&&distance<1.5){pose.phase+=distance*7.5;pose.strength=Math.min(1,pose.strength+distance*6);pose.yaw=Math.atan2(dx,dz);}
        else{pose.strength=Math.max(0,pose.strength-dt*8);if(u.attackT>0&&Number.isFinite(u.face))pose.yaw=u.face;}
      }
      pose.x=u.x;pose.z=u.z;pose.seen=serial;
      const step=Math.sin(pose.phase)*pose.strength,y=heightAt(u.x,u.z),jab=u.attackT>0?.075*Math.sin(Math.PI*Math.min(1,u.attackT/.3)):0;
      const elapsed=match.time-(u.lastImpactTime??-1),flash=elapsed<.145&&elapsed>=0?1-elapsed/.145:0;
      impactColour.setRGB((u.tideRam?1.32:1)+.88*flash,(u.tideRam?1.06:1)+.58*flash,(u.tideRam?.71:1)+.31*flash);
      team.bodies.setColorAt(slot,impactColour);team.feet.setColorAt(slot*2,impactColour);team.feet.setColorAt(slot*2+1,impactColour);
      rig.position.set(u.x,y,u.z);rig.rotation.set(0,pose.yaw,0);
      const bulk=u.tideRam?1.46:u.formation==="siege"?1.27:u.formation==="ranged"?.88:1;rig.scale.set(bulk,bulk,bulk);rig.updateMatrix();
      place(team.bodies,slot,0,.022*Math.abs(step),jab,0,.08*step,1,1,1,rig.matrix);
      place(team.feet,slot*2,-.14,.52,0,step*.42,0,1,1,1,rig.matrix);
      place(team.feet,slot*2+1,.14,.52,0,-step*.42,0,1,1,1,rig.matrix);
      const health=Math.max(0,Math.min(1,u.hp/u.maxHp));
      if(health>=.9999)continue;
      const barSlot=team.wounded++;
      place(team.bars,barSlot*2,u.x,y+1.7,u.z,0,0,1.4,.08,.1);
      place(team.bars,barSlot*2+1,u.x-(1-health)*.675,y+1.7,u.z+.01,0,0,1.35*health,.09,.1);
    }
    for(const [id,p] of actors)if(p.seen!==serial)actors.delete(id);
    for(const team of teams){
      if(!team.capacity)continue;
      team.bodies.count=team.used;team.feet.count=team.used*2;team.bars.count=team.wounded*2;
      for(const mesh of [team.bodies,team.feet,team.bars]){mesh.visible=team.used>0;if(mesh.visible){mesh.instanceMatrix.needsUpdate=true;if(mesh!==team.bars&&mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}}
    }
  }
  function clearFallback(){
    actors.clear();
    for(const team of teams)if(team.capacity)for(const mesh of [team.bodies,team.feet,team.bars]){mesh.count=0;mesh.visible=false;}
  }
  function reset(){clearFallback();company.reset();drewFallback=false;}
  function dispose(){
    reset();company.dispose();
    for(const team of teams){releaseMeshes(team);team.shapes.body.dispose();team.shapes.foot.dispose();team.cloth.dispose();}
    barShape.dispose();barMaterial.dispose();
  }
  function protect(box,canvas){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    company.protect(box,w,h);
    if(!box){clearBody.value.set(-5,-5,-5,-5);return;}
    const sx=canvas.width/w,sy=canvas.height/h;
    clearBody.value.set(box.left*sx,(h-box.bottom)*sy,box.right*sx,(h-box.top)*sy);
  }
  return {start:company.start,draw,reset,protect,dispose};
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
  sheet.width=32*11;sheet.height=32;
  const pen=sheet.getContext("2d");
  pen.fillStyle="#fff";pen.font="bold 25px system-ui";pen.textAlign="center";pen.textBaseline="middle";
  for(let level=1;level<=10;level++)pen.fillText(String(level),level*32+16,16.5,29);
  const digits=new T.CanvasTexture(sheet);
  digits.generateMipmaps=false;digits.minFilter=T.LinearFilter;
  const uniforms={viewport:{value:new T.Vector2(1,1)},digitAtlas:{value:digits},heroLevel:{value:1}};
  const reserved=[],seenRoots=new WeakMap();
  const material=new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
    vertexShader:`attribute vec4 life;attribute vec3 metrics;attribute vec2 nudge;
      uniform vec2 viewport;varying vec2 panelUV;varying vec4 barLife;varying vec3 barMetrics;
      void main(){
        panelUV=uv;barLife=life;barMetrics=metrics;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        float badge=metrics.z<.5?metrics.y*2.12:0.;
        vec2 outer=vec2(metrics.x+badge,max(metrics.y,badge));
        gl_Position.xy+=(position.xy*outer-vec2(.5*badge,0.)+nudge)*2./viewport*gl_Position.w;
      }`,
    fragmentShader:`varying vec2 panelUV;varying vec4 barLife;varying vec3 barMetrics;
      uniform sampler2D digitAtlas;uniform float heroLevel;
      void main(){
        vec2 wh=barMetrics.xy;
        float badge=barMetrics.z<.5?wh.y*2.12:0.;
        vec2 whole=vec2(wh.x+badge,max(wh.y,badge)),p=panelUV*whole;
        if(badge>0.&&p.x<badge){
          vec2 local=p/badge;
          float d=length((local-.5)*badge),radius=badge*.48;
          float aa=clamp(fwidth(d),.65,1.4);
          float alpha=1.-smoothstep(radius-aa*.55,radius+aa*.45,d);
          if(alpha<.015)discard;
          vec3 metal=mix(vec3(.49,.39,.20),vec3(.96,.88,.61),local.y);
          vec3 face=mix(vec3(.11,.18,.19),metal,smoothstep(radius-1.85,radius-.75,d));
          float glyph=texture2D(digitAtlas,vec2((heroLevel+local.x)/11.,local.y)).a;
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
        vec3 ink=role<.5?vec3(.65,.86,.37):role<1.5?vec3(.20,.72,.88):role<2.5?vec3(.93,.35,.34):vec3(.90,.65,.28);
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
    metrics=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);
    nudge=new T.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('life',life);geometry.setAttribute('metrics',metrics);geometry.setAttribute('nudge',nudge);
    mesh=new T.InstancedMesh(geometry,material,capacity);mesh.frustumCulled=false;mesh.count=0;
    mesh.name='英雄与建筑血条';mesh.renderOrder=7;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
  }
  function anchor(root,kind){
    const p=root.position,s=root.scale;
    return unitPoint.set(p.x,p.y+(kind==='hero'?2.90:kind==='keeper'?1.78:4.40)*s.y,p.z);
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
    uniforms.heroLevel.value=Math.min(10,Math.max(1,level));
    reserved.length=0;if(bodyBox)reserved.push(bodyBox);
    for(const face of faces)reserved.push(face);
    uniforms.viewport.value.set(Math.max(width,1),Math.max(height,1));reserve(models.size);
    if(!mesh)return;
    const stamp=++seen;let used=0;
    const player=units.find(u=>u.id===playerId);
    for(let i=-1;i<units.length;i++){
      const u=i<0?player:units[i];
      if(!u||i>=0&&u.id===playerId)continue;
      if(u.kind==='minion'||u.dead||u.hp<=0)continue;
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
      const badge=u.id===playerId?size.h*2.12:0,outerH=Math.max(size.h,badge);
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
      metrics.setXYZ(used,size.w,size.h,u.id===playerId?0:u.team===0?1:u.team===1?2:3);used++;
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
