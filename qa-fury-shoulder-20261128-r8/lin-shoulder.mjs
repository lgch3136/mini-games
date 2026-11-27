// Visual only. Map physical action phases to an upper-body shear/settle.
// At the waist line the mapping is exactly the identity; shoes and rising/impact cels are untouched.
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{const q=Math.max(0,Math.min(1,x));return q*q*(3-2*q);};
export function linShoulder({frame,startup,active,connected=false,role}) {
  if (!Number.isFinite(frame) || !Number.isFinite(startup) || !Number.isFinite(active) ||
      frame<0 || startup<2 || active<1) return null;
  if(frame<startup && (role==="punch/load" || role==="punch/commit")) {
    const p=frame/(startup-1);
    // First rear-weight and sink, then open the shoulder toward the opponent.
    const inLoad=smooth(p/.48);
    const toOpen=smooth((p-.48)/.52);
    return {phase:"load",shear:lerp(.09*inLoad,-.14,toOpen),height:lerp(1-.15*inLoad,.94,toOpen)};
  }
  const returnFrame=frame-startup-active;
  if (!connected && returnFrame>=0 && returnFrame<7 && role==="punch/return/whiff") {
    const p=smooth(returnFrame/7);
    return {phase:"miss",shear:lerp(.19,0,p),height:lerp(.9,1,p)};
  }
  return null;
}
