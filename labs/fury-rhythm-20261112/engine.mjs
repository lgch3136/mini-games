// Original combat laboratory. No third-party engine or art code.
export const MOVES = {
 light: {beats:[3,5,3,5,10],damage:8,range:100,stop:3,push:12,stun:13},
 heavy: {beats:[5,12,4,8,17],damage:19,range:120,stop:7,push:30,stun:25},
 enemy: {beats:[6,30,4,7,24],damage:13,range:116,stop:5,push:23,stun:20}
};
export const BEATS=['预备','蓄势','出拳','跟随','收势'];
export function phase(a){if(!a.move)return -1;let t=a.age;for(let i=0;i<5;i++){if(t<MOVES[a.move].beats[i])return i;t-=MOVES[a.move].beats[i];}return -1;}
const fighter=(x,dir)=>({x,dir,hp:100,move:null,age:0,hit:false,stun:0,dodge:0,cooldown:0,flash:0});
export class Arena {
 constructor(){this.reset();}
 reset(){this.p=fighter(330,1);this.e=fighter(465,-1);this.frame=0;this.freeze=0;this.shake=0;this.buffer=null;this.events=[];this.effects=[];this.enemyClock=80;this.score={light:0,heavy:0,dodged:0,taken:0};this.result='';this.paused=false;this.practice=false;}
 input(action){if(this.paused||this.result||!['light','heavy','dodge'].includes(action))return;this.buffer={action,ttl:10};}
 clearInput(){this.buffer=null;}
 start(a,move){a.move=move;a.age=0;a.hit=false;}
 tick(axis=0){
  if(this.paused||this.result)return;
  this.frame++;this.events=[];
  this.shake=Math.max(0,this.shake-1);
  this.effects=this.effects.filter(f=>--f.life>0);
  if(this.freeze>0){this.freeze--;return;}
  const p=this.p,e=this.e;
  for(const a of [p,e]){a.flash=Math.max(0,a.flash-1);a.cooldown=Math.max(0,a.cooldown-1);a.stun=Math.max(0,a.stun-1);}
  if(this.buffer){const {action}=this.buffer;
   const canDodge=action==='dodge'&&!p.stun&&!p.dodge&&!p.cooldown&&(!p.move||phase(p)===4);
   if(canDodge){p.move=null;p.dodge=18;p.cooldown=48;this.buffer=null;this.events.push({type:'dodge'});}
   else if(action!=='dodge'&&!p.move&&!p.stun&&!p.dodge){this.start(p,action);this.buffer=null;}
   else if(--this.buffer.ttl<=0)this.buffer=null;
  }
  if(p.dodge){p.x-=p.dir*5.5;p.dodge--;}
  else if(!p.move&&!p.stun)p.x+=Math.max(-1,Math.min(1,axis))*3;
  p.x=Math.max(55,Math.min(845,p.x));
  if(!p.move&&!p.dodge)p.dir=e.x>=p.x?1:-1;
  if(!e.move&&!e.stun){e.dir=p.x>=e.x?1:-1;
   if(!this.practice){if(Math.abs(p.x-e.x)>105)e.x+=e.dir*1.3;
   if(--this.enemyClock<=0){this.start(e,'enemy');this.enemyClock=100;}}
  }
  e.x=Math.max(55,Math.min(845,e.x));
  for(const [a,b] of [[p,e],[e,p]]){
   if(!a.move||a.stun)continue;
   const m=MOVES[a.move];
   if(phase(a)===2&&!a.hit){
    const dist=(b.x-a.x)*a.dir;
    if(dist>=-8&&dist<=m.range){a.hit=true;
     if(b.dodge>=4){this.score.dodged++;this.events.push({type:'evade'});}
     else{b.hp=Math.max(0,b.hp-m.damage);b.stun=m.stun;b.move=null;b.flash=8;
      b.x=Math.max(55,Math.min(845,b.x+a.dir*m.push));this.freeze=m.stop;this.shake=a.move==='heavy'?7:3;
      this.effects.push({x:b.x,life:a.move==='heavy'?18:10,heavy:a.move==='heavy'});
      const type=a===p?a.move:'taken';this.score[type]++;this.events.push({type});
     }
    }
   }
   a.age++;if(phase(a)===-1)a.move=null;
  }
  if(!p.hp||!e.hp){this.result=p.hp?'试炼完成':'再试一次';this.buffer=null;}
 }
}
