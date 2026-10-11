// Derived from verified air-actions A; fresh validation required. Physics owns root.
import {readR19ContactRebase} from './r19-contact-frame-rebuilt-a.mjs';
import {rollSoleFrame} from '../../emberwild-r21-spell-hold-continuity-study/runtime/sole-pivot.mjs';
// Original whole-body motion prototype. Timings are authored here, not copied
// from a commercial animation. hero remains exclusively owned by game physics.
export const MOTION_REVISION='r21-contact-integration-local-C9-trial5';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const lerp=(a,b,t)=>a+(b-a)*t;
const base={pelvis:[0,0,0],spine:[0,0,0],chest:[0,0,0],neck:[0,0,0],head:[0,0,0],clavicleL:[0,0,-.035],clavicleR:[0,0,.035],upperArmL:[-.12,0,-.06],upperArmR:[-.10,.08,.10],elbowL:[-.30,0,0],elbowR:[-.60,0,0],wristL:[0,0,0],wristR:[.20,.35,.03],upperLegL:[0,0,0],upperLegR:[0,0,0],kneeL:[.12,0,0],kneeR:[.12,0,0],ankleL:[0,0,0],ankleR:[0,0,0],capeUpper:[.08,0,0],capeLower:[.03,0,0],hipPanelL:[0,0,-.02],hipPanelR:[0,0,.02]};
const fresh=()=>({rot:Object.fromEntries(Object.entries(base).map(([k,v])=>[k,[...v]])),offset:[0,0,0],feet:{L:[-.14,.11,.02],R:[.14,.11,.02]},groundIK:1,phase:'ready'});
function pose(rot={},offset=[0,0,0],feet=null){return {rot,offset,feet};}
function blend(a,b,t){const out={rot:{},offset:a.offset.map((v,i)=>lerp(v,b.offset[i],t)),feet:null};for(const k of new Set([...Object.keys(a.rot),...Object.keys(b.rot)]))out.rot[k]=(a.rot[k]??base[k]??[0,0,0]).map((v,i)=>lerp(v,(b.rot[k]??base[k]??[0,0,0])[i],t));if(a.feet||b.feet)out.feet=Object.fromEntries(['L','R'].map(k=>[k,(a.feet?.[k]??[k==='L'?-.14:.14,.11,.02]).map((v,i)=>lerp(v,(b.feet?.[k]??a.feet?.[k]??[k==='L'?-.14:.14,.11,.02])[i],t))]));return out;}
function keySample(keys,t){if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(t<=keys[i][0])return blend(keys[i-1][1],keys[i][1],smooth((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));return keys.at(-1)[1];}
function numberKeys(keys,t){if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(t<=keys[i][0])return lerp(keys[i-1][1],keys[i][1],smooth((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));return keys.at(-1)[1];}
function put(out,p,w=1){for(const [k,v]of Object.entries(p.rot))out.rot[k]=(out.rot[k]??[0,0,0]).map((x,i)=>lerp(x,v[i],w));out.offset=out.offset.map((x,i)=>lerp(x,p.offset[i],w));if(p.feet)for(const side of ['L','R'])out.feet[side]=out.feet[side].map((x,i)=>lerp(x,p.feet[side][i],w));}

// Airborne actions keep the physics-owned trajectory, jump pelvis, leg bend,
// takeoff contacts and landing support. Only the upper-body channels participate.
// Grounded sampling remains byte-for-byte the established authored behavior.
const airActionBones=new Set(['spine','chest','neck','head','clavicleL','clavicleR','upperArmL','upperArmR','elbowL','elbowR','wristL','wristR']);
function putAction(out,p,w,grounded){
 if(grounded){put(out,p,w);return;}
 for(const [name,value] of Object.entries(p.rot))if(airActionBones.has(name))out.rot[name]=(out.rot[name]??base[name]).map((v,i)=>lerp(v,value[i],w));
}

// Five authored silhouettes: compress, push, asymmetric gather, reach, absorb.
const crouch=pose({pelvis:[.12,0,0],spine:[.24,0,0],chest:[-.06,0,0],neck:[-.18,0,0],upperLegL:[-.72,0,-.07],upperLegR:[-.65,0,.07],kneeL:[1.35,0,0],kneeR:[1.27,0,0],upperArmL:[.40,0,-.16],upperArmR:[.22,.10,.12],elbowL:[-.9,0,0],elbowR:[-.65,0,0],clavicleL:[.06,-.06,-.065],clavicleR:[.06,.06,.065],capeUpper:[.14,0,0]},[0,-.18,-.06]);
const push=pose({pelvis:[-.025,0,0],spine:[-.05,0,0],chest:[-.025,0,0],neck:[.055,0,0],upperLegL:[-.08,0,-.06],upperLegR:[-.04,0,.06],kneeL:[.20,0,0],kneeR:[.18,0,0],upperArmL:[-.65,0,-.17],upperArmR:[-.18,.10,.15],elbowL:[-.68,0,0],elbowR:[-.60,0,0],clavicleL:[-.06,0,-.075],clavicleR:[-.06,0,.075],ankleL:[.20,0,0],ankleR:[.20,0,0],capeUpper:[.35,0,0]},[0,0,.015]);
const gather=pose({pelvis:[.15,.045,.015],spine:[.19,-.085,.045],chest:[-.025,.035,-.01],neck:[-.22,0,-.025],upperLegL:[-1.03,-.08,-.10],upperLegR:[-.62,.06,.10],kneeL:[1.70,0,0],kneeR:[1.08,0,0],upperArmL:[-.35,0,-.23],upperArmR:[-.08,.16,.20],elbowL:[-.92,0,0],elbowR:[-.70,0,0],clavicleL:[0,0,-.095],clavicleR:[0,0,.085],ankleL:[.08,0,0],ankleR:[.16,0,0],capeUpper:[.32,0,0],capeLower:[.18,0,0]},[0,-.025,0]);
const reach=pose({pelvis:[.075,0,0],spine:[.16,0,0],chest:[-.03,0,0],neck:[-.15,0,0],upperLegL:[-.20,0,-.075],upperLegR:[-.46,0,.075],kneeL:[.32,0,0],kneeR:[.83,0,0],upperArmL:[.12,0,-.22],upperArmR:[.10,.12,.18],elbowL:[-.70,0,0],elbowR:[-.62,0,0],ankleL:[-.06,0,0],ankleR:[.05,0,0],capeUpper:[.16,0,0]},[0,-.035,-.025]);
const absorb=pose({pelvis:[.11,0,0],spine:[.24,0,0],chest:[-.03,0,0],neck:[-.23,0,0],upperArmL:[.32,0,-.24],upperArmR:[.12,.12,.20],elbowL:[-.95,0,0],elbowR:[-.72,0,0],clavicleL:[.02,0,-.09],clavicleR:[.02,0,.075],capeUpper:[.32,0,0],capeLower:[.12,0,0]},[0,-.24,-.04],{L:[-.18,.11,.14],R:[.18,.11,-.11]});

// The three spells retain existing gameplay clocks. All three respond at once;
// a common 60 ms entry reveals distinct support, back line and arm silhouettes.
const spellPoses={
 emberBolt:{duration:.34,recovery:.22,load:pose({pelvis:[.035,.16,.05],spine:[.09,-.08,-.05],chest:[-.025,-.40,-.025],neck:[-.10,.32,.025],upperArmL:[.10,.18,-.55],elbowL:[-1.44,0,0],wristL:[-.22,.35,0],upperArmR:[.04,0,.13],elbowR:[-.65,0,0],clavicleL:[.03,-.08,-.10]},[.045,-.075,-.06],{L:[-.19,.11,.15],R:[.20,.11,-.16]}),release:pose({wristR:[.20,.35,.03],pelvis:[.045,-.10,-.025],spine:[.10,.10,.015],chest:[.05,.24,.035],neck:[-.17,-.24,-.01],upperArmL:[-1.38,-.50,-.20],elbowL:[-.12,0,0],wristL:[.08,0,0],upperArmR:[.10,0,.16],elbowR:[-.75,0,0],clavicleL:[-.07,.05,-.10]},[0,-.04,.045],{L:[-.19,.11,.15],R:[.20,.11,-.16]})},
 frostLance:{duration:.48,recovery:.30,load:pose({pelvis:[.025,.30,0],spine:[.035,.13,0],chest:[-.055,.13,0],neck:[-.02,-.48,0],upperArmL:[-1.05,-.52,-.20],elbowL:[-1.03,0,0],wristL:[-.16,0,-.1],upperArmR:[-.20,.08,.17],elbowR:[-.62,0,0],clavicleL:[-.04,0,-.10]},[.03,-.065,-.065],{L:[-.17,.11,.24],R:[.19,.11,-.20]}),release:pose({wristR:[.20,.35,.03],pelvis:[.05,.24,-.015],spine:[.14,-.08,.015],chest:[.03,-.16,0],neck:[-.19,0,0],upperArmL:[-1.53,.03,-.035],elbowL:[-.08,0,0],wristL:[.025,0,0],upperArmR:[-.10,.12,.19],elbowR:[-.75,0,0],clavicleL:[-.06,0,-.12]},[-.03,-.055,.07],{L:[-.17,.11,.24],R:[.19,.11,-.20]})},
 starfall:{duration:.65,recovery:.40,load:pose({pelvis:[-.045,0,0],spine:[-.06,0,0],chest:[-.06,0,0],neck:[.11,0,0],upperArmL:[-2.05,.04,-.46],upperArmR:[-1.70,-.04,.40],elbowL:[-.60,0,0],elbowR:[-.67,0,0],wristL:[-.08,-.12,0],wristR:[0,.08,0],clavicleL:[-.08,-.04,-.12],clavicleR:[-.06,.04,.10],capeUpper:[.20,0,0]},[0,-.13,-.04],{L:[-.245,.11,.03],R:[.245,.11,-.04]}),release:pose({wristR:[.20,.35,.03],pelvis:[.035,0,0],spine:[.14,0,0],chest:[.065,0,0],neck:[-.16,0,0],upperArmL:[-1.50,0,-.18],upperArmR:[-1.12,0,.22],elbowL:[-.16,0,0],elbowR:[-.46,0,0],wristL:[.12,0,0],clavicleL:[-.08,0,-.12],clavicleR:[-.055,0,.09],capeUpper:[.35,0,0]},[0,-.035,.04],{L:[-.245,.11,.03],R:[.245,.11,-.04]})}
};
const combatReady=pose({pelvis:[.025,-.04,0],spine:[.04,.025,0],chest:[.015,.035,0],neck:[-.055,-.02,0],upperArmL:[-.34,.04,-.13],elbowL:[-.8,0,0],upperArmR:[-.18,.10,.15],elbowR:[-.78,0,0],wristR:[.28,.30,.04]},[0,-.035,0],{L:[-.17,.11,.095],R:[.17,.11,-.055]});

export function sampleWholeBody({time=0,gaitPhase=0,speed=0,airAge=0,landAge=Infinity,grounded=true,verticalVelocity=0,altitude=0,landingStrength=1,attackTime=0,cast=null,recovery=null,readyWeight=0,airLead='L',airTravel=0,dodgeTime=0,castKind=null,castAge=0,gait='run',releasedDash=false}={}){
 const out=fresh();
 // Original supported resting pose: small right-side load, opposing ribcage,
 // steady gaze. No root motion, scaling or large idle sway. The foot controller
 // retains its real world contacts and solves both legs under the shifted pelvis.
 const idleWeight=grounded&&!cast&&!recovery&&attackTime<=0?(1-smooth(speed/1.0))*(1-clamp(readyWeight))*(Number.isFinite(landAge)?smooth((landAge-.25)/.25):1):0;
 if(idleWeight){const breath=Math.sin(time*Math.PI*2/4.8);put(out,pose({pelvis:[.025,-.055,.070],spine:[.045,.035,-.065],chest:[-.025+.004*breath,.060,-.035],neck:[-.020,-.065,.030],upperArmL:[.025,0,-.020],elbowL:[-.24,0,0],wristL:[.05,.04,-.09]},[.075,-.055+.003*breath,-.025]),idleWeight);out.phase='supported-idle';}
 if(readyWeight)put(out,combatReady,clamp(readyWeight));
 const moving=clamp(speed/4.8),idle={rot:Object.fromEntries(Object.entries(out.rot).map(([k,v])=>[k,[...v]])),offset:[...out.offset],feet:{L:[...out.feet.L],R:[...out.feet.R]}};
 if(grounded&&moving>.001){
  const cadence=gait==='walk'?.85+.40*clamp(speed/1.55):1.5+1.15*clamp(speed/4.8),cycle=((gaitPhase%1)+1)%1,turn=Math.sin(cycle*Math.PI*2),bob=Math.cos(cycle*Math.PI*4);
  // Compression follows contact rather than peaking at the contact instant.
  // Left support u=0..0.4, right support u=.5.. .9; deepest load around .15/.65,
  // then extend into the .4/.9 release. Physics root and planted feet are unchanged.
  const load=Math.cos((cycle-.15)*Math.PI*4),stride=Math.cos(cycle*Math.PI*2),shoulderTurn=Math.cos((cycle-.055)*Math.PI*2);
  out.offset=[-.045*turn+.006,-.108-.038*load,.025];out.rot.pelvis=[.075+.025*load,.105*stride,.04*turn];out.rot.spine=[.13+.045*load,-.125*shoulderTurn,-.025*turn];out.rot.chest=[.095+.02*load,-.16*shoulderTurn,-.03*turn+.02];out.rot.neck=[-.27-.07*load,.12*shoulderTurn,-.02];
  for(const [side,sign,shift]of [['L',-1,0],['R',1,.5]]){const u=(cycle+shift)%1,stance=gait==='walk'?.62:.40,travel=speed/cadence*stance,half=travel/2;let z,y;
   if(u<stance){z=lerp(half,-half,u/stance);y=.11;}else{const s=(u-stance)/(1-stance);const m=-travel*(1-stance)/stance;z=(2*s**3-3*s*s+1)*(-half)+(s**3-2*s*s+s)*m+(-2*s**3+3*s*s)*half+(s**3-s*s)*m;y=.11+(gait==='walk'?.08:.23)*Math.sin(Math.PI*s)**1.25;}
   out.feet[side]=[sign*.15,y,z];const swing=Math.cos((cycle+shift-.025)*Math.PI*2);out.rot['upperArm'+side]=[.67*swing,sign*.06,sign*(.12+.03*Math.cos(cycle*Math.PI*2))];out.rot['elbow'+side]=[-.85-.25*Math.max(0,-swing),0,0];out.rot['clavicle'+side]=[.025*swing,-sign*.04*swing,sign*.055];out.rot['wrist'+side]=[.05*swing,0,0];
   // The free forearm counter-swings with a neutral inward-facing hand.
   // Keep fingers open and sword/cast/airborne channels unchanged.
   if(side==='L')out.rot.wristL[1]=1.10;
   // Carry the actual sword with a smaller, steadier right-arm arc; the free
   // arm retains the counter-swing. This does not reduce the attack stroke.
   if(side==='R'){const heldSwing=Math.cos((cycle+shift-.025)*Math.PI*2);out.rot.upperArmR=[.27*heldSwing,.08,.15];out.rot.elbowR=[-.56-.08*Math.max(0,-heldSwing),0,0];out.rot.wristR=[.20,.35,.03];out.rot.clavicleR=[.012*heldSwing,-.018*heldSwing,.055];}
  }
  out.rot.capeUpper=[.18+.045*bob,0,.035*turn];out.rot.capeLower=[.10-.04*bob,0,-.02*turn];const intensity=smooth(clamp(speed/3.8));for(const [k,v]of Object.entries(out.rot))out.rot[k]=v.map((x,i)=>lerp(idle.rot[k][i],x,intensity));out.offset=out.offset.map((x,i)=>lerp(idle.offset[i],x,intensity));for(const side of ['L','R'])out.feet[side]=out.feet[side].map((x,i)=>lerp(idle.feet[side][i],x,intensity));out.phase=gait==='walk'?'walk':'run';
 }
 if(!grounded){
  // A running push has a forward swing knee and a lengthening trail leg.
  // It need not pass through the standing jump's two-leg straight silhouette.
  // This is a pose-only 145ms key: physical launch and contact clocks stay fixed.
  const runPush=pose({...push.rot,pelvis:[.055,0,0],spine:[.10,0,0],chest:[.035,0,0],neck:[-.14,0,0],upperLegL:[-.62,0,-.06],kneeL:[1.02,0,0],ankleL:[.08,0,0],upperLegR:[.06,0,.06],kneeR:[.28,0,0],ankleR:[.24,0,0]},[0,-.015,.03]);
  const launch=airTravel>0?blend(push,runPush,airTravel):push;
  let p;if(airAge<.145){p=keySample([[0,pose()],[.032,crouch],[.145,launch]],airAge);out.phase=airAge<.04?'compress':'push';}
  else if(verticalVelocity>-.6){p=keySample([[.145,launch],[.285,gather]],airAge);out.phase=verticalVelocity>1?'gather':'apex';}
  else{const r=Math.max(smooth((-verticalVelocity-.6)/3.4),(1-smooth(altitude/.52))*smooth((-verticalVelocity-.6)/1.2));p=blend(gather,reach,r);out.phase='reach';}
  // Pose-only readability: preserve the exact first 82 ms of captured-foot
  // compression/release, then gather sooner instead of displaying an almost
  // straight leg at 130-170 ms. At 225 ms reach the existing gather silhouette;
  // ordinary jumps rejoin the existing pose by 285 ms. Existing action/landing
  // transitions can capture the refined pose; their tails are reviewed separately.
  if(airAge>.082&&airAge<.285&&verticalVelocity>-.6)
   p=blend(p,gather,smooth((airAge-.082)/.143));
  // A dash has already loaded the body. Its cancellation releases the actual
  // pose toward gather, without restarting a ground compression in midair.
  // This rejoins the unchanged authored gather at285ms, or landing cancels it.
  if(releasedDash&&airAge<.285)p=blend(p,gather,1);
  if(airTravel>0){
   // Keep the real forward swing leg as the lead instead of changing every
   // running launch into the same left-leading airborne pose. The held sword
   // arm stays on its original side; only leg/balance channels are mirrored.
   p=blend(p,p,0);
   if(airLead==='R'){
    for(const prefix of ['upperLeg','knee','ankle']){const l=[...(p.rot[prefix+'L']??base[prefix+'L'])],r=[...(p.rot[prefix+'R']??base[prefix+'R'])];p.rot[prefix+'L']=[r[0],-r[1],-r[2]];p.rot[prefix+'R']=[l[0],-l[1],-l[2]];}
    for(const key of ['pelvis','spine','chest','neck'])if(p.rot[key]){p.rot[key][1]*=-1;p.rot[key][2]*=-1;}
    p.offset[0]*=-1;
   }
   const travel=airTravel*smooth((airAge-.06)/.12)*(1-smooth((-verticalVelocity-1)/4));
   for(const[key,amount]of [['spine',.075],['chest',.045],['neck',-.09]]){p.rot[key]??=[...base[key]];p.rot[key][0]+=amount*travel;}
   p.offset[2]+=.025*travel;
   p.rot.upperArmL??=[...base.upperArmL];p.rot.upperArmL[0]+=(airLead==='L'?.35:-.20)*travel;
   p.rot.wristL??=[...base.wristL];p.rot.wristL[1]+=.50*travel;
  }
  put(out,p);const plant=.5*(1-smooth(airAge/.170));out.offset[1]-=altitude*plant;out.groundIK=1-smooth((airAge-.012)/.070);
 }else if(landAge<.31){
  const amount=landAge<.045?smooth(landAge/.045):1-smooth((landAge-.11)/.20),resume=1-moving*smooth(landAge/.095);put(out,absorb,amount*landingStrength*resume);out.phase='absorb';
 }
 const locomotionPhase=out.phase;
 if(attackTime>0){
  // Original diagonal cut authored around the actual 0.92 m sword. Load to
  // the weapon side, cut through the forward center plane, then follow across.
  // Existing 78/170/240/440 ms gameplay markers are unchanged.
  const stance={L:[-.20,.11,.16],R:[.14,.11,.02]};
  const t=.44-attackTime,wind=pose({pelvis:[.035,.14,-.02],spine:[.025,.10,-.035],chest:[-.025,.19,-.06],neck:[-.02,-.37,.025],clavicleR:[-.08,.04,.10],upperArmR:[-1.05,.48,.35],elbowR:[-1.12,0,0],wristR:[.10,.12,-.12],upperArmL:[-.35,-.10,-.23],elbowL:[-.88,0,0]},[.035,-.09,-.055],stance);
  const hit=pose({pelvis:[.08,-.08,.015],spine:[.07,-.06,.015],chest:[.075,-.16,.04],neck:[-.17,.25,-.015],clavicleR:[-.05,-.06,.07],upperArmR:[-1.30,.05,-.07],elbowR:[-.12,0,0],wristR:[1.38,.18,-.12],upperArmL:[.08,0,-.29],elbowL:[-.86,0,0]},[-.025,-.075,.045],stance);
  const follow=pose({pelvis:[.075,-.20,.03],spine:[.075,-.10,.025],chest:[.085,-.21,.11],neck:[-.18,.43,-.07],clavicleR:[.025,-.08,.05],upperArmR:[-.82,-.55,-.08],elbowR:[-.35,0,0],wristR:[1.034989534589054,.07478409017695763,.020468571622429398],upperArmL:[-.72,.18,-.20],elbowL:[-1.10,0,0],wristL:[0,.70,.15]},[-.040,-.070,.020],stance);
  putAction(out,keySample([[0,combatReady],[.078,wind],[.17,hit],[.205,blend(hit,follow,.70)],[.24,follow],[.29,blend(follow,combatReady,.07)],[.44,combatReady]],t),smooth(t/.06),grounded);if(t>.17)out.forearmRollR=numberKeys([[.17,0],[.205,.78*.70],[.24,.78],[.29,.78*.93],[.44,0]],t);out.phase=t<.09?'attack-load':t<.19?'attack-strike':'attack-follow';
 }else if((grounded&&cast)||recovery){
  const ev=cast??recovery,s=spellPoses[ev.spellId];if(s){let p,w=1;if(cast){w=smooth(ev.age/.06);const u=ev.age/s.duration,gatherProgress=.35+.65*smooth(u);p=blend(combatReady,s.load,gatherProgress);// Fire is a short scoop-and-flick: finish the authored extension at the
   // unchanged launch, not 41.8ms into recovery. Ice/arcane clocks and poses
   // retain their existing sequence. This is pose timing only, no input delay.
   const fire=ev.spellId==='emberBolt';
   if(fire&&u>.72)p=blend(p,s.release,smooth((u-.72)/(1-.72)));else if(ev.spellId==='frostLance'&&u>.85)p=blend(p,s.release,smooth((u-.85)/.15));else if(!fire&&u>.85)p=blend(p,s.release,.45*smooth((u-.85)/.15));out.phase='spell-'+ev.spellId+'-load';}else{const u=ev.age/s.recovery;p=keySample((ev.spellId==='emberBolt'||ev.spellId==='frostLance')?[[0,s.release],[.42,s.release],[1,combatReady]]:[[0,blend(s.load,s.release,.45)],[.19,s.release],[.42,s.release],[1,combatReady]],u);out.phase='spell-'+ev.spellId+'-release';}putAction(out,p,w,grounded);}
 }
 // These are independent presentation clocks: choosing a higher-priority body
 // never clears, restarts, or advances a lower-priority gameplay action.
 if(attackTime<=0&&dodgeTime>0){
  const u=clamp((.32-dodgeTime)/.32),w=Math.sin(Math.PI*u);
  const dash=pose({pelvis:[.12,0,0],spine:[.28,0,-.025],chest:[.10,0,0],neck:[-.30,0,.025],upperArmL:[.38,0,-.20],elbowL:[-.95,0,0],upperArmR:[.12,.08,.17],elbowR:[-.72,0,0],kneeL:[.6,0,0],kneeR:[.45,0,0],capeUpper:[.35,0,0]},[0,-.16,-.03]);
  putAction(out,dash,w,grounded);out.phase=grounded?'dodge':'airborne-dodge';
 }else if(attackTime<=0&&!cast&&!recovery&&castKind){
  const duration=castKind==='potion'?.72:.52,u=clamp(castAge/duration),w=smooth(u/.20)*(1-smooth((u-.65)/.35));
  const utility=castKind==='potion'?pose({spine:[.055,0,-.035],chest:[.025,0,-.04],neck:[-.09,0,.035],upperArmL:[-.55,.05,-.20],elbowL:[-1.45,0,0],wristL:[-.15,.25,-.05]},[0,-.025,0]):pose({spine:[.07,0,0],chest:[.045,0,0],neck:[-.10,0,0],upperArmL:[-.85,-.20,-.23],elbowL:[-.75,0,0],wristL:[.05,.10,0]},[0,-.035,0]);
  // Utility gestures preserve moving/airborne legs and support. Their small
  // upper-body load is also valid while the utility timer overlaps locomotion.
  putAction(out,utility,w,false);out.phase='utility-'+castKind;
 }
 if(!grounded&&(attackTime>0||recovery||dodgeTime>0||castKind))out.locomotionPhase=locomotionPhase;
 return out;
}

export function createWholeBodyController(T,root,{height=()=>0}={}){
 const sampleHeight=height;height=(x,z)=>{const value=sampleHeight(x,z);if(!Number.isFinite(value))throw Error('Terrain returned a nonfinite support sample');return value;};
 const nodes={};root.traverse(o=>{if(!o.isMesh)nodes[o.name]=o;});for(const n of Object.keys(base))if(!nodes[n])throw Error('R21 missing '+n);
 const rest=new Map(Object.values(nodes).map(o=>[o,{p:o.position.clone(),q:o.quaternion.clone()}]));
 // Sole pivots are derived from the actual explicit contact vertices in ankle
 // rest space, not mesh bounds or assumed toe/heel dimensions.
 const soleLocalSamples={L:null,R:null};const pivots={L:null,R:null},rollState={L:{angle:0,offset:new T.Vector3()},R:{angle:0,offset:new T.Vector3()}};
 let launchRoll=null,airLead='L',airTravel=0,landingReachWeight=0,landingReachLocalTargets=null;
 root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 root.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.contactRole!=='sole')return;const side=mesh.userData.side,ankle=nodes['ankle'+side],ids=mesh.userData.contactVertexIndices;
  if(!ankle||!ids?.length)throw Error('R21 sole contact contract missing');const points=ids.map(i=>ankle.worldToLocal(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld)));
  const lo=Math.min(...points.map(p=>p.z)),hi=Math.max(...points.map(p=>p.z)),mean=ps=>ps.reduce((v,p)=>v.add(p),new T.Vector3()).divideScalar(ps.length);
  soleLocalSamples[side]=points.map(p=>p.clone());pivots[side]={heel:mean(points.filter(p=>p.z<lo+1e-6)),front:mean(points.filter(p=>p.z>hi-1e-6))};
 });
 for(const side of ['L','R'])if(!pivots[side])throw Error('R21 missing explicit sole '+side);
 const xAxis=new T.Vector3(1,0,0),yAxis=new T.Vector3(0,1,0),zAxis=new T.Vector3(0,0,1),qX=new T.Quaternion(),qZ=new T.Quaternion(),worldQ=new T.Quaternion(),desiredQ=new T.Quaternion();
 let time=0,gaitPhase=.2,airAge=0,landAge=Infinity,previousGrounded=true,lastVy=0,landingStrength=1,ready=0,visualSpeed=0,initialized=false,lastPose=null,transition=null,restAge=0,stanceQueue=[];
 let landingHandoff=null,lastSoleClearance={L:Infinity,R:Infinity},dashAcquisition=null;
 let dashAirRelease=null,dashAirFlight=false,airSoleProjection=null;
 const releaseBones=new Set(['pelvis','upperLegL','upperLegR','kneeL','kneeR','ankleL','ankleR']);
 let aerialReleaseRoot=null,aerialReleasePelvis=null;let dashFeet=null,lastDodgeTime=0,currentGait='run',utilityKind=null,utilityAge=0;
 let lastRoot=root.position.clone(),lastSpeed=0,moving=false,stopCadence=0,lastAction=null,lastActionAge=0,lastEventKind=null;
 const actualPlanner={L:null,R:null},actualVelocity={L:new T.Vector3(),R:new T.Vector3()};const contacts={L:null,R:null},lastFootWorld={L:null,R:null},soleMeshes=[];root.traverse(o=>{if(o.isMesh&&o.userData.contactRole==='sole')soleMeshes.push(o);});let soleCorrection=0;
 function heading(){const f=new T.Vector3(0,0,1).applyQuaternion(root.quaternion);return Math.atan2(f.x,f.z);}
 function floorTarget(x,z,lift=0){const e=.06,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e),up=new T.Vector3(-dx,1,-dz).normalize();return {point:new T.Vector3(x,height(x,z)+.11/up.y+lift,z),up,dx,dz};}
 function localGoal(side,z=.02,x=null){return new T.Vector3(x??(side==='L'?-.15:.15),0,z).applyMatrix4(root.matrixWorld);}
 function saveTransforms(){return new Map(Object.values(nodes).map(o=>[o,{p:o.position.clone(),q:o.quaternion.clone()}]));}
 // Planner captures remain in its old flat-foot reference. The deliberate
 // roll offset is stored root-local so changing heading cannot double-apply it.
 function plannerFoot(side){return nodes['ankle'+side].getWorldPosition(new T.Vector3()).sub(rollState[side].offset.clone().applyQuaternion(root.quaternion));}
 function clearRoll(){for(const side of ['L','R']){rollState[side].angle=0;rollState[side].offset.set(0,0,0);}launchRoll=null;}
 function floorOrientation(target){const ground=floorTarget(target.x,target.z),forward=new T.Vector3(0,0,1).applyQuaternion(root.quaternion);forward.y=ground.dx*forward.x+ground.dz*forward.z;forward.normalize();const right=new T.Vector3().crossVectors(ground.up,forward).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,ground.up,forward));}
 function handoffFloor(side,x,z){
  const point=floorTarget(x,z).point,q=floorOrientation(point),angle=landingHandoff?.free===side&&Number.isFinite(landingHandoff.roll)?landingHandoff.roll:rollState[side].angle,pivot=angle<0?pivots[side].heel:pivots[side].front,frame=rollSoleFrame(T,point,q,pivot,angle);
  let gap=Infinity;for(const sample of soleLocalSamples[side]){const v=sample.clone().applyQuaternion(frame.quaternion).add(frame.ankle);gap=Math.min(gap,v.y-height(v.x,v.z));}point.y-=gap;return point;
 }
 function phaseRoll(u){
  // A continuous rigid heel-contact -> flat load -> forefoot release shape.
  // Swing prepares the heel before contact. This is not toe-joint bending.
  if(u<.12)return -.12*(1-smooth(u/.12));
  if(u<.22)return 0;
  if(u<.40)return .26*smooth((u-.22)/.18);
  if(u<.68)return .26*(1-smooth((u-.40)/.28));
  return -.12*smooth((u-.68)/.32);
 }
 function captureFeet(){root.updateMatrixWorld(true);for(const s of ['L','R']){const p=plannerFoot(s);contacts[s]={anchor:floorTarget(p.x,p.z).point,start:p.clone(),target:p.clone(),mode:'plant',u:0,progress:0,heading:heading()};}}
 function solveLeg(side,targetWorld,weight){
  if(weight<=0)return;const hip=nodes['upperLeg'+side],knee=nodes['knee'+side],ankle=nodes['ankle'+side];root.updateMatrixWorld(true);
  const ground=floorTarget(targetWorld.x,targetWorld.z),target=targetWorld.clone();hip.parent.worldToLocal(target);target.sub(hip.position);
  const phi=Math.atan2(target.x,-target.y);target.applyAxisAngle(zAxis,-phi);
  const a=rest.get(knee).p,b=rest.get(ankle).p,l1=Math.hypot(a.y,a.z),l2=Math.hypot(b.y,b.z),d=clamp(Math.hypot(target.y,target.z),.20,l1+l2-.001);
  const bend=Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*l1*l2),-1,1)),dir=Math.atan2(target.z,-target.y),thigh=dir+Math.atan2(l2*Math.sin(bend),l1+l2*Math.cos(bend));
  qX.setFromAxisAngle(xAxis,Math.atan2(a.z,-a.y)-thigh);qZ.setFromAxisAngle(zAxis,phi).multiply(qX);hip.quaternion.slerp(qZ,weight);qX.setFromAxisAngle(xAxis,Math.atan2(b.z,-b.y)-Math.atan2(a.z,-a.y)+bend);knee.quaternion.slerp(qX,weight);
  root.updateMatrixWorld(true);ankle.parent.getWorldQuaternion(worldQ);root.getWorldQuaternion(desiredQ);const forward=new T.Vector3(0,0,1).applyQuaternion(desiredQ);forward.y=ground.dx*forward.x+ground.dz*forward.z;forward.normalize();const right=new T.Vector3().crossVectors(ground.up,forward).normalize();desiredQ.setFromRotationMatrix(new T.Matrix4().makeBasis(right,ground.up,forward));desiredQ.premultiply(worldQ.invert());ankle.quaternion.slerp(desiredQ,weight);
 }
 function lockLegPosition(side,target){
  // Exact endpoint with the current knee pole. This preserves the airborne
  // bend plane at contact while upper-body/pose recovery progresses.
  const hip=nodes['upperLeg'+side],knee=nodes['knee'+side],ankle=nodes['ankle'+side];root.updateMatrixWorld(true);
  const H=hip.getWorldPosition(new T.Vector3()),K=knee.getWorldPosition(new T.Vector3()),A=ankle.getWorldPosition(new T.Vector3()),axis=target.clone().sub(H),distance=axis.length();axis.normalize();
  const l1=rest.get(knee).p.length(),l2=rest.get(ankle).p.length(),d=clamp(distance,.05,l1+l2-.00001),along=(l1*l1-l2*l2+d*d)/(2*d),lift=Math.sqrt(Math.max(0,l1*l1-along*along));
  const pole=K.clone().sub(H).addScaledVector(axis,-K.clone().sub(H).dot(axis));if(pole.lengthSq()<1e-9){pole.set(0,0,1).applyQuaternion(root.quaternion);pole.addScaledVector(axis,-pole.dot(axis));}pole.normalize();const desiredK=H.clone().addScaledVector(axis,along).addScaledVector(pole,lift);
  const rotateWorld=(joint,from,to)=>{const delta=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),q=joint.getWorldQuaternion(new T.Quaternion()).premultiply(delta),parent=joint.parent.getWorldQuaternion(new T.Quaternion()).invert();joint.quaternion.copy(parent.multiply(q));root.updateMatrixWorld(true);};
  const ankleQ=ankle.getWorldQuaternion(new T.Quaternion());rotateWorld(hip,K.clone().sub(H),desiredK.clone().sub(H));const actualK=knee.getWorldPosition(new T.Vector3()),actualA=ankle.getWorldPosition(new T.Vector3());rotateWorld(knee,actualA.sub(actualK),target.clone().sub(actualK));ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(ankleQ));
 }
 function stepGoal(side,c,u,cadence,velocity,speed){
  const remaining=(1-u)/cadence,half=speed/cadence*(currentGait==='walk'?.31:.2),goal=localGoal(side,half);goal.addScaledVector(velocity,remaining);return floorTarget(goal.x,goal.z).point;
 }
 // C7: endpoint estimates are never substituted into an in-flight curve.
 // A changed endpoint creates a remaining Hermite trajectory from the last
 // realized planner-space foot and velocity. The root and input remain immediate.
 function swingFloor(side,x,z,angle=0){
  const point=floorTarget(x,z).point,q=floorOrientation(point),pivot=angle<0?pivots[side].heel:pivots[side].front,frame=rollSoleFrame(T,point,q,pivot,angle);let gap=Infinity;
  for(const sample of soleLocalSamples[side]){const v=sample.clone().applyQuaternion(frame.quaternion).add(frame.ankle);gap=Math.min(gap,v.y-height(v.x,v.z));}
  point.y-=gap;return point;
 }
 function trajectoryAt(tr,age){
  const u=clamp(age/tr.duration),u2=u*u,u3=u2*u,Tm=tr.duration;
  const p=tr.start.clone().multiplyScalar(2*u3-3*u2+1).addScaledVector(tr.velocity,Tm*(u3-2*u2+u)).addScaledVector(tr.end,-2*u3+3*u2);
  const v=tr.start.clone().multiplyScalar((6*u2-6*u)/Tm).addScaledVector(tr.velocity,3*u2-4*u+1).addScaledVector(tr.end,(-6*u2+6*u)/Tm);
  const bump=16*u2*(1-u)*(1-u),dbump=32*u*(1-u)*(1-2*u)/Tm;
  p.y+=tr.lift*bump;v.y+=tr.lift*dbump;return {p,v,u};
 }
 function replaceTrajectory(side,c,target,remaining,reason){
  const prior=c.trajectory,start=actualPlanner[side]?.clone()??plannerFoot(side),v=actualVelocity[side].clone();
  const end=swingFloor(side,target.x,target.z),distance=start.distanceTo(end);
  // Joint duration/contact choice: leave enough time to brake the observed
  // foot velocity and traverse the revised distance; do not keep a stale phase
  // deadline when a collision moved the endpoint by most of a leg length.
  const duration=prior&&!prior.finished?Math.max(1e-4,prior.duration-prior.age):Math.max(.09,remaining,distance/12,v.length()/100);
  // An active swing has one monotonically approaching contact deadline.
  // Later estimates may alter its remaining curve, never restart its lifetime.
  const tr={start,velocity:v,end,age:0,duration,lift:0,reason,replans:(prior?.replans??0)+1,rollStart:rollState[side].angle,estimate:target.clone()};
  for(let i=1;i<32;i++){const u=i/32,sample=trajectoryAt(tr,u*duration),floor=swingFloor(side,sample.p.x,sample.p.z,lerp(tr.rollStart,0,smooth(u))).y,bump=16*u*u*(1-u)*(1-u);tr.lift=Math.max(tr.lift,tr.lift+(floor+.015*Math.sin(Math.PI*u)**2-sample.p.y)/bump);}
  tr.lift=Math.max(0,tr.lift);c.trajectory=tr;c.start.copy(start);c.target.copy(end);c.mode='swing';c.landingAge=null;
 }
 function advanceTrajectory(side,c,dt){
  const tr=c.trajectory;tr.age+=dt;const sample=trajectoryAt(tr,tr.age);
  if(sample.u>=1){c.anchor.copy(tr.end);c.mode='plant';c.heading=heading();c.justLanded=true;c.trajectory=null;}
  return sample.p;
 }
 function planFeet(dt,{grounded,speed,velocity,p,action,age,retrigger,dodgeTime}){
  root.updateMatrixWorld(true);if(!contacts.L)captureFeet();
  if(!grounded){
   landingHandoff=null;dashAcquisition=null;
   for(const c of Object.values(contacts)){c.trajectory=null;c.justLanded=false;}
   dashFeet=null;stanceQueue=[];
   // A cancelled travelling swing is not a new planted push-off. During the
   // existing captured-foot IK release, its reference travels with the accepted
   // airborne root instead of being left behind on the terrain.
   if(airAge>=.082){aerialReleaseRoot=null;aerialReleasePelvis=null;}
   const carry=aerialReleaseRoot?root.position.clone().sub(aerialReleaseRoot):new T.Vector3();
   return Object.fromEntries(['L','R'].map(s=>[s,contacts[s].start.clone().add(carry)]));
  }
  aerialReleaseRoot=null;aerialReleasePelvis=null;
  if(landAge<=dt+1e-9&&dodgeTime<=0){
   // The contact frame belongs to the landing, before a new stride. Existing
   // input/root motion remains immediate; locomotion may resume next tick.
   moving=false;landingHandoff=speed>.01&&!action?{armed:true}:null;const result={};
   for(const side of ['L','R']){const c=contacts[side],actual=plannerFoot(side),target=floorTarget(actual.x,actual.z).point,gap=actual.y-target.y;
    c.anchor.copy(target);c.start.copy(actual);c.target.copy(target);c.stopAge=dt;c.stopDuration=.055;c.mode=gap>.04?'landing-step':'plant';
    result[side]=gap>.04?actual.clone().lerp(target,smooth(dt/.055)):target.clone();
   }
   return result;
  }
  if(dodgeTime>0){
   landingHandoff=null;
   for(const c of Object.values(contacts)){c.trajectory=null;c.justLanded=false;}
   // The authored ground dash is a travelling skid. Acquire its support from
   // actual ankle/sole geometry; do not preserve a cancelled swing's height.
   // Its references are root-local, so collision acceptance remains immediate.
   if(!dashAcquisition){
    const support=lastSoleClearance.L<=lastSoleClearance.R+.001?'L':'R';
    dashAcquisition={age:0,support,duration:.12,supportDuration:.06,start:{},gap:{}};
    for(const side of ['L','R']){const foot=actualPlanner[side]?.clone()??plannerFoot(side).addScaledVector(velocity,-dt);dashAcquisition.start[side]=foot.clone().sub(lastRoot).applyQuaternion(root.quaternion.clone().invert());dashAcquisition.gap[side]=Math.max(0,lastSoleClearance[side]);}
   }
   const h=dashAcquisition;h.age+=dt;dashFeet={};
   for(const side of ['L','R']){
    const duration=side===h.support?h.supportDuration:h.duration,u=clamp(h.age/duration),w=smooth(u),start=h.start[side];
    const goal=side===h.support?start.clone():new T.Vector3(side==='L'?-.18:.18,0,-.14),local=start.clone().lerp(goal,w),world=local.applyQuaternion(root.quaternion).add(root.position);
    const roll=lerp(rollState[side].angle,0,1-Math.exp(-dt*38)),foot=swingFloor(side,world.x,world.z,roll);foot.y+=h.gap[side]*(1-w);dashFeet[side]=foot;
    const c=contacts[side];c.anchor.copy(foot);c.start.copy(foot);c.target.copy(foot);c.mode='dash';c.heading=heading();
   }
   moving=false;stanceQueue=[];return Object.fromEntries(['L','R'].map(side=>[side,dashFeet[side].clone()]));
  }
  if(dashFeet){
   // Completed skid releases both references before locomotion/action planning.
   for(const side of ['L','R']){const c=contacts[side],foot=actualPlanner[side]?.clone()??plannerFoot(side);c.anchor.copy(swingFloor(side,foot.x,foot.z,rollState[side].angle));c.start.copy(foot);c.target.copy(c.anchor);c.stopAge=0;c.stopDuration=.09;c.mode=lastSoleClearance[side]>.008?'landing-step':'plant';c.heading=heading();}
   dashFeet=null;dashAcquisition=null;
  }
  // C8 shared transition: acquire the first travelling support before releasing
  // the landing support. Physics and input advance independently as before.
  if(landingHandoff){
   if(landingHandoff.armed){
    const gaps=Object.fromEntries(['L','R'].map(side=>[side,lastSoleClearance[side]]));
    const support=gaps.L<=gaps.R+.001?'L':'R',free=support==='L'?'R':'L';
    contacts[support].anchor.copy(plannerFoot(support).addScaledVector(velocity,-dt));
    const start=plannerFoot(free).addScaledVector(velocity,-dt);let chosen=null;
    // Jointly choose touchdown time and terrain point with room in both legs.
    // This only forecasts presentation from accepted horizontal root velocity.
    for(const duration of [.16,.15,.17,.14,.18]){if(chosen)break;const future=root.position.clone().addScaledVector(velocity,duration);future.y=height(future.x,future.z);
     const futurePose=sampleWholeBody({time:time+duration,gaitPhase:Math.floor(gaitPhase)+(support==='L'?.2:.7),speed:visualSpeed,landAge:landAge+duration,grounded:true,landingStrength});
     const hip=side=>new T.Vector3(side==='L'?-.14:.14,1.02+futurePose.offset[1],0).applyQuaternion(root.quaternion).add(future);
     const maxLength=rest.get(nodes.kneeL).p.length()+rest.get(nodes.ankleL).p.length()-.012;
     if(hip(support).distanceTo(contacts[support].anchor)>maxLength)continue;
     for(const lead of [.17,.14,.11,.08,.05,.02]){const end=new T.Vector3(free==='L'?-.15:.15,0,lead).applyQuaternion(root.quaternion).add(future),target=handoffFloor(free,end.x,end.z);if(hip(free).distanceTo(target)<=maxLength){chosen={duration,target,lead,predictedReachMargin:maxLength-hip(free).distanceTo(target)};break;}}
    }
    // A failed forecast remains observable research evidence, never hidden by
    // moving the root, stretching legs, or suppressing real inputs.
    if(!chosen){const end=localGoal(free,.02);end.addScaledVector(velocity,.195);chosen={duration:.16,target:floorTarget(end.x,end.z).point,lead:null,predictedReachMargin:null,forecastFailed:true};}
    landingHandoff={support,free,start,...chosen,age:0,velocity:velocity.clone(),heading:heading()};
    moving=true;gaitPhase=Math.floor(gaitPhase)+(support==='L'?.2:.7);
   }
   const h=landingHandoff;
   const directionChanged=Math.hypot(velocity.x-h.velocity.x,velocity.z-h.velocity.z)>.35||Math.abs(Math.atan2(Math.sin(heading()-h.heading),Math.cos(heading()-h.heading)))>.28;
   if((speed<=.01||action||directionChanged)&&(!h.replanned||directionChanged)){
    const c=contacts[h.free],g=localGoal(h.free,.02);g.addScaledVector(velocity,Math.max(.09,h.duration-h.age));
    replaceTrajectory(h.free,c,swingFloor(h.free,g.x,g.z),Math.max(.09,h.duration-h.age),'landing-interruption');
    h.replanned=true;h.velocity.copy(velocity);h.heading=heading();h.age=0;h.duration=c.trajectory.duration;h.target.copy(c.trajectory.end);
   }
   if(h.age>=h.duration&&lastSoleClearance[h.free]<=.008){
    // Entry from the actually reached foot, rather than a half-cycle teleport.
    gaitPhase=Math.floor(gaitPhase)+(h.free==='L'?0:.5);
    for(const [side,shift]of [['L',0],['R',.5]]){const c=contacts[side];c.mode='plant';c.initial=true;c.u=(gaitPhase+shift)%1;c.start.copy(plannerFoot(side).addScaledVector(velocity,-dt));c.anchor.copy(side===h.free?h.target:contacts[h.support].anchor);c.landingAge=null;c.trajectory=null;c.justLanded=false;}
    moving=speed>.01;landingHandoff=null;transition={kind:'landing-handoff-exit',age:0,duration:.08,transforms:saveTransforms()};
   }else{
    if(h.replanned){h.age+=dt;const c=contacts[h.free],foot=c.trajectory?advanceTrajectory(h.free,c,dt):h.target.clone();contacts[h.support].mode='plant';return {[h.support]:contacts[h.support].anchor.clone(),[h.free]:foot};}
    h.age+=dt;const progress=clamp(h.age/h.duration);h.roll=lerp(rollState[h.free].angle,-.12*smooth(progress),1-Math.exp(-dt*38));const w=smooth(progress),foot=h.start.clone().lerp(h.target,w);const floor=handoffFloor(h.free,foot.x,foot.z).y,startGap=Math.max(0,h.start.y-handoffFloor(h.free,h.start.x,h.start.z).y);foot.y=floor+startGap*(1-w)+.05*Math.sin(Math.PI*progress)**2;if(progress>=1)h.target.y=floor;
    const support=contacts[h.support],free=contacts[h.free];support.mode='plant';free.mode=progress>=1?'plant':'landing-handoff-swing';free.start.copy(h.start);free.target.copy(h.target);if(progress>=1)free.anchor.copy(h.target);
    return {[h.support]:support.anchor.clone(),[h.free]:foot};
   }
  }
  const starting=speed>.01&&!moving,stopping=speed<=.01&&moving,cadence=speed>.01?(currentGait==='walk'?.85+.40*clamp(speed/1.55):1.5+1.15*clamp(speed/4.8)):stopCadence,stance=currentGait==='walk'?.62:.4;
  if(starting){const left=plannerFoot('L'),right=plannerFoot('R');
   // Select actual support by clearance above each foot's terrain, not absolute
   // world Y. When clearances differ by at most1mm, use a deterministic left lead rather
   // than letting sub-ulp IK differences reverse the gait by half a cycle.
   const leftGap=left.y-floorTarget(left.x,left.z).point.y,rightGap=right.y-floorTarget(right.x,right.z).point.y;
   const phase=leftGap<=rightGap+.001?.2:.7;gaitPhase=Math.floor(gaitPhase)+phase;for(const [s,shift]of [['L',0],['R',.5]]){const actual=plannerFoot(s).addScaledVector(velocity,-dt);contacts[s].anchor.copy(actual);contacts[s].start.copy(actual);contacts[s].mode='plant';contacts[s].u=(phase+shift)%1;contacts[s].initial=true;contacts[s].heading=heading();contacts[s].landingAge=actual.y-floorTarget(actual.x,actual.z).point.y>.008?0:null;contacts[s].landingStartY=actual.y;}}
  if(stopping){for(const s of ['L','R'])if(contacts[s].mode==='swing'){const c=contacts[s],g=localGoal(s,.02);replaceTrajectory(s,c,floorTarget(g.x,g.z).point,Math.max(.07,(1-c.u)/(stopCadence||2)),'stop');}}
  if(speed>.01){gaitPhase+=dt*cadence;stopCadence=cadence;}
  else if(Object.values(contacts).some(c=>c.mode==='settle'))gaitPhase+=dt*(stopCadence||2);
  moving=speed>.01;
  // A stationary cut steps the free lead foot during loading. The rear foot
  // remains an actual support; repeat cuts do not stamp a foot already there.
  // A run-stop may leave the rear foot airborne. Keep the grounded lead foot
  // planted then; attack timing is unchanged and no delayed extra step is queued.
  const rear=plannerFoot('R'),rearFloor=floorTarget(rear.x,rear.z).point.y;
  const rearSupported=contacts.R.mode==='plant'&&Math.abs(rear.y-rearFloor)<.008;
  if(!moving&&!contacts.L.trajectory&&rearSupported&&action==='attack'&&(action!==lastAction||retrigger)){const c=contacts.L,g=localGoal('L',.16,-.20),target=floorTarget(g.x,g.z).point,start=plannerFoot('L');if(start.distanceTo(target)>.015){c.mode='stance-step';c.start.copy(start);c.target.copy(target);c.stopAge=0;c.stopDuration=.11;}}
  if(speed>.01||!grounded||action!==lastAction||retrigger)stanceQueue=[];
  const startStance=(side,foot)=>{const c=contacts[side];if(c.trajectory&&!c.trajectory.finished){const g=localGoal(side,foot[2],foot[0]);replaceTrajectory(side,c,floorTarget(g.x,g.z).point,c.trajectory.duration-c.trajectory.age,'action-interruption');return true;}const g=localGoal(side,foot[2],foot[0]),target=floorTarget(g.x,g.z).point,start=plannerFoot(side);if(c.mode==='plant'&&start.distanceTo(target)<.015)return false;c.mode='stance-step';c.start.copy(start);c.target.copy(target);c.stopAge=0;c.stopDuration=.17;c.heading=heading();return true;};
  if(!moving&&action&&(action!==lastAction||retrigger)){
   const feet=spellPoses[action]?.load.feet;
   const rearLocal=rear.clone().sub(root.position).applyQuaternion(root.quaternion.clone().invert());
   const rearTurn=Math.abs(Math.atan2(Math.sin(heading()-contacts.R.heading),Math.cos(heading()-contacts.R.heading)));
   // A target-facing turn may put the old right world anchor on the body's
   // left. Retain the original two-foot realignment then; a planted contact is
   // not by itself a valid rear-side support. Never preserve a crossed stance.
   const fireSupportAligned=rearLocal.x>.04&&rearTurn<=.35;
   if(feet&&action==='emberBolt'&&fireSupportAligned){
    // The short fire scoop uses a real rear support, not a two-step stance
    // change that lifts that support during its 340ms load. Move only the free
    // left foot when the existing right contact is planted. Do not reset the
    // right anchor to bind/rest, interrupt its prior settle, or schedule a late
    // lead step if fire interrupted running/turning with the rear foot airborne.
    if(rearSupported)stanceQueue=[{side:'L',foot:[...feet.L]}];
   }else if(feet){const gap=side=>{const p=plannerFoot(side);return p.y-floorTarget(p.x,p.z).point.y;},l=gap('L'),rr=gap('R'),first=l>.008&&rr<=.008?'L':rr>.008&&l<=.008?'R':'L',second=first==='L'?'R':'L';stanceQueue=[{side:first,foot:[...feet[first]]},{side:second,foot:[...feet[second]]}];}
  }
  // A spell may interrupt a quiet adjustment with one foot already airborne.
  // Finish that foot first, then move the other only on verified support. Cast
  // pose and projectile timings remain independent of this foot-only queue.
  if(!moving&&action&&stanceQueue.length){const next=stanceQueue[0],other=next.side==='L'?'R':'L',support=plannerFoot(other),supported=contacts[other].mode==='plant'&&Math.abs(support.y-floorTarget(support.x,support.z).point.y)<.008;if(supported){stanceQueue.shift();if(!startStance(next.side,next.foot)&&stanceQueue.length){const n=stanceQueue.shift();startStance(n.side,n.foot);}}}

  // After a quiet stop, let the free foot make one small supported adjustment.
  // Never lift the only supporting foot, queue a step into an action, or restart
  // the adjustment every breathing cycle. Turning retains its own contact plan.
  if(!moving&&!action&&restAge>.65&&ready<.08&&Object.values(contacts).every(c=>c.mode==='plant')&&Object.values(contacts).every(c=>Math.abs(Math.atan2(Math.sin(heading()-c.heading),Math.cos(heading()-c.heading)))<.15)){
   for(const [side,z,x]of [['L',.12,-.165],['R',-.025,.135]]){const other=side==='L'?'R':'L',support=plannerFoot(other);if(Math.abs(support.y-floorTarget(support.x,support.z).point.y)>.008)continue;const c=contacts[side],g=localGoal(side,z,x),target=floorTarget(g.x,g.z).point,start=plannerFoot(side);if(start.distanceTo(target)>.02){c.mode='stance-step';c.start.copy(start);c.target.copy(target);c.stopAge=0;c.stopDuration=.24;break;}}
  }
  // Replant one foot at a time when turning in place; feet cannot remain
  // forever fixed behind a 180-degree body turn.
  if(!moving&&!action&&Object.values(contacts).every(c=>c.mode==='plant')){
   const candidates=['L','R'].map(side=>({side,angle:Math.abs(Math.atan2(Math.sin(heading()-contacts[side].heading),Math.cos(heading()-contacts[side].heading)))})).sort((a,b)=>b.angle-a.angle);
   if(candidates[0].angle>.28){const side=candidates[0].side,c=contacts[side],g=localGoal(side);c.mode='stance-step';c.start.copy(plannerFoot(side));c.target.copy(floorTarget(g.x,g.z).point);c.stopAge=0;c.stopDuration=.16;c.heading=heading();}
  }
  const result={};
  for(const [s,shift]of [['L',0],['R',.5]]){
   const c=contacts[s],u=((gaitPhase+shift)%1+1)%1;
   // A replacement contact mode owns its own curve. No obsolete swing
   // may override a turn/stance step, dash, reset, or completed idle contact.
   if(c.trajectory&&c.mode!=='swing'){c.trajectory=null;c.justLanded=false;}
   if(c.justLanded){
    if(!moving||c.mode!=='plant')c.justLanded=false;
    else{result[s]=c.anchor.clone();c.u=u;c.initial=false;if(u<stance)c.justLanded=false;continue;}
   }
   if(c.trajectory&&!c.trajectory.finished){
    const tr=c.trajectory;
    // A second material direction/speed change may revise the committed plan;
    // after braking, small estimator drift cannot perpetually postpone contact.
    if(moving){const remain=Math.max(0,tr.duration-tr.age),g=localGoal(s,speed/cadence*(currentGait==='walk'?.31:.2));g.addScaledVector(velocity,remain);const estimate=floorTarget(g.x,g.z).point;if(estimate.distanceTo(tr.estimate)>.12&&tr.duration-tr.age>.045)replaceTrajectory(s,c,estimate,tr.duration-tr.age,'redirect');}
    result[s]=advanceTrajectory(s,c,dt);c.u=u;c.initial=false;continue;
   }
   if(moving){
    if(u<stance){
     if(c.mode==='swing'){c.anchor.copy(c.target);}else if(!c.initial&&u<c.u){const over=u/cadence,g=localGoal(s,speed/cadence*stance/2);g.addScaledVector(velocity,-over);c.anchor.copy(floorTarget(g.x,g.z).point);}
     c.mode='plant';c.heading=heading();result[s]=c.anchor.clone();if(c.landingAge!==null&&c.landingAge!==undefined){c.landingAge+=dt;const w=smooth(c.landingAge/.07),floor=floorTarget(c.anchor.x,c.anchor.z).point.y;result[s].y=lerp(c.landingStartY,floor,w);c.mode=w<1?'landing-step':'plant';if(w>=1){c.anchor.y=floor;c.landingAge=null;}}
    }else{
     if(c.mode!=='swing'){c.hasSwingTarget=false;c.start.copy(plannerFoot(s).addScaledVector(velocity,-dt));c.uStart=c.initial?c.u:stance;c.mode='swing';c.landingAge=null;}
     const estimate=stepGoal(s,c,u,cadence,velocity,speed);
     if(c.hasSwingTarget&&estimate.distanceTo(c.target)>1e-5){replaceTrajectory(s,c,estimate,(1-u)/cadence+dt,'endpoint-change');result[s]=advanceTrajectory(s,c,dt);}
     else{c.target.copy(estimate);c.hasSwingTarget=true;const progress=clamp((u-c.uStart)/(1-c.uStart)),w=smooth(progress);result[s]=c.start.clone().lerp(c.target,w);result[s].y+=(currentGait==='walk'?.08:.23)*Math.sin(Math.PI*progress)**1.35;}
    }
    c.u=u;c.initial=false;
   }else if(c.mode==='settle'||c.mode==='stance-step'||c.mode==='landing-step'){
    c.stopAge+=dt;const progress=clamp(c.stopAge/c.stopDuration);result[s]=c.start.clone().lerp(c.target,smooth(progress));result[s].y+=(c.mode==='stance-step'?.065:c.mode==='landing-step'?0:.12)*Math.sin(Math.PI*progress);if(progress>=1){c.mode='plant';c.anchor.copy(c.target);}
   }else result[s]=c.anchor.clone();
  }
  return result;
 }
 // An explicit, verified ejection changes only world-reference caches. No root,
 // local transform, event clock, gait phase, airborne age or equipment mutation.
 const usedRebases=new WeakSet();let pendingRebase=null,pendingQuaternion=null,rebaseCount=0,lastRebase=null,lastSupportDy=0;
 const finitePoint=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
 const samePoint=(a,b)=>a.x===b.x&&a.y===b.y&&a.z===b.z;
 function rebaseContacts(receipt){
  const data=readR19ContactRebase(receipt);
  if(!initialized)throw Error('Contact rebase requires an initialized foot controller');
  if(usedRebases.has(receipt)||pendingRebase)throw Error('Contact rebase already applied or awaiting its pose tick');
  if(!samePoint(lastRoot,data.from))throw Error('Contact rebase stale beforeMovement reference');
  if(!samePoint(root.position,data.to))throw Error('Contact rebase does not match the actual physics root');
  const {x:cx,z:cz}=data.correction;
  const supportDy=data.grounded?height(data.to.x,data.to.z)-height(data.from.x+data.motion.x,data.from.z+data.motion.z):0;
  if(!Number.isFinite(supportDy))throw Error('Contact rebase produced a nonfinite support correction');
  // Grounded targets keep their signed height over each point's support plane.
  // Airborne points keep world Y: horizontal collision must not replay gravity
  // or raise a captured airborne foot by the height of a different slope.
  const shifted=point=>{
   const next=point.clone();next.x+=cx;next.z+=cz;
   if(data.grounded)next.y+=floorTarget(next.x,next.z).point.y-floorTarget(point.x,point.z).point.y;
   if(!finitePoint(next))throw Error('Contact rebase produced a nonfinite reference');return next;
  };
  const shiftedVelocity=(point,velocity)=>{const e=1e-4;return shifted(point.clone().addScaledVector(velocity,e)).sub(shifted(point)).divideScalar(e);};
  const nextContacts={};
  for(const side of ['L','R']){const c=contacts[side];if(!c){nextContacts[side]=null;continue;}
   const next={...c,anchor:shifted(c.anchor),start:shifted(c.start),target:shifted(c.target)};
   if(c.trajectory){const tr=c.trajectory;next.trajectory={...tr,start:shifted(tr.start),end:shifted(tr.end),estimate:shifted(tr.estimate),velocity:shiftedVelocity(tr.start,tr.velocity)};}
   if(Number.isFinite(c.landingStartY)&&data.grounded){next.landingStartY+=next.start.y-c.start.y;if(!Number.isFinite(next.landingStartY))throw Error('Contact rebase produced a nonfinite landing reference');}
   nextContacts[side]=next;
  }
  const nextVelocity=Object.fromEntries(['L','R'].map(side=>[side,actualPlanner[side]?shiftedVelocity(actualPlanner[side],actualVelocity[side]):actualVelocity[side].clone()]));
  const nextActual=Object.fromEntries(['L','R'].map(side=>[side,actualPlanner[side]?shifted(actualPlanner[side]):null]));
  const nextFeet=Object.fromEntries(['L','R'].map(side=>[side,lastFootWorld[side]?shifted(lastFootWorld[side]):null]));
  const nextHandoff=landingHandoff&&!landingHandoff.armed?{...landingHandoff,start:shifted(landingHandoff.start),target:shifted(landingHandoff.target),velocity:shiftedVelocity(landingHandoff.start,landingHandoff.velocity)}:landingHandoff;
  const nextDash=dashFeet?Object.fromEntries(['L','R'].map(side=>[side,shifted(dashFeet[side])])):null;
  const nextRoot=lastRoot.clone();nextRoot.x+=cx;nextRoot.y+=supportDy;nextRoot.z+=cz;
  const nextAerial=aerialReleaseRoot?.clone();if(nextAerial){nextAerial.x+=cx;nextAerial.y+=supportDy;nextAerial.z+=cz;}
  const nextTakeoff=transition?.rootPosition?.clone();if(nextTakeoff){nextTakeoff.x+=cx;nextTakeoff.y+=supportDy;nextTakeoff.z+=cz;}
  const nextTransformRoot=transition?.transforms.get(root)?.p.clone();if(nextTransformRoot){nextTransformRoot.x+=cx;nextTransformRoot.y+=supportDy;nextTransformRoot.z+=cz;}
  if(![nextRoot,nextAerial,nextTakeoff,nextTransformRoot].filter(Boolean).every(finitePoint))throw Error('Contact rebase produced a nonfinite root reference');
  // All geometry sampling and validation completes before the first mutation.
  for(const side of ['L','R']){contacts[side]=nextContacts[side];actualPlanner[side]=nextActual[side];actualVelocity[side].copy(nextVelocity[side]);lastFootWorld[side]=nextFeet[side];}
  landingHandoff=nextHandoff;dashFeet=nextDash;if(nextAerial)aerialReleaseRoot.copy(nextAerial);lastRoot.copy(nextRoot);if(nextTakeoff)transition.rootPosition.copy(nextTakeoff);if(nextTransformRoot)transition.transforms.get(root).p.copy(nextTransformRoot);
  usedRebases.add(receipt);pendingRebase=receipt;pendingQuaternion=root.quaternion.clone();rebaseCount++;lastRebase=data;lastSupportDy=supportDy;
  return Object.freeze({applied:true,count:rebaseCount,correction:data.correction,supportDy,worldFootContinuity:false});
 }
 function contactState(){
  const vec=v=>v?.toArray()??null;
  return {airSoleProjection,dashAirFlight,dashAirRelease:dashAirRelease?{bones:[...dashAirRelease.keys()].map(o=>o.name)}:null,landingHandoff:landingHandoff?{...landingHandoff,start:vec(landingHandoff.start),target:vec(landingHandoff.target),velocity:vec(landingHandoff.velocity)}:null,lastSoleClearance:{...lastSoleClearance},dashAcquisition:dashAcquisition?{...dashAcquisition,start:Object.fromEntries(['L','R'].map(side=>[side,vec(dashAcquisition.start[side])]))}:null,aerialReleaseRoot:vec(aerialReleaseRoot),aerialReleasePelvis:vec(aerialReleasePelvis),actualPlanner:Object.fromEntries(['L','R'].map(s=>[s,vec(actualPlanner[s])])),actualVelocity:Object.fromEntries(['L','R'].map(s=>[s,vec(actualVelocity[s])])),initialized,time,gaitPhase,airAge,landAge,lastVy,landingStrength,ready,visualSpeed,restAge,previousGrounded,lastSpeed,moving,stopCadence,lastAction,lastActionAge,lastEventKind,lastDodgeTime,currentGait,utilityKind,utilityAge,airLead,airTravel,landingReachWeight,lastRoot:vec(lastRoot),lastFootWorld:Object.fromEntries(['L','R'].map(s=>[s,vec(lastFootWorld[s])])),dashFeet:dashFeet?Object.fromEntries(['L','R'].map(s=>[s,vec(dashFeet[s])])):null,contacts:Object.fromEntries(['L','R'].map(s=>[s,contacts[s]?{...contacts[s],anchor:vec(contacts[s].anchor),start:vec(contacts[s].start),target:vec(contacts[s].target),trajectory:contacts[s].trajectory?{...contacts[s].trajectory,start:vec(contacts[s].trajectory.start),end:vec(contacts[s].trajectory.end),velocity:vec(contacts[s].trajectory.velocity),estimate:vec(contacts[s].trajectory.estimate)}:null}:null])),transition:transition?{kind:transition.kind,age:transition.age,duration:transition.duration,rootPosition:vec(transition.rootPosition),transforms:[...transition.transforms].filter(([o])=>o!==root).map(([o,b])=>[o.name,vec(b.p),b.q.toArray()])}:null,launchRoll:launchRoll?Object.fromEntries(['L','R'].map(s=>[s,launchRoll[s]?.toArray()??null])):null,stanceQueue:stanceQueue.map(s=>({side:s.side,foot:[...s.foot]})),rollState:Object.fromEntries(['L','R'].map(s=>[s,{angle:rollState[s].angle,offset:vec(rollState[s].offset)}])),rebaseCount,pendingRebase:!!pendingRebase,lastRebase:lastRebase?{from:lastRebase.from,to:lastRebase.to,correction:lastRebase.correction,motion:lastRebase.motion,dt:lastRebase.dt,grounded:lastRebase.grounded,supportDy:lastSupportDy}:null};
 }
 function update(dt,options={}){
  let contactRebased=false;
  if(options.contactRebase||pendingRebase){
   if(!pendingRebase||options.contactRebase!==pendingRebase)throw Error('Apply the matching contact rebase before its pose tick');
   const data=readR19ContactRebase(pendingRebase);
   if(dt!==data.dt||options!==data.pose||!samePoint(root.position,data.to)||!root.quaternion.equals(pendingQuaternion))throw Error('Contact rebase pose tick differs from its physics receipt');
   contactRebased=true;pendingRebase=null;pendingQuaternion=null;
  }
  if(!Number.isFinite(dt)||dt<0||dt>.033+1e-12)throw Error('Expected one capped game tick');
  if(!dt&&initialized)return;
  currentGait=options.gait??'run';utilityKind=options.castKind??null;utilityAge=options.castAge??0;
  root.updateMatrixWorld(true);const grounded=options.grounded!==false,vy=Number.isFinite(options.verticalVelocity)?options.verticalVelocity:0,speed=Math.max(0,options.speed??(options.walking?4.8:0)),velocity=root.position.clone().sub(lastRoot).divideScalar(dt||1);
  if(!initialized){captureFeet();initialized=true;}else if(!contactRebased&&root.position.distanceTo(lastRoot)>Math.max(.8,speed*dt*3)){throw Error('Unreconciled root relocation requires an explicit reset or contact receipt');}
  const takingOff=options.jumpStarted||previousGrounded&&!grounded,landing=grounded&&!previousGrounded;
  if(takingOff){
   dashAirFlight=!!dashAcquisition;
   dashAirRelease=dashAcquisition?new Map([...saveTransforms()].filter(([o])=>releaseBones.has(o.name))):null;
   aerialReleaseRoot=(landingHandoff||dashAcquisition||Object.values(contacts).some(c=>c?.trajectory))?lastRoot.clone():null;
   aerialReleasePelvis=aerialReleaseRoot?nodes.pelvis.position.clone():null;
   const forward=new T.Vector3(0,0,1).applyQuaternion(root.quaternion);forward.y=0;forward.normalize();const travel=velocity.x*forward.x+velocity.z*forward.z;
   airTravel=clamp(travel/4.8);airLead='L';
   if(airTravel>.25&&lastFootWorld.L&&lastFootWorld.R&&lastFootWorld.R.clone().sub(lastFootWorld.L).dot(forward)>.025)airLead='R';
   launchRoll=Object.fromEntries(['L','R'].map(side=>[side,Math.abs(rollState[side].angle)>1e-6?nodes['ankle'+side].getWorldQuaternion(new T.Quaternion()):null]));airAge=0;landAge=Infinity;transition={kind:'takeoff',age:0,duration:.032,rootPosition:lastRoot.clone(),transforms:saveTransforms()};captureFeet();for(const side of ['L','R'])if(lastFootWorld[side]){const c=contacts[side];c.start.copy(lastFootWorld[side]);c.target.copy(c.start);c.anchor.copy(floorTarget(c.start.x,c.start.z).point);}moving=false;}
  if(!grounded)airAge+=dt;
  if(landing){landAge=0;landingStrength=clamp(Math.abs(lastVy)/6.2,.35,1);transition={kind:'landing',age:0,duration:.06,transforms:saveTransforms()};captureFeet();for(const s of ['L','R']){const c=contacts[s];if(c.start.y-c.anchor.y>.008){c.mode='landing-step';c.target.copy(c.anchor);c.stopAge=0;c.stopDuration=.09;}}}
  if(grounded&&Number.isFinite(landAge))landAge+=dt;
  time+=dt;visualSpeed=lerp(visualSpeed,speed,1-Math.exp(-dt*20));const action=options.attackTime>0?'attack':options.dodgeTime>0?'dodge':options.cast?.spellId??options.recovery?.spellId??options.castKind??null,age=options.attackTime>0?.44-options.attackTime:options.dodgeTime>0?.32-options.dodgeTime:options.cast?.age??options.recovery?.age??options.castAge??0;const eventKind=options.attackTime>0?'attack':options.dodgeTime>0?'dodge':options.cast?'cast':options.recovery?'recovery':options.castKind?'utility':null,retrigger=action===lastAction&&((eventKind!==lastEventKind&&!(lastEventKind==='cast'&&eventKind==='recovery'))||(eventKind===lastEventKind&&age+1e-5<lastActionAge)),actionEdge=action!==lastAction||retrigger;
  if(!takingOff&&!landing&&actionEdge&&initialized)transition={kind:'action',age:0,duration:.08,transforms:saveTransforms()};
  if(grounded&&speed>.01&&!moving&&!takingOff&&!landing&&!actionEdge)transition={kind:'locomotion-entry',age:0,duration:.07,transforms:saveTransforms()};
  ready=lerp(ready,action?1:0,1-Math.exp(-dt*(action?16:2.8)));restAge=grounded&&speed<=.01&&!action?restAge+dt:0;
  // Feet follow physics velocity and world contact, never a damped visual stride.
  const preplan={phase:'ready'},feet=planFeet(dt,{grounded,speed,velocity,p:preplan,action,age,retrigger,dodgeTime:options.dodgeTime??0});
  const altitude=Math.max(0,root.position.y-(options.groundHeight??height(root.position.x,root.position.z)));
  // Presentation-only terrain forecast, using observed accepted root motion.
  // It never changes physics, terrain, collision, input, or gameplay clocks.
  let landingReach=0;
  if(!grounded&&!takingOff&&(airAge>.082||dashAirFlight)){
   const acceleration=clamp((vy-lastVy)/(dt||1),-40,0),horizon=.14;
   let previousGap=altitude,previousTime=0;
   for(let i=1;i<=14;i++){
    const t=horizon*i/14,x=root.position.x+velocity.x*t,z=root.position.z+velocity.z*t;
    const gap=root.position.y+vy*t+.5*acceleration*t*t-height(x,z);
    if(previousGap>0&&gap<=0){const contactTime=lerp(previousTime,t,previousGap/(previousGap-gap));landingReach=smooth(1-contactTime/horizon);break;}
    previousGap=gap;previousTime=t;
   }
  }
  // A forecast can disappear when real input stops or reverses in midair.
  // Withdraw visual reach gradually instead of snapping back to the gather.
  const hasLandingForecast=landingReach>0;
  if(grounded||takingOff)landingReachLocalTargets=null;
  landingReachWeight=grounded||takingOff?0:Math.max(landingReach,landingReachWeight*Math.exp(-dt*10));
  landingReach=landingReachWeight;
  if(grounded)dashAirFlight=false;
  if(grounded||airAge>=.285)dashAirRelease=null;
  const p=sampleWholeBody({time,gaitPhase,speed:visualSpeed,airAge,landAge,grounded,verticalVelocity:vy,altitude,landingStrength,attackTime:options.attackTime??0,cast:options.cast,recovery:options.recovery,readyWeight:ready,airLead,airTravel,dodgeTime:options.dodgeTime??0,castKind:options.castKind,castAge:options.castAge,gait:currentGait,releasedDash:dashAirFlight});
  if(dashAirRelease)p.groundIK=0;
  for(const [o,b]of rest){if(o===root)continue;o.position.copy(b.p);o.quaternion.copy(b.q);}
  for(const [n,angles]of Object.entries(p.rot)){
   if(n.startsWith('upperArm')){nodes[n].quaternion.setFromAxisAngle(yAxis,angles[1]).multiply(qX.setFromAxisAngle(xAxis,angles[0])).multiply(qZ.setFromAxisAngle(zAxis,angles[2]));}
   else nodes[n].rotation.set(...angles,'XYZ');
  }
  // Pronation follows the actual elbow-to-wrist rest axis, not nominal Y.
  // It rotates the forearm surface without orbiting the wrist endpoint.
  if(p.forearmRollR)nodes.elbowR.quaternion.multiply(new T.Quaternion().setFromAxisAngle(rest.get(nodes.wristR).p.clone().normalize(),p.forearmRollR));
  nodes.pelvis.position.add(new T.Vector3(...p.offset));
  if(grounded){root.updateMatrixWorld(true);let lower=0;for(const side of ['L','R']){const hip=nodes['upperLeg'+side].getWorldPosition(new T.Vector3()),target=feet[side],a=rest.get(nodes['knee'+side]).p,b=rest.get(nodes['ankle'+side]).p,len=a.length()+b.length()-.002,horizontal=Math.hypot(hip.x-target.x,hip.z-target.z);lower=Math.max(lower,hip.y-target.y-Math.sqrt(Math.max(.03,len*len-horizontal*horizontal)));}nodes.pelvis.position.y-=Math.max(0,lower);}
  for(const side of ['L','R'])solveLeg(side,feet[side],p.groundIK);
  // C2: extend toward a terrain-relative airborne reach before contact. The
  // feet retain the physics root's altitude, so this is not an early plant.
  if(landingReach>0){
   const targets={};root.updateMatrixWorld(true);
   for(const side of ['L','R']){
    const g=localGoal(side,.02),target=floorTarget(g.x,g.z).point;target.y+=altitude;
    const local=root.worldToLocal(target.clone());
    landingReachLocalTargets??={L:null,R:null};
    if(!landingReachLocalTargets[side])landingReachLocalTargets[side]=local;
    else if(hasLandingForecast)landingReachLocalTargets[side].lerp(local,1-Math.exp(-dt*24));
    // A disappearing prediction withdraws its previous local reach. Re-aiming
    // it onto the new slope during a sharp midair turn causes a knee pop.
    targets[side]=landingReachLocalTargets[side].clone().applyMatrix4(root.matrixWorld);
   }
   let lower=0;for(const side of ['L','R']){const hip=nodes['upperLeg'+side].getWorldPosition(new T.Vector3()),target=targets[side],len=rest.get(nodes['knee'+side]).p.length()+rest.get(nodes['ankle'+side]).p.length()-.002,horizontal=Math.hypot(hip.x-target.x,hip.z-target.z);lower=Math.max(lower,hip.y-target.y-Math.sqrt(Math.max(.03,len*len-horizontal*horizontal)));}
   nodes.pelvis.position.y-=Math.max(0,lower)*landingReach;
   for(const side of ['L','R'])solveLeg(side,targets[side],landingReach);
  }
  // Prepare the sole plane before touchdown instead of rotating a planted
  // foot through the floor during the landing blend.
  if(!grounded&&((vy<0&&altitude<.42)||landingReach>0)){const weight=Math.max(landingReach,vy<0?smooth((.42-altitude)/.24):0);for(const side of ['L','R']){const ankle=nodes['ankle'+side],point=ankle.getWorldPosition(new T.Vector3()),ground=floorTarget(point.x,point.z),forward=new T.Vector3(0,0,1).applyQuaternion(root.quaternion);forward.y=ground.dx*forward.x+ground.dz*forward.z;forward.normalize();const right=new T.Vector3().crossVectors(ground.up,forward).normalize(),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,ground.up,forward));q.premultiply(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert());ankle.quaternion.slerp(q,weight);}}
  const contactRecovery=grounded&&(landAge<.12||transition);
  if(transition){transition.age+=dt;const w=smooth(transition.age/transition.duration);for(const [o,b]of transition.transforms){if(o===root||dashAirRelease&&releaseBones.has(o.name))continue;const start=b.p.clone();if(transition.kind==='takeoff'&&o===nodes.pelvis&&!aerialReleaseRoot){const displacement=root.position.clone().sub(transition.rootPosition).applyQuaternion(root.quaternion.clone().invert());start.sub(displacement);}o.position.lerp(start,1-w);o.quaternion.slerp(b.q,1-w);}if(w>=1)transition=null;}
  // A cancelled moving foot and its supporting body share one root-relative
  // release. Ground push-off's world-held pelvis would compress an already
  // moving leg against a carried ankle. Release the captured pelvis with the
  // same existing82ms foot-IK ownership, without changing physical launch or
  // adding another animation clock; both channels reach the authored air pose.
  if(!grounded&&!dashAirRelease&&aerialReleasePelvis&&airAge<.082)nodes.pelvis.position.lerp(aerialReleasePelvis,1-smooth(airAge/.082));
  if(!grounded&&airAge<.082){for(const side of ['L','R'])solveLeg(side,feet[side],p.groundIK);}
  if(contactRecovery){root.updateMatrixWorld(true);let lower=0;for(const side of ['L','R']){const hip=nodes['upperLeg'+side].getWorldPosition(new T.Vector3()),target=feet[side],a=rest.get(nodes['knee'+side]).p,b=rest.get(nodes['ankle'+side]).p,len=a.length()+b.length()-.002,horizontal=Math.hypot(hip.x-target.x,hip.z-target.z);lower=Math.max(lower,hip.y-target.y-Math.sqrt(Math.max(.03,len*len-horizontal*horizontal)));}nodes.pelvis.position.y-=Math.max(0,lower);for(const side of ['L','R'])lockLegPosition(side,feet[side]);}
  if(grounded){
   const frames={};let active=false;
   for(const [side,shift]of [['L',0],['R',.5]]){const state=rollState[side],u=((gaitPhase+shift)%1+1)%1,target=contacts[side].justLanded?0:contacts[side].trajectory?lerp(contacts[side].trajectory.rollStart,0,smooth(contacts[side].trajectory.age/contacts[side].trajectory.duration)):speed>.01&&!action?(landingHandoff&&!landingHandoff.armed&&side===landingHandoff.free?-.12*smooth(landingHandoff.age/landingHandoff.duration):phaseRoll(u))*smooth(clamp(speed/3.8)):0;
    // A short response filter avoids discontinuities at stop/action/start while
    // preserving the same game input clocks and world-root movement.
    state.angle=(contacts[side].trajectory||contacts[side].justLanded)?target:lerp(state.angle,target,1-Math.exp(-dt*38));if(Math.abs(state.angle)<1e-7)state.angle=0;
    const q=floorOrientation(feet[side]),pivot=state.angle<0?pivots[side].heel:pivots[side].front;
    frames[side]=rollSoleFrame(T,feet[side],q,pivot,state.angle);active ||= state.angle!==0;
   }
   if(active||dashAcquisition){
    // Recheck reach for the offset endpoint; no scale or root correction.
    root.updateMatrixWorld(true);let lower=0;for(const side of ['L','R']){const hip=nodes['upperLeg'+side].getWorldPosition(new T.Vector3()),target=frames[side].ankle,len=rest.get(nodes['knee'+side]).p.length()+rest.get(nodes['ankle'+side]).p.length()-.002,horizontal=Math.hypot(hip.x-target.x,hip.z-target.z);lower=Math.max(lower,hip.y-target.y-Math.sqrt(Math.max(.03,len*len-horizontal*horizontal)));}nodes.pelvis.position.y-=Math.max(0,lower);
    for(const side of ['L','R']){const frame=frames[side],ankle=nodes['ankle'+side];lockLegPosition(side,frame.ankle);ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame.quaternion));rollState[side].offset.copy(frame.offset).applyQuaternion(root.quaternion.clone().invert());}
   }else for(const side of ['L','R'])rollState[side].offset.set(0,0,0);
   launchRoll=null;
  }else{
   // The takeoff transition owns real captured feet, not flattened references.
   // Release a previously rolled ankle into its airborne orientation smoothly.
   if(!dashAirRelease&&launchRoll&&airAge<.082){const w=smooth(airAge/.082);for(const side of ['L','R'])if(launchRoll[side]){const ankle=nodes['ankle'+side],q=ankle.getWorldQuaternion(new T.Quaternion());q.slerp(launchRoll[side],1-w);ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));}}
   for(const side of ['L','R']){rollState[side].angle=0;rollState[side].offset.set(0,0,0);}if(airAge>=.082)launchRoll=null;
  }
  root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  if(dashAirRelease){const w=1-smooth(airAge/.285);for(const [o,b]of dashAirRelease){o.position.lerp(b.p,w);o.quaternion.slerp(b.q,w);}root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
  // A released dash sole is free in air, not a temporary support created by
  // penetration correction. Require the same terrain clearance as the physics
  // root, and solve only the deficient foot upward with unchanged bone lengths.
  // This bound is geometric (root altitude), not a contact-report threshold.
  airSoleProjection=null;
  if(dashAirFlight&&!grounded){
   airSoleProjection={rootAltitude:altitude,feet:{}};
   for(const side of ['L','R']){
    const ankle=nodes['ankle'+side],q=ankle.getWorldQuaternion(new T.Quaternion()),target=ankle.getWorldPosition(new T.Vector3());let minimum=Infinity;
    for(const sample of soleLocalSamples[side]){const v=sample.clone().applyQuaternion(q).add(target);minimum=Math.min(minimum,v.y-height(v.x,v.z));}
    airSoleProjection.feet[side]={minimumBefore:minimum,lift:Math.max(0,altitude-minimum),ankleBefore:target.toArray()};
    if(minimum<altitude){target.y+=altitude-minimum;lockLegPosition(side,target);}
    airSoleProjection.feet[side].ankleAfter=ankle.getWorldPosition(new T.Vector3()).toArray();
   }
   root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  }
  // Explicit sole samples also protect the last airborne frame and transition,
  // so landing contact does not suddenly introduce an underground correction.
  lastSoleClearance={L:Infinity,R:Infinity};soleCorrection=0;const vertex=new T.Vector3();for(const mesh of soleMeshes){const ids=mesh.userData.contactVertexIndices??Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i);for(const i of ids){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);const gap=vertex.y-height(vertex.x,vertex.z);lastSoleClearance[mesh.userData.side]=Math.min(lastSoleClearance[mesh.userData.side],gap);soleCorrection=Math.max(soleCorrection,-gap);}}
  if(soleCorrection>0){nodes.pelvis.position.y+=soleCorrection;root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
  for(const side of ['L','R'])lastSoleClearance[side]+=soleCorrection;
  // Hip panels are separate secondary controls, not frozen pelvis decoration.
  // Follow final solved thigh orientation without shrinking the primary action.
  for(const side of ['L','R']){
   const leg=nodes['upperLeg'+side],panel=nodes['hipPanel'+side],arm=nodes['upperArm'+side],plate=nodes['pauldron'+side];
   panel.quaternion.identity().slerp(leg.quaternion,.92).multiply(qZ.setFromAxisAngle(zAxis,side==='L'?-.012:.012));
   panel.position.copy(rest.get(panel).p).sub(rest.get(leg).p).applyQuaternion(leg.quaternion).add(rest.get(leg).p);
   // Rigid pauldron follows only a fraction of upper-arm swing, in the shared
   // clavicle coordinate system. No elbow follow, cloth scaling or bind edit.
   plate.quaternion.identity().slerp(arm.quaternion,.35);plate.position.copy(rest.get(plate).p).sub(rest.get(arm).p).applyQuaternion(plate.quaternion).add(rest.get(arm).p);
  }
  root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  for(const side of ['L','R']){lastFootWorld[side]=nodes['ankle'+side].getWorldPosition(new T.Vector3());const current=plannerFoot(side);actualVelocity[side].copy(actualPlanner[side]&&dt>0?current.clone().sub(actualPlanner[side]).divideScalar(dt):new T.Vector3());actualPlanner[side]=current;}
  lastPose=p;previousGrounded=grounded;lastVy=vy;lastRoot.copy(root.position);lastSpeed=speed;lastAction=action;lastActionAge=age;lastEventKind=eventKind;lastDodgeTime=options.dodgeTime??0;
 }
 function discardPendingContactRebase(){pendingRebase=null;pendingQuaternion=null;}
 function reset(){airSoleProjection=null;dashAirFlight=false;dashAirRelease=null;landingHandoff=null;dashAcquisition=null;lastSoleClearance={L:Infinity,R:Infinity};aerialReleaseRoot=null;aerialReleasePelvis=null;for(const s of ['L','R']){actualPlanner[s]=null;actualVelocity[s].set(0,0,0);}discardPendingContactRebase();dashFeet=null;lastDodgeTime=0;currentGait='run';utilityKind=null;utilityAge=0;airLead='L';airTravel=0;landingReachWeight=0;landingReachLocalTargets=null;clearRoll();for(const [o,b]of rest){if(o===root)continue;o.position.copy(b.p);o.quaternion.copy(b.q);}time=airAge=ready=lastVy=visualSpeed=restAge=0;gaitPhase=.2;landAge=Infinity;previousGrounded=true;initialized=false;transition=null;stanceQueue=[];contacts.L=contacts.R=null;lastFootWorld.L=lastFootWorld.R=null;moving=false;lastAction=null;lastActionAge=0;lastEventKind=null;lastSpeed=0;stopCadence=0;lastRoot.copy(root.position);update(0);}
 return {nodes,update,reset,rebaseContacts,contactState,hasPendingContactRebase:()=>!!pendingRebase,discardPendingContactRebase,diagnostics:()=>({revision:MOTION_REVISION,lastDodgeTime,currentGait,utilityKind,utilityAge,airLead,airTravel,landingReachWeight,time,gaitPhase,airAge,landAge:Number.isFinite(landAge)?landAge:null,phase:lastPose?.phase,locomotionPhase:lastPose?.locomotionPhase??lastPose?.phase,visualSpeed,groundIK:lastPose?.groundIK,pelvisOffset:lastPose?.offset,ready,soleCorrection,restAge,stanceQueue:stanceQueue.map(v=>({side:v.side,foot:[...v.foot]})),forearmRollR:lastPose?.forearmRollR??0,footRoll:Object.fromEntries(['L','R'].map(s=>[s,{angle:rollState[s].angle,offset:rollState[s].offset.toArray(),pivots:{heel:pivots[s].heel.toArray(),front:pivots[s].front.toArray()}}])),contacts:Object.fromEntries(Object.entries(contacts).map(([s,c])=>[s,c?{mode:c.mode,anchor:c.anchor.toArray()}:null]))})};
}
