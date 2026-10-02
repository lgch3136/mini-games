const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const BLADE_TIP=[.26,1.55,0];
// Startup reaches the actual strike plane before the first damaging frame.
// Follow-through and recovery continue the same shoulder/hand/blade chain.
export function slashControls(attack,enemyActive=null){
 const chain=attack.chain,start=[3,4,6][chain],active=enemyActive??[5,6,7][chain],q=attack.frame;
 const anticipation={hip:[-.18,1.32,0],chest:[-.08,2.24,0],head:[-.02,2.56,0],handF:[-.28,2.96,.34],handB:[.14,2.12,-.25],footF:[.63,0,.18],footB:[-.61,0,-.18],swordAngle:.75,chestTwist:-.2,hipTwist:-.12};
 const first=[
  {hip:[.02,1.35,0],chest:[.36,2.23,0],head:[.44,2.57,0],handF:[1.35,2.03,.34],handB:[.40,2.1,-.24],swordAngle:-1.03,chestTwist:.24,hipTwist:.13},
  {hip:[.08,1.28,0],chest:[.60,2.13,0],head:[.67,2.46,0],handF:[1.53,1.66,.35],handB:[.47,1.96,-.22],swordAngle:-1.87,chestTwist:.30,hipTwist:.14},
  {hip:[.23,1.26,0],chest:[.74,2.13,0],head:[.85,2.47,0],handF:[1.82,1.85,.36],handB:[.80,1.98,-.21],swordAngle:-1.54,chestTwist:.34,hipTwist:.18},
 ][chain];
 const last=[
  {...first,handF:[1.02,1.37,.34],handB:[.37,1.97,-.22],swordAngle:-1.99},
  {...first,chest:[.34,2.40,0],head:[.42,2.73,0],handF:[1.02,2.90,.35],handB:[.3,2.24,-.21],swordAngle:.18},
  {...first,chest:[.53,2.08,0],head:[.68,2.43,0],handF:[1.38,1.92,.37],handB:[.55,1.83,-.18],swordAngle:-2.47},
 ][chain];
 const pose={...anticipation};
 const blend=(a,b,t)=>{for(const key of Object.keys(b))pose[key]=Array.isArray(b[key])?mix(a[key]??b[key],b[key],t):(a[key]??b[key])+(b[key]-(a[key]??b[key]))*t;};
 if(q<start)blend(anticipation,first,smooth((q-start+2)/2));
 else blend(first,last,enemyActive?clamp((q-start)/Math.max(1,active-1),0,1):smooth((q-start)/Math.max(1,active-1)));
 pose.footF=[chain===2?.87:.68,0,.18];pose.footB=[chain===2?-.75:-.65,0,-.18];
 return {pose,weight:q<start?1:1-smooth((q-start-active)/9)};
}
