import {air,ground} from "./bridge-pins.mjs";
export const landingArt={...air,ground};
const states=new WeakMap;
function neutral(f){
  return (f.c.id==="lin"||f.c.id==="mei") && f.hp>0 && !f.freeze && !f.stun && !f.down && !f.action &&
    !f.crouch && !f.blocking && !f.held.has("guard") && !f.held.has("down") && !f.run &&
    !["roll","backstep","ko","hurt","guard","block","walk","run"].includes(f.state);
}
export function sampleLanding(fight){
  let tracks=states.get(fight);
  if(!tracks||tracks.round!==fight.round){tracks={round:fight.round,actors:[]};states.set(fight,tracks)}
  for(const f of fight.f){
    const events=fight.events.filter(e=>e.side===f.side);
    const prev=tracks.actors[f.side];let track=prev;
    if(fight.state!=="fight"||!neutral(f)||(prev&&prev.facing!==f.facing))track=null;
    else if(events.some(e=>e.type==="jump")&&f.state==="jump"&&f.y>0)track={facing:f.facing,touch:-1};
    else if(track&&events.some(e=>e.type==="land")){
      track=f.y===0&&f.land===2?{...track,touch:fight.frame}:null;
    }else if(track?.touch>=0&&(f.y!==0||f.land<=0||fight.frame-track.touch>1))track=null;
    else if(track&&track.touch<0&&!(f.state==="jump"&&f.y>0))track=null;
    tracks.actors[f.side]=track;
  }
}
export function landingRole(fight,f){
  const record=states.get(fight);
  const track=record?.round===fight.round&&record.actors[f.side];
  if(!track||track.facing!==f.facing||fight.state!=="fight"||!neutral(f))return null;
  if(track.touch>=0)return f.y===0&&f.land>0&&f.land<=2&&fight.frame-track.touch<=1?(f.land===2?"touch":"release"):null;
  return f.state==="jump"&&f.y>0&&f.vy<-.07&&f.y+2*f.vy-.033<=0?"bridge":null;
}
export function landingCel(fight,f,sheets){
  const role=landingRole(fight,f);
  if(!role)return null;
  // Both the airborne and ground art must be ready: no mixed incomplete bridge.
  const id=f.c.id+"-"+f.facing, airEntry=sheets?.get(id),groundEntry=sheets?.get("ground");
  if(!airEntry?.decoded||!groundEntry?.decoded)return null;
  const multiplier=306/270;
  if(role==="bridge"){
    const [sx,sy,w,h,dx,dy]=landingArt[id].rect;
    return {role,image:airEntry.image,rect:[sx,sy,w,h,dx*multiplier,dy*multiplier,w*2*multiplier,h*2*multiplier]};
  }
  const sx=(f.facing===1?5:225)+(role==="release"?110:0),sy=f.c.id==="lin"?6:136;
  return {role,image:groundEntry.image,rect:[sx,sy,100,124,(f.facing===1?-39:-52)*multiplier,-121*multiplier,200*multiplier,248*multiplier]};
}
