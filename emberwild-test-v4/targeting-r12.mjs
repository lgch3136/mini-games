// Transient selection only: combat hit tests, damage and save data remain owned
// by the game. No stale entity objects survive chunk removal.
export function createTargeting({T,scene,camera,player,enemies,npc,height,occluders,alphaFilter}){
 const ray=new T.Raycaster(),ndc=new T.Vector2(),point=new T.Vector3(),direction=new T.Vector3();
 const geometry=new T.BufferGeometry(),positions=new Float32Array(4*7*2*3);
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));
 const material=new T.LineBasicMaterial({color:'#edc274',depthTest:true,depthWrite:false});
 const marker=new T.LineSegments(geometry,material);marker.name='selected_unit_brackets_r12';marker.visible=false;marker.frustumCulled=false;scene.add(marker);
 let selectedId=null,deadAge=0,revision=0;
 const maxRange=40;
 function units(){return enemies.map(e=>({id:e.id,root:e.g,pickRoot:e.rig.root,source:e,name:e.name??(e.type?'重盾守卫':'巡游守卫'),level:e.level??(e.type?2:1),hp:e.hp,maxHp:e.maxHp??(e.type?7:4),portraitId:e.portraitId??(e.type?'bulwark':'sentinel'),friendly:false,radius:e.isWildlife?(e.profile.bodyRadius+.2):e.type?.85:.64})).concat(npc?[{id:'warden',root:npc.root,pickRoot:npc.root,source:npc,name:'守灯人 · 艾芙',level:null,hp:null,maxHp:null,portraitId:'warden',friendly:true,radius:.61}]:[]);}
 function distance(unit){return Math.hypot(unit.root.position.x-player.x,unit.root.position.z-player.z);}
 function eligible(unit){return unit.friendly||unit.hp>0;}
 function clear(){if(selectedId!==null){selectedId=null;deadAge=0;revision++;}marker.visible=false;}
 function select(id){const unit=units().find(u=>u.id===id);if(!unit||!eligible(unit)||distance(unit)>maxRange)return false;if(selectedId!==id){selectedId=id;deadAge=0;revision++;}return true;}
 function visiblePoint(end){
  direction.copy(end).sub(camera.position);const length=direction.length();if(length<.01)return true;
  const steps=Math.min(100,Math.ceil(length*2));
  for(let i=1;i<steps;i++){point.copy(camera.position).lerp(end,i/steps);if(point.y<height(point.x,point.z)+.025)return false;}
  ray.set(camera.position,direction.normalize());ray.far=Math.max(0,length-.08);
  const hits=ray.intersectObjects(occluders,false);return !(alphaFilter?alphaFilter.firstSolidHit(hits):hits[0]);
 }
 function cycle(reverse=false){
  camera.updateMatrixWorld();scene.updateMatrixWorld(true);
  const candidates=units().filter(u=>!u.friendly&&eligible(u)&&distance(u)<=maxRange).map(unit=>{
   const aim=new T.Vector3().copy(unit.root.position).add(new T.Vector3(0,1.1,0)),screen=aim.clone().project(camera);
   return {unit,aim,screen,score:Math.hypot(screen.x,screen.y)*12+distance(unit)*.04};
  }).filter(c=>c.screen.z>=-1&&c.screen.z<=1&&Math.abs(c.screen.x)<=1.1&&Math.abs(c.screen.y)<=1.1&&visiblePoint(c.aim)).sort((a,b)=>a.score-b.score||a.unit.id.localeCompare(b.unit.id));
  if(!candidates.length){clear();return false;}
  const current=candidates.findIndex(c=>c.unit.id===selectedId),next=current<0?(reverse?candidates.length-1:0):(current+(reverse?-1:1)+candidates.length)%candidates.length;
  return select(candidates[next].unit.id);
 }
 function pick(clientX,clientY,rect){
  if(!rect||rect.width<=0||rect.height<=0)return false;
  ndc.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);
  if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1)return false;
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();
  const candidates=units().filter(u=>eligible(u)&&distance(u)<=maxRange),roots=new Map(candidates.map(u=>[u.pickRoot,u]));
  ray.setFromCamera(ndc,camera);ray.far=maxRange+15;
  const hits=ray.intersectObjects([...roots.keys()],true);
  for(const hit of hits){let object=hit.object,unit;while(object&&!unit){unit=roots.get(object);object=object.parent;}if(!unit)continue;
   if(visiblePoint(hit.point)){select(unit.id);return true;}
   break;
  }
  clear();return false;
 }
 function snapshot(){
  if(!selectedId)return null;const unit=units().find(u=>u.id===selectedId);if(!unit||distance(unit)>maxRange){clear();return null;}
  const d=distance(unit);return {id:unit.id,name:unit.name,level:unit.level,hp:unit.hp,maxHp:unit.maxHp,portraitId:unit.portraitId,friendly:unit.friendly,dead:!unit.friendly&&unit.hp<=0,outOfRange:d>(unit.friendly?3.2:3),distance:d};
 }
 function update(dt,{dead=false,paused=false}={}){
  if(dead){clear();return;}const view=snapshot();if(!view){marker.visible=false;return;}
  if(view.dead){if(!paused)deadAge+=Math.max(0,dt);marker.visible=false;if(deadAge>=1.4)clear();return;}
  deadAge=0;const unit=units().find(u=>u.id===selectedId),p=unit.root.position;material.color.set(unit.friendly?'#92ca98':'#edb267');let index=0;
  for(let quadrant=0;quadrant<4;quadrant++)for(let segment=0;segment<7;segment++)for(const end of [0,1]){
   const angle=quadrant*Math.PI/2+(.18+(segment+end)/7*.58),x=p.x+Math.cos(angle)*unit.radius,z=p.z+Math.sin(angle)*unit.radius;
   positions[index++]=x;positions[index++]=height(x,z)+.045;positions[index++]=z;
  }
  geometry.attributes.position.needsUpdate=true;marker.visible=true;
 }
 return {select,clear,pick,cycle,update,snapshot,dispose(){scene.remove(marker);geometry.dispose();material.dispose();},diagnostics:()=>({selectedId,revision,deadAge,maxRange,markerVisible:marker.visible,draws:marker.visible?1:0,vertices:positions.length/3,saved:false})};
}
