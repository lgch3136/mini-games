// Render-only motion accents. World attack clocks, velocities, hitboxes and cues are not consulted differently.
const clip=n=>Math.max(0,Math.min(1,n));
const ease=n=>(n=clip(n),n*n*(3-2*n));
const mix=(a,b,t)=>a+(b-a)*t;
const tween=(a,b,t)=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,Array.isArray(v)?v.map((n,i)=>mix(n,b[k][i],t)):mix(v,b[k],t)]));
const sweepLoad={hip:[-.32,1.02,0],chest:[-.49,1.78,0],head:[-.46,2.12,0],handF:[-.78,1.22,.43],handB:[.16,1.55,-.31],footF:[.92,.015,.22],footB:[-1.04,.02,-.22],swordAngle:-2.16};
const sweepCut={hip:[.19,.93,0],chest:[.63,1.61,0],head:[.88,1.85,0],handF:[1.04,.70,.38],handB:[-.30,1.43,-.24],footF:[1.08,.022,.22],footB:[-.90,.028,-.22],swordAngle:-1.75};
const leapLoad={hip:[-.25,1.01,0],chest:[.13,1.83,0],head:[.41,2.17,0],handF:[.03,2.84,.40],handB:[-.56,1.55,-.27],footF:[.37,.02,.20],footB:[-.52,.03,-.19],swordAngle:.80};
const leapTuck={hip:[.05,1.48,0],chest:[.28,2.30,0],head:[.49,2.53,0],handF:[-.22,2.81,.42],handB:[.83,1.93,-.27],footF:[.85,1.05,.24],footB:[-.59,.88,-.22],swordAngle:.45};
const leapDrop={hip:[.10,1.48,0],chest:[.49,2.18,0],head:[.67,2.42,0],handF:[1.00,1.54,.38],handB:[-.42,1.94,-.27],footF:[.51,.31,.22],footB:[-.58,.42,-.22],swordAngle:-1.61};
export function guardianMovePose(a){
 if(a.kind!=='boss')return null;
 if(a.state==='tell'&&(a.choice===1||a.choice===2)){
  const duration=a.hp<24?.38:.55, timeline=ease((1-a.timer/duration)/.46);
  return {pose:a.choice===1?sweepLoad:leapLoad,weight:.92*timeline};
 }
 if(a.state==='sweep'){
  const p=clip(1-a.timer/.44);
  return {pose:tween(sweepLoad,sweepCut,ease(p/.59)),weight:.92-.41*ease((p-.75)/.25)};
 }
 if(a.state==='leap'){
  const p=clip(1-a.timer/.85);
  const close=ease((p-.48)/.39), rise=ease(p/.19);
  return {pose:tween(tween(leapLoad,leapTuck,rise),leapDrop,close),weight:.92-.62*ease((p-.78)/.22)};
 }
 return null;
}
