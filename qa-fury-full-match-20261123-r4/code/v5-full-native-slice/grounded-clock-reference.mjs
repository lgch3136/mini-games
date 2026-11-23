/** Read-only post-engine observer, authored sprite TABLE interface (no drawing).
 * Call once after each Fight.step, including both player orders. No repo/main change.
 */
const MOVE_NAMES=new Set(['jab','punch']); const uid=f=>f.c.id;
const CYCLE=Math.PI*2;
const mod=(n,d)=>((n%d)+d)%d;
const label=(id,key,detail={})=>({id,key,...detail});
function movement(f){
 if(f.y===0&&(f.state==='walk'||f.state==='run')&&Math.abs(f.vx)>.01)return f.vx*f.facing<0?'walkBack':f.state==='run'?'run':'walkForward';
 return null;
}
function phase(f,a){
 const {startup,active,recovery}=a.spec,n=a.frame;
 if(n<startup)return n/startup<.56?'load':'commit';
 if(n<startup+active)return 'active';
 const u=n-startup-active;
 return u<Math.ceil(recovery/2)?'return':'settle';
}
export function atlasClock({bounded=false}={}){
 const authored=bounded?new Set([...MOVE_NAMES,'kick','lowKick']):MOVE_NAMES;
 const capture=new WeakMap();
 return function afterStep(fight){
   let v=capture.get(fight);
   if(v?.lastFrame===fight.frame&&v?.lastRound===fight.round)return v.rows;
   if(!v||v.lastRound!==fight.round||fight.frame<v.lastFrame){
     v={lastRound:fight.round,lastFrame:-1,actors:[{},{}],rows:[]};capture.set(fight,v);
   }
   for(const ev of fight.events??[]){
     if(ev.type==='break'&&ev.side>=0)v.actors[ev.side].brokeAt=fight.frame;
     if(ev.type==='hit'||ev.type==='block'){
       v.actors[ev.target].taken={frame:ev.frame,side:ev.side,kind:ev.type,heavy:!!ev.heavy,name:ev.name};
       v.actors[ev.side].landed={frame:ev.frame,kind:ev.type,name:ev.name,serial:fight.f[ev.side].action?.serial};
     }
   }
   const rows=[];
   for(const f of fight.f){
     const s=v.actors[f.side], movementNow=movement(f), a=f.action, moved=Number.isFinite(f.px)&&Math.abs(f.x-f.px)>.000001;
     const facingChanged=s.facing!==undefined&&s.facing!==f.facing;
     const canStop=f.y===0&&!a&&!f.down&&!f.stun&&(f.state==='idle'||f.state==='guard')&&!f.land&&!f.crouch&&!f.held?.has('guard');
     const stanceNow=canStop&&!f.blocking&&f.state==='idle';
     if(!a&&s.previousAction&&!s.previousAction.connected&&s.previousAction.terminal!==true&&f.state==='idle'&&!f.stun){
       // interrupted or natural: require that previous clock actually approached its end.
       const b=s.previousAction;
       if(b.frame>=b.total-1) s.completed={name:b.name,serial:b.serial,outcome:'whiff',frame:fight.frame};
     }
     if(!a&&canStop&&s.movement&&s.movement!=='run'&&!movementNow&&!facingChanged){
       s.stop={from:s.movement,support:s.gaitSupport,ticks:0};s.idleTicks=0;
     }else if(s.stop&&canStop&&!movementNow&&!facingChanged&&f.freeze===0){
       s.stop.ticks++;
     }
     if(!canStop||movementNow||facingChanged||s.stop?.ticks>=4)s.stop=null;
     if(stanceNow&&!s.stop&&f.freeze===0)s.idleTicks=(s.idleTicks??-1)+1;
     else if(!stanceNow)s.idleTicks=0;
     const id=uid(f),t=s.taken,res=t?.frame===f.lastReceived?t:null;
     let key,motionMeta={},collisionPhase=null,outcome=null;
     // Fatal, airborne, and roll paths are explicitly delegated, never shown as idle.
     if(f.hp===0||f.state==='ko'||f.state==='down'||f.down>0){
       key=f.hp===0?'ko':'down';if(f.y>0)key=bounded&&key==='ko'?'ko/lift':'base:'+key;
     }else if(f.y>0||f.state==='roll'||f.state==='backstep'||f.land>0||movementNow==='run'){
       key='base:'+(f.land>0?'land':movementNow==='run'?'run':f.state);
     }else if(f.state==='hurt'||f.state==='block'){
       const expecting=f.state==='hurt'?'hit':'block';
       if(bounded&&f.state==='hurt'&&res?.kind==='block'&&s.brokeAt===f.lastReceived)key='break/'+((f.stateFrame??0)<8?'impact':'release');
       else if(!res||res.kind!==expecting)key='base:'+f.state;
       else{
         const hold=(f.stateFrame??0)<(res.heavy?6:4);
         key=f.state==='block'?'block/'+(hold?'impact':'release'):'hit/'+(hold?'impact':'release');
         collisionPhase=res.kind;motionMeta={contactFrame:res.frame,contactHeavy:res.heavy,age:f.stateFrame};
       }
     }else if(a){
       if(!authored.has(a.name))key='base:attack:'+a.name;
       else{
         const p=phase(f,a);
         // No assertion of miss during startup/active. Recovery reads connected, not age or FX.
         outcome=['return','settle'].includes(p)?(a.connected?(s.landed?.serial===a.serial?s.landed.kind:'connected'):'whiff'):null;
         key=a.name+'/'+p;
         collisionPhase=p==='active'?'active':null;
         motionMeta={actionFrame:a.frame,serial:a.serial,actionName:a.name,connected:a.connected};
       }
     }else if(movementNow){
       const raw=mod(f.walkPhase??0,CYCLE)/CYCLE;
       const bin=mod(Math.floor(raw*12+.5),12);
       const support=(bin<6)===(movementNow==='walkForward')?'F':'B';
       s.gaitSupport=support;
       // Backward walk remains a covered retreat, not an idle guard. Hold guard is different.
       key=movementNow+'/'+bin;
       motionMeta={bin,cycleT:raw,support,signedDx:f.x-f.px,moved};
     }else if(f.crouch)key=f.blocking?'guard/crouch':bounded?'crouch/hold':'base:crouch';
     else if(s.stop){
       key='stop/'+s.stop.support+'/'+(s.stop.ticks<2?'catch':'settle');
       motionMeta={from:s.stop.from,support:s.stop.support,stopTick:s.stop.ticks};
     }else if(f.blocking||f.state==='guard')key='guard/hold';
     else{
       key='idle/'+(Math.floor((s.idleTicks??0)/8)%3);
       if(s.completed?.frame===fight.frame)motionMeta={completed:s.completed};
     }
     rows.push(label(id,key,{side:f.side,facing:f.facing,frame:fight.frame,worldX:f.x,worldY:f.y,freeze:f.freeze,collisionPhase,outcome,...motionMeta}));
     s.previousAction=a?{name:a.name,serial:a.serial,connected:a.connected,frame:a.frame,total:a.spec.startup+a.spec.active+a.spec.recovery}:null;
     s.movement=movementNow;s.facing=f.facing;
   }
   v.lastFrame=fight.frame;v.rows=Object.freeze(rows.map(r=>Object.freeze(r)));
   return v.rows;
 };
}
export const CEL_KEYS=Object.freeze([
  ...Array.from({length:3},(_,i)=>'idle/'+i),
  ...['walkForward','walkBack'].flatMap(d=>Array.from({length:12},(_,i)=>d+'/'+i)),
  ...['F','B'].flatMap(s=>['catch','settle'].map(t=>'stop/'+s+'/'+t)),
  ...['jab','punch'].flatMap(m=>['load','commit','active','return','settle'].map(p=>m+'/'+p)),
  'guard/hold','guard/crouch','block/impact','block/release','hit/impact','hit/release','down','ko'
]);

export const BOUNDED_KEYS=Object.freeze([
 ...CEL_KEYS.filter(x=>x!=='down'),
 ...['kick','lowKick'].flatMap(m=>['load','commit','active','return','settle'].map(p=>m+'/'+p)),
 'crouch/hold','break/impact','break/release','ko/lift'
]);
