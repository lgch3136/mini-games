/** Passive one-round observer. It only reads the real fight after each 60 Hz step.
 * No input, random draws, gameplay mutation, frame injection, or saved history. */
const names={lin:'凌风',mei:'赤绫'};
const moves={jab:'轻拳',punch:'重拳',kick:'站踢',lowKick:'低踢'};
const fixed=n=>Math.max(0,Math.min(75,Math.ceil(n/60)));
const name=(f,s)=>names[f[s]?.c?.id]??(s===0?'你':'对手');
const pairs=(fighters)=>fighters.map(f=>({x:f.x,y:f.y}));
const bounds=(a,b)=> {
 const s=a.action.spec,x=a.facing>0?a.x+.2:a.x+a.facing*s.range*a.c.size;
 const end=x+s.range*a.c.size-.2;
 return a.facing>0?b.x-.34*b.c.size-end:x-(b.x+.34*b.c.size);
};
export function createRoundReceipt(){
 let samples=[],tracked=[null,null],best=null;
 const whiffs=[null,null];
 const set=(kind,rank,event,fields={})=>{
  if(best&&best.rank>=rank)return;
  best=Object.freeze({kind,rank,frame:event.frame,...fields});
 };
 return Object.freeze({
  reset(){samples=[];tracked=[null,null];whiffs.fill(null);best=null;},
  observe(fight){
   if(fight.state!=='fight'&&fight.state!=='roundEnd')return;
   const {f,frame,timer,events}=fight;
   const seconds=fixed(timer);
   const pos=pairs(f);
   const older=samples.find(p=>p.frame>=frame-24)??{pos};
   samples.push({frame,pos});
   if(samples.length>25)samples.shift();
   for(let i=0;i<2;i++){
    const a=f[i],b=f[1-i],action=a.action,s=action?.spec;
    if(!action||!Object.hasOwn(moves,action.name)){
     tracked[i]=null;continue;
    }
    const id=action.serial??a.attackSerial;
    let t=tracked[i];
    if(t?.id!==id)t=tracked[i]={id,outside:true,touched:false,clear:null,retreated:false,name:action.name};
    if(action.frame>=s.startup&&action.frame<s.startup+s.active){
     const clear=bounds(a,b);
     // Require at least a one-pixel visual gap at native 31 px per gameplay unit.
     t.outside=t.outside&&clear>=1/31;
     t.touched=true;
     t.clear=t.clear===null?clear:Math.min(t.clear,clear);
     const oppose=Math.sign(b.x-a.x);
     const distance=oppose*(b.x-older.pos[1-i].x);
     t.retreated ||= distance>=.24 && clear-distance<=0;
    }
    if(action.frame>=s.startup+s.active&&t.touched&&!t.received&&!action.connected){
     t.received=true;
     if(!t.outside||a.y!==0||b.y!==0)continue;
     const receipt=whiffs[i]={side:i,id,frame,seconds,move:t.name,retreated:t.retreated,clearPx:Math.round(t.clear*31)};
     if(i===1&&receipt.retreated)set('retreat',1,receipt,{seconds,otherMove:moves[t.name],clearPx:receipt.clearPx});
    }
   }
   const cue=fight.standingKickCue?.();
   if(cue?.phase==='counter-hit' && cue.nativeFrame===frame){
    const linked=events.find(e=>e.type==='hit'&&e.side===1&&e.target===0&&e.punish&&e.damage===cue.damage);
    if(linked&&Object.hasOwn(moves,linked.name))
     set('kickPunished',5,linked,{seconds,other:name(f,1),theirMove:moves[linked.name],damage:linked.damage});
   }
   for(const e of events){
    if(e.type!=='hit'||!Object.hasOwn(moves,e.name))continue;
    const victim=whiffs[e.target];
    const fromWhiff=!!victim&&victim.id===f[e.target].attackSerial&&e.frame-victim.frame>=0&&e.frame-victim.frame<=36;
    if(e.side===0&&e.punish&&fromWhiff&&victim.retreated){
     set('retreatPunish',6,e,{seconds,otherMove:moves[victim.move],yourMove:moves[e.name],damage:e.damage,clearPx:victim.clearPx});
    }else if(e.side===1&&e.punish&&fromWhiff&&victim.move==='kick'){
     set('kickPunished',4,e,{seconds,other:name(f,1),theirMove:moves[e.name],damage:e.damage,clearPx:victim.clearPx});
    }else if(e.side===0&&e.punish){
     set('punish',3,e,{seconds,yourMove:moves[e.name],damage:e.damage});
    }else if(e.side===0&&e.damage>0){
     set('hit',.5,e,{seconds,yourMove:moves[e.name],damage:e.damage});
    }
   }
  },
  get(){return best;}
 });
}
export function formatRoundReceipt(r){
 if(!r)return '';
 const time='剩 '+r.seconds+' 秒时，';
 if(r.kind==='retreatPunish')return time+'你退到'+r.otherMove+'够不到的位置，对方还在收招，你用'+r.yourMove+'打掉 '+r.damage+' 点血。';
 if(r.kind==='retreat')return time+'你后撤让对方的'+r.otherMove+'打空。那次没接到反击，下局可以试着等出招落空就贴回去。';
 if(r.kind==='kickPunished')return time+r.other+'留在你站踢够不到的位置，等踢空后用'+r.theirMove+'打了 '+r.damage+' 点血。可以试着晚半拍踢，或先调整距离。';
 if(r.kind==='punish')return time+'你抓到对方收招，用'+r.yourMove+'打掉 '+r.damage+' 点血。';
 if(r.kind==='hit')return time+'你的'+r.yourMove+'命中，打掉 '+r.damage+' 点血。';
 return '';
}
