import { atlasClock } from '../v5-full-native-slice/grounded-clock-reference.mjs';
import { IDENTITIES,REQUIRED } from '../v5-full-native-slice/session.mjs';
const phase=(n,a,b)=>n<a?'load':n<b?'travel':'settle';
const air=(f)=>f.vy>.07?'rise':f.vy<-.07?'descent':'apex';
export function fullPoseRouter(audit){
 const clock=atlasClock({bounded:true}), stakes=new WeakMap();
 return (game)=>{
  let state=stakes.get(game);
  if(state?.frame===game.frame&&state.round===game.round)return state.rows;
  if(!state||state.round!==game.round||game.frame<state.frame){state={frame:-1,round:game.round,side:[{},{}]}; stakes.set(game,state);}
  const old=clock(game);
  for(const ev of game.events){
   if(![0,1].includes(ev.side))continue;
   const f=game.f[ev.side],p=state.side[ev.side];
   if(ev.type==='land')p.landAt=game.frame;
   if(ev.type==='rise')p.riseAt=game.frame;
   if(ev.type==='tech')p.techAt=game.frame;
   if(ev.type==='break')p.brokeAt=game.frame;
   if(['hit','block'].includes(ev.type)&&[0,1].includes(ev.target)){
    const target=state.side[ev.target];
    target.contact={kind:ev.type,heavy:!!ev.heavy,frame:game.frame};
    // Projectile hit after its action ends must not attach to a different action.
    if(f.action?.name===ev.name&&!f.action.spec?.projectile)p.lastOwn={frame:game.frame,serial:f.action.serial,kind:ev.type};
   }
  }
  state.rows=Object.freeze(game.f.map(f=>{
   const p=state.side[f.side],id=f.c.id,a=f.action;let key;
   if(!IDENTITIES.includes(id))throw new Error('Unauthored roster ID '+id);
   const soon=(name,n)=>Number.isFinite(p[name])&&game.frame-p[name]<n;
   if(f.hp===0||f.state==='ko'){
    key='ko/'+(f.y>0?(f.vy<0?'descent':'rise'):soon('landAt',8)?'contact':'seated');
   }else if(f.down||f.state==='down'){
    key='down/'+(f.y>0?(f.vy<0?'descent':'rise'):soon('landAt',4)?'contact':'ground');
   }else if(f.state==='hurt'){
    const isBreak=p.brokeAt===f.lastReceived;
    key=isBreak?'break/'+(f.crouch?'crouch-':'')+(f.stateFrame<8?'impact':'release'):
      f.y>0?'hit/air-'+(f.vy<0?'descent':'rise'):'hit/'+(f.stateFrame<(p.contact?.heavy?6:4)?'impact':'release');
   }else if(f.state==='block'){
    key=soon('techAt',12)?'tech/'+(f.stateFrame<4?'impact':'release'):
      'block/'+(f.crouch?'crouch-':'')+(f.stateFrame<(p.contact?.heavy?6:4)?'impact':'release');
   }else if(a){
    const n=a.frame, m=a.spec, t=n<m.startup?(n/m.startup<.56?'load':'commit'):n<m.startup+m.active?'active':
      n-m.startup-m.active<Math.ceil(m.recovery/2)?'return':'settle';
    key=a.name+'/'+t;
    if(id==='lin'&&a.name==='punch'&&!a.connected&&['return','settle'].includes(t))key=t==='return'?'punch/return/whiff':'punch/return/whiff-late';
    if(id==='mei'&&a.name==='kick'&&t==='return'&&n>=13&&n<=16)key='kick/return/late';
   }else if(f.land>0||f.py>0&&f.y===0)key='land/'+(soon('landAt',1)?'compress':'release');
   else if(f.y>0||f.state==='jump')key='jump/'+air(f);
   else if(f.state==='roll'||f.state==='backstep'){const span=f.state==='roll'?28:15;key=f.state+'/'+phase(f.stateFrame,4,span-4);}
   else if(soon('riseAt',8)&&f.state==='idle'&&!f.crouch&&!f.blocking)key='rise/'+(soon('riseAt',3)?'start':'recover');
   else if(f.state==='run'&&Math.abs(f.vx)>.01)key='run/'+Math.round((((f.walkPhase/(2*Math.PI))%1+1)%1)*12)%12;
   else key=old[f.side].key;
   if(!REQUIRED[id].includes(key))throw new Error('Unclassified native pose '+id+': '+key);
   return Object.freeze({id,key,side:f.side,round:game.round,frame:game.frame,freeze:f.freeze,action:a?.name??null,
    face:f.facing,hitLevel:a?.spec.level??null,confirmed:a?.connected??false,contact:p.lastOwn?.serial===a?.serial?p.lastOwn?.kind??null:null,cell:audit.cels[id]?.[key]??null});
  }));
  state.frame=game.frame;
  return state.rows;
 };
}
export function newOnlyFrame(audit,router,game){
 if(!audit.ready)return {ok:false,reason:'full native authored pack blocked'};
 const rows=router(game);
 const missing=rows.find(r=>!r.cell||r.cell.id!==r.id||r.cell.key!==r.key);
 return missing?{ok:false,reason:missing.id+' '+missing.key+' requires approved own visual pose'}:{ok:true,rows};
}
