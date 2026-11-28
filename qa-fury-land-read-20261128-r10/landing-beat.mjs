// Grounded visual hold only. Never changes hitboxes, x/y, input or the engine's landing clock.
const touches=new WeakMap();
const normal=f=>f.c.id==="lin"||f.c.id==="mei";
const interrupted=f=>f.hp<=0||f.y!==0||f.action||f.stun||f.down||f.freeze||
  f.crouch||f.blocking||f.held.has("guard")||["roll","backstep","walk","run","hurt","ko"].includes(f.state);
export function sampleReadableTouch(fight){
 for(const f of fight.f){
  if(fight.state!=="fight"||!normal(f)||interrupted(f)){touches.delete(f);continue}
  const old=touches.get(f);
  if(old&&(old.round!==fight.round||fight.frame-old.at>=9||old.facing!==f.facing))touches.delete(f);
  if(f.land===2&&fight.events.some(e=>e.type==="land"&&e.side===f.side)){
   touches.set(f,{at:fight.frame,round:fight.round,facing:f.facing});
  }
 }
}
export function readableTouchPose(f,frame){
 const contact=touches.get(f);
 if(!contact||interrupted(f)||f.facing!==contact.facing)return null;
 const age=frame-contact.at;
 return age<0||age>=9?null:age<4?"plant":"recover";
}
