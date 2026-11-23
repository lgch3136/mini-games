// Read-only. Own neutral leap and landing only; cannot hide hits, attacks or KOs.
export const LIN_FLIGHT_KEYS=Object.freeze(['jump/takeoff','jump/rise','jump/apex','jump/descent','land/absorb']);
export function linFlightClock(){
 const state=new WeakMap();
 return function capture(fight){
  let h=state.get(fight);
  if(h?.frame===fight.frame&&h.round===fight.round)return h.rows;
  if(!h||h.round!==fight.round||fight.frame<h.frame){h={round:fight.round,sides:[{},{}]};state.set(fight,h);}
  const queued=fight.events??[];
  h.rows=fight.f.map(f=>{
   const p=h.sides[f.side];
   if(f.c.id!=='lin')return null;
   const hit=queued.some(e=>e.type==='hit'&&e.target===f.side);
   if(hit||f.hp===0||f.down||f.stun||f.action||['hurt','block','down','ko','roll','backstep'].includes(f.state)){
    p.start=null;p.touch=null;return null;
   }
   if(queued.some(e=>e.type==='jump'&&e.side===f.side)&&f.y>0&&f.state==='jump'){
    p.start=fight.frame;p.touch=null;
   }
   if(queued.some(e=>e.type==='land'&&e.side===f.side)&&f.y===0&&p.start!=null){
    p.touch=fight.frame;p.start=null;
   }
   if(f.y===0){
    p.start=null;
    return p.touch!=null&&f.land>0&&fight.frame-p.touch<2?'land/absorb':null;
   }
   if(p.start==null||f.state!=='jump')return null;
   if(fight.frame-p.start<3&&f.vy>0)return 'jump/takeoff';
   if(f.vy>.052)return 'jump/rise';
   if(f.vy>=-.052)return 'jump/apex';
   return 'jump/descent';
  });
  h.frame=fight.frame;
  return h.rows;
 };
}
