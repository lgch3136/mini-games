// Each bed is walkable. The visible plants and the sight rule use the same ellipse.
import {rushes,extent} from "./estuary-map.mjs?v=canyon-stonepath3";
export const reedBeds=rushes;
export function patchAt(x,z) {
  for(let i=0;i<reedBeds.length;i++){
    const b=reedBeds[i],dx=(x-b.x)/b.rx,dz=(z-b.z)/b.rz;
    if(dx*dx+dz*dz<=1)return i;
  }
  return -1;
}
// A living hero, wave or building shares one view with its whole team.
export const sightRadii=Object.freeze({hero:10.8,minion:5.8,tower:11.4,core:12.0});
const brushContact=2.05;
const living=u=>u&&!u.dead&&u.hp>0;
const landmark=u=>u.kind==="core"||u.kind==="tower";
const perspectives=new WeakMap(),eventViews=new WeakMap();

function observers(match){
  return match.teamSight??={sources:[[],[]],byId:new Map(),generation:-1};
}
function inCircle(source,x,z){
  if(!living(source))return false;
  const dx=x-source.x,dz=z-source.z,radius=sightRadii[source.kind];
  return Math.abs(dx)<=radius&&Math.abs(dz)<=radius&&dx*dx+dz*dz<=radius*radius;
}
const bedOf=(u,x,z)=>u?.kind==="hero"||u?.kind==="minion"?patchAt(x,z):-1;
export function groundSeen(match,team,x,z){
  const sources=match.teamSight?.sources[team];
  if(!sources)return false;
  for(const source of sources)if(inCircle(source,x,z))return true;
  return false;
}
function sampleUnit(match,unit){
  let range=0,clear=0;
  for(let team=0;team<2;team++){
    const bit=1<<team;
    if(team===unit.team){range|=bit;clear|=bit;continue;}
    for(const src of match.teamSight.sources[team]){
      if(!inCircle(src,unit.x,unit.z))continue;
      range|=bit;
      const dx=unit.x-src.x,dz=unit.z-src.z;
      if(unit.reedBed<0||unit.reedBed===src.reedBed||dx*dx+dz*dz<=brushContact*brushContact){
        clear|=bit;break;
      }
    }
  }
  unit.sightRangeMask=range;unit.sightOpenMask=clear;
  unit.reedScreened=unit.kind==="hero"&&unit.reedBed>=0&&!(clear&(1<<(1-unit.team)));
  if(landmark(unit)){
    const known=unit.knownHealth??=[unit.maxHp,unit.maxHp];
    for(let team=0;team<2;team++)if(unit.dead||(range&(1<<team)))known[team]=unit.hp;
  }
}
export function visibleTo(match,team,unit){
  if(!unit)return false;
  if(unit.team===team||landmark(unit))return true;
  if(!match.teamSight)updateVisibility(match);
  if(unit.sightRangeMask===undefined){unit.reedBed=bedOf(unit,unit.x,unit.z);sampleUnit(match,unit);}
  const bits=match.time<(unit.reedExposedUntil||0)?unit.sightRangeMask:unit.sightOpenMask;
  return Boolean(bits&(1<<team));
}
export function updateVisibility(match){
  const state=observers(match),sources=state.sources;
  sources[0].length=0;sources[1].length=0;state.byId.clear();
  for(const unit of match.units){
    state.byId.set(unit.id,unit);
    unit.reedBed=bedOf(unit,unit.x,unit.z);
    if(unit.team<2&&living(unit)&&sightRadii[unit.kind])sources[unit.team].push(unit);
  }
  for(const unit of match.units)sampleUnit(match,unit);
  state.generation=match.seq;
  for(const event of match.events||[]){
    if(!eventViews.has(event))eventViews.set(event,[observeEvent(match,0,event),observeEvent(match,1,event)]);
  }
}
export function openReeds(match,unit,seconds){
  if(unit.kind==="hero"||unit.kind==="minion")unit.reedExposedUntil=Math.max(unit.reedExposedUntil||0,match.time+seconds);
}
export function reedCaption(match,player){
  if(player.dead||player.reedBed<0)return "";
  if(match.time<(player.reedExposedUntil||0)&&visibleTo(match,1-player.team,player))return "芦丛 · 已现身";
  return player.reedScreened?"芦丛 · 已藏身":"芦丛 · 敌在近处";
}

function witnessed(match,team,actor,x,z){
  if(actor?.team===team)return true;
  const bed=bedOf(actor,x,z),exposed=match.time<(actor?.reedExposedUntil||0);
  for(const source of match.teamSight.sources[team]){
    if(!inCircle(source,x,z))continue;
    if(bed<0||exposed||bed===source.reedBed||(source.x-x)**2+(source.z-z)**2<=brushContact**2)return true;
  }
  return false;
}
function observeEvent(match,team,event){
  // Securing the river objective announces the winning team at its known ford.
  if(event.type==="keeperClaim")return event;
  const byId=match.teamSight.byId,source=byId.get(event.source),target=byId.get(event.target);
  const fx=event.fromX??event.x,fz=event.fromZ??event.z;
  const tx=event.targetX??event.x,tz=event.targetZ??event.z;
  const allied=(source?.team??event.sourceTeam)===team;
  if(event.type==="anywhereDoor"){
    // Seeing a portal arrive does not disclose the departure point in the fog.
    const departure=allied||witnessed(match,team,source,fx,fz);
    const arrival=allied||witnessed(match,team,source,tx,tz);
    if(!departure&&!arrival)return null;
    if(departure&&arrival)return event;
    const x=departure?fx:tx,z=departure?fz:tz;
    return {...event,x,z,fromX:x,fromZ:z,targetX:x,targetZ:z,singleDoor:true};
  }
  if(event.type==="dash"&&!allied&&
      (!witnessed(match,team,source,fx,fz)||!witnessed(match,team,source,tx,tz)))return null;
  const impact=event.type==="hit"||event.type==="death"||event.type==="warning"||
    event.type==="airPush"||event.type==="intercept"||event.type==="miss"&&event.shotKind==="ki";
  const from=source?source.team===team||groundSeen(match,team,source.x,source.z)&&visibleTo(match,team,source):
    allied||witnessed(match,team,null,fx,fz);
  const to=witnessed(match,team,target,tx,tz);
  if(impact?!to:!from)return null;
  if(impact&&!from)return {...event,x:tx,z:tz,fromX:tx,fromZ:tz,face:0,directionX:0,directionZ:0,unknownOrigin:true};
  if(!impact&&!to&&!allied)return {...event,target:null,targetX:fx,targetZ:fz};
  return event;
}

// The display and the sound consumer receive the same immutable observation of an event.
export function observedBattle(match,team=0){
  if(match.observationTeam===team)return match;
  if(!match.teamSight)updateVisibility(match);
  let both=perspectives.get(match);
  if(!both){both=[];perspectives.set(match,both);}
  let view=both[team];
  if(!view){
    view=Object.create(match);view.observationTeam=team;view.units=[];view.projectiles=[];view.events=[];
    view.inFog=new Set();view.landmarks=new WeakMap();both[team]=view;
  }
  view.units.length=0;view.projectiles.length=0;view.events.length=0;view.inFog.clear();
  for(const unit of match.units){
    if(!visibleTo(match,team,unit)){
      if(unit.kind==="hero"||unit.kind==="keeper"||unit.kind==="camp")view.inFog.add(unit.id);
      continue;
    }
    if(landmark(unit)&&unit.team!==team&&!(unit.sightRangeMask&(1<<team))){
      let scenery=view.landmarks.get(unit);
      if(!scenery){
        scenery=Object.assign(Object.create(unit),{sceneryOnly:true,action:null,shield:0,attackT:0,
          guardTargetId:null,lockedTargetId:null,lastImpactTime:-Infinity,impactOrigin:null});
        view.landmarks.set(unit,scenery);
      }
      scenery.hp=unit.dead?0:unit.knownHealth?.[team]??unit.maxHp;view.units.push(scenery);
    }else view.units.push(unit);
  }
  for(const shot of match.projectiles||[])if(groundSeen(match,team,shot.x,shot.z))view.projectiles.push(shot);
  for(const ev of match.events||[]){
    let sample=eventViews.get(ev);
    if(!sample){sample=[observeEvent(match,0,ev),observeEvent(match,1,ev)];eventViews.set(ev,sample);}
    if(sample[team])view.events.push(sample[team]);
  }
  return view;
}

// One byte per ground vertex serves both the landscape and the minimap.
export function sightField(match,team){
  if(!match.teamSight)updateVisibility(match);
  const state=match.teamSight,n=2*extent+1;
  const fields=state.fields??=[];
  const field=fields[team]??={values:new Uint8Array(n*n),size:n,time:-Infinity,version:0};
  if(match.time>=field.time&&match.time-field.time<.12)return field;
  field.time=match.time;field.version++;field.values.fill(0);
  for(const source of state.sources[team]){
    if(!living(source))continue;
    const cx=source.x+extent,cz=source.z+extent,r=sightRadii[source.kind];
    const edge=r+.65,outer=edge*edge,inner=(r-.8)**2,scale=255/(outer-inner);
    const minX=Math.max(0,Math.ceil(cx-edge)),maxX=Math.min(n-1,Math.floor(cx+edge));
    const minZ=Math.max(0,Math.ceil(cz-edge)),maxZ=Math.min(n-1,Math.floor(cz+edge));
    for(let z=minZ;z<=maxZ;z++){
      const zz=(z-cz)**2;
      for(let x=minX;x<=maxX;x++){
        const index=z*n+x;if(field.values[index]===255)continue;
        const brightness=Math.min(255,Math.round((outer-zz-(x-cx)**2)*scale));
        if(brightness>field.values[index])field.values[index]=brightness;
      }
    }
  }
  return field;
}

export function addReeds(triangle) {
  const palette=["#627858","#6e8861","#899861","#a3a675","#b6ad78"];
  for(const [index,b] of reedBeds.entries()){
    let random=719+index*977;
    function rand(){random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;}
    for(let i=0;i<28;i++){
      const a=i*2.399+index*.4,r=Math.sqrt((i+.35)/28);
      const x=b.x+Math.cos(a)*b.rx*r,z=b.z+Math.sin(a)*b.rz*r;
      for(let j=0;j<5;j++){
        const phi=rand()*Math.PI*2,co=Math.cos(phi),si=Math.sin(phi),width=.038+rand()*.035;
        const lean=.14+rand()*.29,h=.36+rand()*.56;
        const cx=x+co*.09,cz=z+si*.09;
        const left=[cx-si*width,.073,cz+co*width],right=[cx+si*width,.073,cz-co*width];
        const mid=[cx+co*lean*.45,h*.7,cz+si*lean*.45],tip=[cx+co*lean,h,cz+si*lean];
        const mL=[mid[0]-si*width*.63,mid[1],mid[2]+co*width*.63];
        const mR=[mid[0]+si*width*.63,mid[1],mid[2]-co*width*.63];
        triangle(left,right,mR,palette[(i+j)%3]);triangle(left,mR,mL,palette[(i+j)%3]);
        triangle(mL,mR,tip,palette[2+(i+j)%3]);
        if(j===0&&i%3===0){
          const c=[tip[0]+.04,h+.09,tip[2]];
          triangle([tip[0]-.04,h-.025,tip[2]],[tip[0]+.046,h-.01,tip[2]],c,"#c8ac75");
        }
      }
    }
  }
}
