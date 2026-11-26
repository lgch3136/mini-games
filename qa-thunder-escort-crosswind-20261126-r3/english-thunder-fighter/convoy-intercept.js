"use strict";const ConvoyTrial=(()=>{const r=Object.freeze({bossHp:45,bossRadius:46,hull:3,shipRadius:24,missileRadius:9,missileHp:1,missileSpeed:150,firstShot:1.2,interval:2.4,warning:.6,deadline:32,tailLimit:40});let u=!1,C=null,i=null,a=null,f=r.firstShot,Y=0,B=null,I=[],b=!1,y=!1,x=0,P=0,v=0,$=0;let guardUntil=0,guardUsed=0;const GUARD_SECONDS=1.2;
let moving=false;
// The alternate is wholly within the airport center strip. Keep the original
// centers, timing, radii and controls in the fixed lane.
function cargoX(t){
  // Leave left-side C/V buttons and the label at least a short gap on
  // portrait widths. Very narrow layouts still use the original safety pause.
  const center=Math.max(W*.5,Math.min(W-80,184));
  const amp=Math.min(102,W*.105,Math.max(0,center-176),Math.max(0,W-82-center));
  return center+amp*Math.cos((t-3.0)*Math.PI*2/8.4);
}
const cruiserX=t=>W*.5-Math.min(92,W*.105)*Math.cos((t-r.firstShot)*Math.PI/r.interval);
function advanceCrosswind(dt) {
  if(!moving)return null;
  const cargo={x:i.x,y:i.y,dx:cargoX(Game.time)-i.x,dy:0};
  const cruiser={x:a.x,y:a.y,dx:a.dead?0:cruiserX(Game.time)-a.x,dy:0};
  i.x+=cargo.dx;a.x+=cruiser.dx;
  return {cargo,cruiser};
}
// Lock, projectile and missed-shot parity all use the scheduled salvo, not
// the count actually fired (C may cancel a scheduled launch).
function launchPort(t){return Math.round((t-r.firstShot)/r.interval)%2===0?-1:1;}
function launchLine(t){
  const x=moving?cruiserX(t)+launchPort(t)*43:a.x-54,y=a.y+18;
  if(!moving)return {x,y,targetX:i.x,targetY:i.y};
  // A single straight flight with initial lead. Its intersection was
  // telegraphed at the same scheduled origin; no last-second steering.
  let l=0,h=(Math.hypot(W,i.y-y)+1)/r.missileSpeed;
  for(let n=0;n<16;n++){const m=(l+h)/2;if(Math.hypot(cargoX(t+m)-x,i.y-y)>m*r.missileSpeed)l=m;else h=m;}
  return {x,y,targetX:cargoX(t+(l+h)/2),targetY:i.y};
}
function drawConvoyWarning(t){
  const p=launchLine(t);
  if(!moving){ctx.moveTo(p.x,p.y);ctx.lineTo(p.targetX,p.targetY);return;}
  // Only draw below the cruiser, and stop short of the transport silhouette.
  // A dark under-stroke keeps a thin amber lock visible over the pale apron.
  const dy=p.targetY-p.y;
  if(dy<88)return;
  const q=(y)=>p.x+(p.targetX-p.x)*(y-p.y)/dy;
  const top=Math.max(p.y+32,hudClearanceY()+12), end=p.targetY-42;
  if(top>end-14)return;
  ctx.setLineDash([]);ctx.lineCap="round";
  ctx.moveTo(q(top),top);ctx.lineTo(q(end),end);
  ctx.lineWidth=6;ctx.strokeStyle="#11182b";ctx.stroke();
  ctx.setLineDash([8,7]);ctx.lineWidth=2;ctx.strokeStyle="#ffbd69";ctx.stroke();
  ctx.setLineDash([]);
  const gap=end-top, lockY=top+Math.min(16,gap*.35);
  ctx.beginPath();ctx.moveTo(q(lockY)-6,lockY-3);ctx.lineTo(q(lockY),lockY+3);ctx.lineTo(q(lockY)+6,lockY-3);
  ctx.lineWidth=5;ctx.strokeStyle="#11182b";ctx.stroke();
  ctx.lineWidth=2;ctx.strokeStyle="#ffe7a5";ctx.stroke();
  ctx.beginPath();
}
// Cue only: use the same forecast as lock-on, then only the live missile's own motion.
function drawThirdIntercept(){
 if(!moving||!y||x!==2||a.dead||C||Game.state!=="playing")return;
 // Leave a short quiet gap when a tracked threat disappears, even with another on screen.
 for(let k=I.length-1;k>=0&&Game.time-I[k].time<.24;k--){
  if(["shot-intercept","body-intercept","cargo-impact","guard-intercept","bomb-clear"].includes(I[k].type))return;
 }
 const pilot=Game.player;
 const atY=Math.min(pilot.y-84,i.y-59);
 if(atY<Math.max(hudClearanceY()+25,a.y+a.r+24))return;
 const live=T();
 let p=live[0];
 if(!p){
  if(f>=r.deadline||f<=Game.time||f-Game.time>r.warning+1e-9)return;
  const {x,y,targetX,targetY}=launchLine(f);
  p={x,y,vx:targetX-x,vy:targetY-y};
 }
 if(![p.x,p.y,p.vx,p.vy].every(Number.isFinite)||p.vy<=0||atY-p.y<20)return;
 const atX=p.x+(atY-p.y)*p.vx/p.vy;
 if(atX<74||atX>W-74)return;
 // Offset the words from the path; the open chevron points to it but does not cover it.
 const side=atX<W*.5?1:-1;
 ctx.save();
 ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();
 ctx.moveTo(atX-9,atY+10);ctx.lineTo(atX,atY+4);ctx.lineTo(atX+9,atY+10);
 ctx.lineWidth=5;ctx.strokeStyle="#152336";ctx.stroke();
 ctx.lineWidth=2;ctx.strokeStyle="#c2f8e5";ctx.stroke();
 ctx.font="bold 12px sans-serif";ctx.textAlign=side>0?"left":"right";
 ctx.lineWidth=3;ctx.strokeStyle="#152336";ctx.fillStyle="#e1fff4";
 const msg=window.matchMedia?.("(pointer: coarse)").matches?"补一枚 · 按住射击":"补一枚 · 按住 J";
 ctx.strokeText(msg,atX+side*14,atY+11);ctx.fillText(msg,atX+side*14,atY+11);
 ctx.restore();
}
function movingGuardThreat(missiles,ship){
 let early=false;
 for(const m of missiles){
  if(![m.x,m.y,m.vx,m.vy,m.r].every(Number.isFinite))continue;
  // Short piecewise-linear projection with the same collision radius as play;
  // checking the projected moving deck rather than stationary current X.
  const step=.15;
  for(let j=0;j<32;j++){
   const t=j*step, x0=cargoX(Game.time+t),x1=cargoX(Game.time+t+step);
   const p=z({x:m.x+m.vx*t,y:m.y+m.vy*t,dx:m.vx*step,dy:m.vy*step},
       {x:x0,y:ship.y,dx:x1-x0,dy:0},m.r+ship.r);
   if(p!==null){if(t+p*step<GUARD_SECONDS-1e-9)return "soon";early=true;break;}
  }
 }
 return early?"early":"unknown";
}

let latestCounter=null, counterResult=null;
function counterReadout(launched, phase, text){
 if(launched!==latestCounter)return;
 latestCounter=null;counterResult={phase,text,until:Game.time+2.4};
}
function currentCounterText(){
 if(latestCounter)return "C 已发射 · 等待命中";
 return counterResult&&counterResult.until>Game.time?counterResult.text:"";
}const h=(e,n={})=>I.push({type:e,time:Game.time,...n}),T=()=>Game.enemyBullets.filter(e=>e.convoyMissile);function N(){return JSON.parse(JSON.stringify({active:u,result:C,elapsed:Game.time,nextLaunch:f,ship:i,boss:a,missiles:T(),events:I,rules:r,layout:u?D():null,...moving&&u?{lane:"crosswind"}:{},...b?{counterfire:b,charge:x,counterShots:P,manualCounter:y,guardUntil,guardUsed}:{}}))}function q(){i.x=moving?cargoX(Game.time):W*.25,i.y=H-170,a.x=moving?cruiserX(Game.time):W*.72,a.y=Math.max(150,hudClearanceY()+12)}function Q(selection){if(Game.state!=="menu"&&!(u&&Game.state==="over"))return!1;moving=selection==="crosswind"||(!selection&&u&&moving);clearRewardReceipts(),invalidateBossPractice(),clearAnswerFlow(),releaseTouchControls(),BossPractice.mode="convoy",BossPractice.attemptId++,b=$id("convoy-counterfire").checked===!0,x=0,P=0,v=0,$=0,y=b&&$id("convoy-manual-counter").checked===!0,u=!0,C=null,I=[],latestCounter=null,counterResult=null,guardUntil=0,guardUsed=0,Y=0,f=r.firstShot,Game.bombPlan=bombPlanChoice,Game.state="playing",Game.phase="boss",Game.time=0,Game.level=1,Game.hp=100,Game.shield=0,Game.bombs=1,Game.score=Game.combo=Game.maxCombo=Game._lastCombo=Game.graze=Game.medalChain=0,Game.dashCooldown=Game.dashCount=Game.reactor=Game.sectors=0,Game.refitPending=Game.bossPending=!1,Game.nextWaveTimer=null,Game.question=null,Game.questionIndex=Game.questionStarted=0,Game.spawnTimer=Game.eventTimer=Game.passageTime=0,Game.passageSupply=!1,Game.lastEncounter=Game.encounterKind=null,Game.encounterSlot=0,Game.shake=0,Game.review=[],Game.stats={questions:0,correct:0,wrongAnswers:0,vocab:0,grammar:0};for(const n of["bullets","enemyBullets","enemies","powerups","particles","shockwaves","floaters","carrierQueue"])Game[n].length=0;GroundScene.time=0,GroundScene.exitAge=0,ThunderCoastScene.reset();const e=Game.player;Object.assign(e,{x:W/2,y:H-90,px:W/2,py:H-90,r:15,fireTimer:0,fireInterval:.15,weapon:"spread",weaponLevel:1,double:0,invuln:1.5,pointer:!1,spawnRing:3,muzzle:0,berserk:0,kvx:0,kvy:0}),i={x:0,y:0,r:r.shipRadius,hull:r.hull,maxHull:r.hull,hitFlash:0},a={x:0,y:0,r:r.bossRadius,hp:r.bossHp,maxHp:r.bossHp,boss:!0,convoyBoss:!0,t:0,phase:0,entering:!1,leaving:!1,dead:!1,hitFlash:0},q(),Game.enemies.push(a),document.activeElement?.blur?.();for(const n of["menu","over","convoy-over","paused","refit","answer-layout-paused"])$id(n).classList.add("hidden");return wrap.classList.add("convoy-trial"),$id("guard-btn").classList.toggle("hidden",!y),$id("counter-btn").classList.toggle("hidden",!y),els.hud.classList.remove("hidden"),els.qKind.textContent=moving?"横风航线":"\u56FA\u5B9A\u77ED\u5173",els.qPrompt.textContent="\u4FDD\u4F4F\u8FD0\u8F93\u673A\uFF0C\u51FB\u8D25\u5BFC\u5F39\u8247",els.qFeedback.textContent="",els.qHint.textContent=moving?"跟护横移运输机；本关不计纪录":"\u8FD0\u8F93\u673A\u56FA\u5B9A\u5F85\u63F4\uFF1B\u672C\u5173\u4E0D\u8BA1\u7EAA\u5F55",Game._nextLayoutCheck=0,Game.answerLayoutDirty=!0,syncBossLife(),q(),syncAnswerLayout(),Game._minY=Math.min(H-80,hudClearanceY()),e.y=e.py=Math.max(Math.min(e.y,H-46),Math.min(Game._minY,H-46)),B={x:e.x,y:e.y},updateHud(),syncBossLife(),q(),F(),window.ChipMusic&&(ChipMusic.setMuted(SFX.muted),ChipMusic.play("thunder-stage")),accumulator=0,ensureLoop(),h("start",{plan:Game.bombPlan,...moving?{lane:"crosswind"}:{}}),!0}function U(){u&&(u=!1,moving=!1,C=null,B=null,latestCounter=null,counterResult=null,guardUntil=0,guardUsed=0,b=!1,x=0,P=0,y=!1,v=0,$=0,$id("guard-btn").classList.add("hidden"),$id("counter-btn").classList.add("hidden"),wrap.classList.remove("convoy-trial"),$id("convoy-over").classList.add("hidden"),$id("convoy-readout").textContent="",$id("answer-layout-title").textContent="\u23F8 \u6570\u636E\u901A\u9053\u5DF2\u6682\u505C")}function L(e){if(!u||Game.state!=="playing"||C)return!1;C={reason:e,success:e==="success",time:Game.time,hull:i.hull,bossHp:Math.max(0,a.hp),missiles:T().length,playerHp:Game.hp},h("terminal",C),BossPractice.attemptId++,Game.state="over",Game.nextWaveTimer=null,Game.bossPending=Game.refitPending=!1,clearAnswerFlow(),releaseTouchControls(),accumulator=0,window.ChipMusic&&ChipMusic.stop(),SFX.ac?.suspend().catch(()=>{});for(const c of["hud","over","paused","refit","answer-layout-paused","boss-practice-offer"])$id(c).classList.add("hidden");$id("convoy-over").classList.remove("hidden");const n={success:"\u8FD0\u8F93\u673A\u83B7\u6551 \xB7 \u5BFC\u5F39\u8247\u51FB\u7834",cargo:"\u8FD0\u8F93\u673A\u635F\u6BC1",dead:"\u6218\u673A\u635F\u6BC1",withdrawn:"\u5BFC\u5F39\u8247\u64A4\u79BB \xB7 \u672A\u51FB\u7834",timeout:"\u4F59\u5F39\u5904\u7406\u8D85\u65F6 \xB7 \u672C\u6B21\u672A\u5B8C\u6210"};return $id("convoy-result-title").textContent=C.success?"\u77ED\u5173\u5B8C\u6210":"\u77ED\u5173\u7ED3\u675F",$id("convoy-result-summary").textContent=n[e],$id("convoy-result-stats").textContent=`\u8FD0\u8F93\u673A ${i.hull}/3 \xB7 \u5BFC\u5F39\u8247 ${Math.max(0,a.hp)}/45 \xB7 \u5728\u9014\u5BFC\u5F39 ${T().length} \xB7 ${Game.time.toFixed(1)} \u79D2${y?" \xB7 \u53CD\u51FB "+P+" \u6B21 / \u6253\u65AD "+I.filter(c=>c.type==="launch-interrupted").length+" \u6B21":""}`,$id("convoy-result-stats").textContent+=y?" · 护航挡弹 "+guardUsed+" 次":"",$id("convoy-over").scrollTop=0,syncBossLife(),!0}function V(e){return!u||!e.convoyBoss||e.dead?!1:(e.dead=!0,e.hp=Math.min(0,e.hp),removeEnemy(e),h("boss-death",{missiles:T().length}),explode(e.x,e.y,"#ff9f43",50,1.8),SFX.boom(),!0)}function j(e){x=0,P++,v=.35;const n=Math.atan2(a.y-e.y,a.x-e.x);
const shot={x:e.x,y:e.y-30,vx:Math.cos(n)*560,vy:Math.sin(n)*560,r:5,damage:6,homing:!0,color:"#6dffd4",kind:"homing",convoyCounter:!0};
Game.bullets.push(shot);
if(y){counterResult=null;latestCounter={shot,scheduled:f};}
h("counter-launch",{shots:P,source:y?"player":"transport"})}function Z(){return!u||!y||Game.state!=="playing"||x<3||a.dead?!1:(j(Game.player),F(),!0)}function releaseGuard(){
 if(!u||!y||Game.state!=="playing"||C||x<2||guardUntil>Game.time||!T().length)return false;
 x-=2;guardUntil=Game.time+GUARD_SECONDS;h("guard-start",{cost:2,until:guardUntil,charge:x});F();return true;
}function ee(){B={x:Game.player.x,y:Game.player.y}}function te(){u&&h(Game.bombPlan==="escort"?"escort-shield":"bomb-clear",{missileIds:Game.bombPlan==="escort"?[]:T().map(e=>e.id)})}function z(e,n,c,o=0){const p=e.x+e.dx*o,w=e.y+e.dy*o,G=n.x+n.dx*o,M=n.y+n.dy*o,S=p-G,R=w-M,g=(e.dx-n.dx)*(1-o),k=(e.dy-n.dy)*(1-o),t=S*S+R*R-c*c;if(t<0)return o;const s=g*g+k*k,l=2*(S*g+R*k),m=l*l-4*s*t;if(s===0||m<0)return null;const d=(-l-Math.sqrt(m))/(2*s);return d>=0&&d<=1?o+d*(1-o):null}const E=e=>({x:e.x,y:e.y,dx:0,dy:0});function ae(e){if(!u||Game.state!=="playing")return;v=Math.max(0,v-e),$=Math.max(0,$-e);const n=f;let c=null;const swept=advanceCrosswind(e);a.t+=e,a.hitFlash=Math.max(0,a.hitFlash-e),i.hitFlash=Math.max(0,i.hitFlash-e);const o=Game.player,p=B||o,w={x:p.x,y:p.y,dx:o.x-p.x,dy:o.y-p.y},G=[],M=[],S=[];let R=0;const g=(t,s,l,m)=>{t!==null&&S.push({time:t,priority:s,type:l,order:R++,...m})};for(const t of Game.bullets){if(t.homing&&Game.enemies.length){let l=Game.enemies[0],m=1/0;for(const O of Game.enemies){const K=Math.hypot(O.x-t.x,O.y-t.y);K<m&&(m=K,l=O)}const d=Math.atan2(l.y-t.y,l.x-t.x);t.vx+=Math.cos(d)*900*e,t.vy+=Math.sin(d)*900*e;const A=Math.hypot(t.vx,t.vy)||1;t.vx*=560/A,t.vy*=560/A}const s={item:t,x:t.x,y:t.y,dx:(t.vx||0)*e,dy:t.vy*e,used:!1,removed:!1};G.push(s),a.dead||g(z(s,swept?.cruiser||E(a),a.r+t.r+4),2,"boss",{f:s})}for(const t of Game.enemyBullets)M.push({item:t,x:t.x,y:t.y,dx:t.vx*e,dy:t.vy*e,from:0,present:!0,removed:!1});const k=Game.time-e;if(!a.dead&&f<=Game.time+1e-9&&f<r.deadline){const t=clamp((f-k)/e,0,1),lead=launchLine(f),s=lead.x,l=lead.y,m=Math.atan2(lead.targetY-l,lead.targetX-s),d={id:++Y,convoyMissile:!0,kind:"convoy-missile",x:s,y:l,vx:Math.cos(m)*r.missileSpeed,vy:Math.sin(m)*r.missileSpeed,r:r.missileRadius,hp:r.missileHp,maxHp:r.missileHp,color:"#ffbd69"},A={item:d,x:s-d.vx*e*t,y:l-d.vy*e*t,dx:d.vx*e,dy:d.vy*e,from:t,present:!1,removed:!1};M.push(A),g(t,-1,"launch",{h:A,scheduled:f}),f+=r.interval}for(const t of M)if(g(z(t,w,t.item.r+o.r,t.from),0,"player",{h:t}),t.item.convoyMissile){g(z(t,swept?.cargo||E(i),t.item.r+i.r,t.from),0,"cargo",{h:t});for(const s of G)g(z(s,t,s.item.r+t.item.r+4,t.from),1,"intercept",{f:s,h:t})}S.sort((t,s)=>t.time-s.time||t.priority-s.priority||t.order-s.order);for(const t of S){if(Game.state!=="playing")break;const{f:s,h:l}=t;if(t.type==="launch"){!a.dead&&t.scheduled!==c&&(l.present=!0,Game.enemyBullets.push(l.item),h("missile-launch",{id:l.item.id,scheduled:t.scheduled,x:l.item.x,y:l.item.y,vx:l.item.vx,vy:l.item.vy}));continue}if(!(l&&(!l.present||l.removed))&&!(s&&(s.used||s.removed))&&!(t.type==="boss"&&a.dead))if(t.type==="player"||t.type==="cargo"){if(l.removed=!0,t.type==="player"){const m=Game.hp,d=Game.shield;damagePlayer(8),h("body-intercept",{id:l.item.id,hpBefore:m,hpAfter:Game.hp,shieldBefore:d,shieldAfter:Game.shield})}else if(guardUntil>0&&k+e*t.time<guardUntil-1e-9){guardUntil=0;guardUsed++;i.hitFlash=.25;h("guard-intercept",{id:l.item.id,impactTime:k+e*t.time,hull:i.hull});}else i.hull=Math.max(0,i.hull-1),i.hitFlash=.25,h("cargo-impact",{id:l.item.id,hull:i.hull});explode(l.x+l.dx*t.time,l.y+l.dy*t.time,"#ff7b54",8,.6)}else{const m=t.type==="boss"?a:l.item;if(m.hp-=s.item.damage||1,m.hitFlash=.08,hitSparks(s.x+s.dx*t.time,s.y+s.dy*t.time,s.item.color||"#9ff3ff"),s.used=!0,s.item.pierce>0?s.item.pierce--:s.removed=!0,t.type==="intercept"){if(latestCounter?.shot===s.item)counterReadout(latestCounter,"intercept","C 击中在途导弹 · 未命中导弹艇");m.hp<=0&&(l.removed=!0,b&&!s.item.convoyCounter&&!a.dead&&(x=Math.min(3,x+1),x>=3&&!y&&j(i))),h("shot-intercept",{id:m.id,damage:s.item.damage||1,weapon:s.item.kind||"spread"});}else{const d=k+e*t.time,interrupted=y&&s.item.convoyCounter&&n-d>1e-9&&n-d<=r.warning+1e-9&&n<r.deadline&&c!==n&&a.hp>0;interrupted&&(c=n,f===n&&(f+=r.interval),$=1.1,h("launch-interrupted",{scheduled:n,impactTime:d,nextLaunch:f})),h("boss-damage",{damage:s.item.damage||1,hp:Math.max(0,a.hp)});
if(latestCounter?.shot===s.item){
 const launch=latestCounter.scheduled;
 if(m.hp<=0)counterReadout(latestCounter,"destroyed","C 击破导弹艇");
 else if(interrupted)counterReadout(latestCounter,"interrupt","C 打断发射 · 跳过一枚新导弹");
 else if(launch>=r.deadline)counterReadout(latestCounter,"impact","C 只伤艇 · 已无后续发射");
 else if(d<launch-r.warning-1e-9)counterReadout(latestCounter,"early","C 只伤艇 · 到达早于锁定");
 else if(d>=launch-1e-9)counterReadout(latestCounter,"late","C 只伤艇 · 错过原定发射");
 else counterReadout(latestCounter,"impact","C 命中导弹艇 · 未打断发射");
}
a.hp<=0&&killEnemy(a,!1)}}}for(const t of G)t.item.x=t.x+t.dx,t.item.y=t.y+t.dy;for(const t of M)t.item.x=t.x+t.dx,t.item.y=t.y+t.dy;Game.bullets=Game.bullets.filter(t=>!G.some(s=>s.item===t&&s.removed)&&!(t.y<-30||t.x<-40||t.x>W+40)),(latestCounter&&(a.dead||!Game.bullets.includes(latestCounter.shot))&&counterReadout(latestCounter,"miss",a.dead?"C 未到达 · 导弹艇已被击破":"C 未命中 · 未打断发射")),Game.enemyBullets=Game.enemyBullets.filter(t=>!M.some(s=>s.item===t&&s.removed)&&!(t.y>H+30||t.y<-30||t.x<-30||t.x>W+30)),Game.state==="playing"&&!a.dead&&Math.hypot(a.x-o.x,a.y-o.y)<a.r+o.r&&(damagePlayer(28),o.y=clamp(Math.max(o.y,a.y+a.r*1.9+47),Math.min(Game._minY,H-46),H-46),o.py=o.y),Game.state==="playing"&&(Game.hp<=0?L("dead"):i.hull<=0?L("cargo"):!a.dead&&Game.time+1e-9>=r.deadline?(a.leaving=!0,L("withdrawn")):a.dead&&T().length===0?L("success"):Game.time+1e-9>=r.tailLimit&&L("timeout")),F(),capCombatBudget()}function se(e,n){if(!u)return;const c={x:i.x,y:i.y};q();for(const o of T()){o.x+=i.x-c.x*e,o.y+=i.y-c.y*n;const p=o.vx*e,w=o.vy*n,G=Math.hypot(p,w)||1;o.vx=p/G*r.missileSpeed,o.vy=w/G*r.missileSpeed}releaseTouchControls(),BossPractice.attemptId++,B={x:Game.player.x,y:Game.player.y},h("resize",{width:W,height:H}),["playing","paused","layout-paused"].includes(Game.state)&&(Game.state="layout-paused",accumulator=0,els.paused.classList.add("hidden"),J(measureAnswerLayout())),F()}function ie(e,n){const c=Math.max(0,e-(r.bossRadius+5+4))/560,o=n-r.warning-c,p=n-c;return{state:o>0?"wait":p>.06?"release":"late",travel:c,opensIn:o,closesIn:p}}function _(){return!y||x<3||!a||a.dead||f>=r.deadline?null:ie(Math.hypot(a.x-Game.player.x,a.y-(Game.player.y-30)),f-Game.time)}function guardDecisionHint({playing, charge, inFlight, left, bossAlive}) {
 if (!playing) return "";
 if (left>0) return "护航 "+(Math.max(1,Math.ceil(left*10-1e-7))/10).toFixed(1)+" 秒 · 只挡运输机下一枚";
 if (charge<2) return "";
 if (!inFlight) return charge===2&&bossAlive?"已攒 2 格 · 再截 1 枚可反击":"";
 if (!bossAlive) return "V 护航 · 花 2 格挡下一枚";
 if (charge===2) return "V 花 2 格保船 · 或再截 1 枚攒反击";
 return "V 花 2 格保船 · C 花 3 格反击";
}
// A geometry-only estimate at the current positions. Interceptions can still remove the missile.
function guardThreat(missiles, ship) {
  if(moving)return movingGuardThreat(missiles,ship);
  const target=E(ship);
  let soon=false, later=false;
  for(const m of missiles) {
    if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||!Number.isFinite(m.vx)||!Number.isFinite(m.vy)||!Number.isFinite(m.r))continue;
    let t=z({x:m.x,y:m.y,dx:m.vx*GUARD_SECONDS,dy:m.vy*GUARD_SECONDS},target,m.r+ship.r);
    if(t!==null && t*GUARD_SECONDS<GUARD_SECONDS-1e-9) {soon=true;break;}
    // A tangent or out-of-line projectile is not necessarily a distant cargo threat.
    const rx=m.x-ship.x,ry=m.y-ship.y,p=rx*m.vx+ry*m.vy,v=m.vx*m.vx+m.vy*m.vy;
    if(p<0&&v>0&&(rx*m.vy-ry*m.vx)**2 <= (m.r+ship.r)**2*v) later=true;
  }
  return soon?"soon":later?"early":"unknown";
}
function F(){if(!u)return;const guardButton=$id("guard-btn"),guardActive=guardUntil>Game.time,missiles=T();
 guardButton.disabled=Game.state!=="playing"||x<2||guardActive||!missiles.length;
 const timing=y&&!guardButton.disabled?guardThreat(missiles,i):"unknown";
 guardButton.textContent=guardActive?"护航 "+(Math.max(1,Math.ceil((guardUntil-Game.time)*10-1e-7))/10).toFixed(1)+"s":timing==="soon"?"V · 来弹将至":timing==="early"?"V · 现在偏早":"V · 护航 2 格";
 guardButton.title="消耗2格，1.2秒内挡运输机下一枚导弹；不伤艇、不回能。留3格可按C反击。来弹何时触及仅按当前轨迹估计，仍可能被拦截。";const e=missiles.length,n=$id("counter-btn");n.disabled=Game.state!=="playing"||x<3||a.dead;const c=_();n.textContent=c?c.state==="wait"?"C \xB7 \u7B49\u5F85\u7EA6 "+Math.max(0,c.opensIn).toFixed(1)+"s":c.state==="release"?"C \xB7 \u5EFA\u8BAE\u73B0\u5728\u53CD\u51FB":"C \xB7 \u672C\u8F6E\u53EF\u80FD\u504F\u665A":x>=3?"\u53CD\u51FB\u5C31\u7EEA \xB7 C":"\u53CD\u51FB "+x+"/3 \xB7 C",n.dataset.timing=c?c.state:"charging",n.title="\u6839\u636E\u5F53\u524D\u4F4D\u7F6E\u4F30\u7B97\u98DE\u884C\u63D0\u524D\u91CF\uFF1B\u771F\u6B63\u5230\u8FBE\u9501\u5B9A\u7A97\u53E3\u624D\u6253\u65AD\u3002\u4ECD\u53EF\u968F\u65F6\u53D1\u5C04\u9020\u62106\u4F24\u3002",$id("convoy-readout").textContent=`\u8FD0\u8F93\u673A ${i.hull}/3 \xB7 \u5728\u9014 ${e} \u679A \xB7 ${a.dead?"\u6E05\u4F59\u5F39":Math.max(0,r.deadline-Game.time).toFixed(1)+"s"}${b?" \xB7 "+(y?"\u624B\u52A8":"\u53CD\u51FB")+"\u5145\u80FD "+x+"/3":""}`,$id("sector-progress").textContent=a.dead?`\u5BFC\u5F39\u8247\u5DF2\u51FB\u7834 \xB7 \u6E05\u9664\u5269\u4F59 ${e} \u679A\u5BFC\u5F39`:c?"\u53CD\u51FB\u9884\u8BA1\u98DE\u884C "+c.travel.toFixed(1)+"s \xB7 \u5230\u8FBE\u9501\u5B9A\u671F\u624D\u6253\u65AD":moving?"横移撤离 · 沿橙线换位拦截 / 跟打导弹艇":"\u56FA\u5B9A\u5F85\u63F4 \xB7 \u5C04\u51FB\u5BFC\u5F39 / \u62A2\u653B\u5BFC\u5F39\u8247" ;const hint=y?guardDecisionHint({playing:Game.state==="playing",charge:x,inFlight:e>0,left:guardUntil-Game.time,bossAlive:!a.dead}):"";
 const progress=$id("sector-progress"),receipt=y&&Game.state==="playing"?currentCounterText():"";
 if(receipt||hint){progress.textContent=receipt||hint;progress.dataset.guardHint="";}else delete progress.dataset.guardHint;
}function D(){return{valid:!!i&&!!a&&i.x-72>=8&&i.x+72<=W-8&&a.x-64>=8&&a.x+64<=W-8&&a.y+a.r+48<=i.y-i.r&&i.y-i.r>=hudClearanceY()&&i.y+62<=H-80,width:W,height:H,bossBottom:a?a.y+a.r:null,cargoTop:i?i.y-i.r:null,cargoLabelBottom:i?i.y+62:null}}function X(){return D().valid}function J(e){if(!u||!["playing","paused","layout-paused"].includes(Game.state))return;const n=e.valid&&X();!n&&Game.state!=="layout-paused"&&(releaseTouchControls(),BossPractice.attemptId++,Game.state="layout-paused",accumulator=0,els.paused.classList.add("hidden")),Game.state==="layout-paused"&&($id("answer-layout-title").textContent="\u23F8 \u8FD0\u8F93\u673A\u77ED\u5173\u5DF2\u6682\u505C",$id("answer-layout-paused").classList.remove("hidden"),$id("answer-layout-resume").disabled=!n,$id("answer-layout-message").textContent=n?"\u5E03\u5C40\u5DF2\u8C03\u6574\u3002\u77ED\u5173\u4E0E\u5728\u9014\u5BFC\u5F39\u4ECD\u51BB\u7ED3\uFF0C\u70B9\u51FB\u7EE7\u7EED\uFF1B\u8010\u4E45\u3001\u7206\u5F39\u4E0E\u53D1\u5C04\u9884\u544A\u4E0D\u91CD\u7F6E\u3002":"\u7A97\u53E3\u4E0D\u8DB3\u4EE5\u5BB9\u7EB3\u5BFC\u5F39\u8247\u3001\u8FD0\u8F93\u673A\u548C\u6807\u8BB0\u3002\u77ED\u5173\u5DF2\u51BB\u7ED3\uFF1B\u8BF7\u589E\u5927\u7A97\u53E3\uFF0C\u6216\u8FD4\u56DE\u4E3B\u83DC\u5355\u3002")}function ne(e){if(typeof ThunderEscortArt==="undefined"||!ThunderEscortArt.draw(ctx,"cruiser",e.hitFlash)){ctx.fillStyle=e.hitFlash>0?"#fff":"#5a4763",ctx.strokeStyle="#f7ad6e",ctx.lineWidth=2,ctx.beginPath(),ctx.moveTo(-55,-16),ctx.lineTo(42,-16),ctx.lineTo(62,0),ctx.lineTo(42,24),ctx.lineTo(-55,24),ctx.closePath(),ctx.fill(),ctx.stroke(),ctx.fillStyle="#b68492",ctx.fillRect(-10,-28,30,39),ctx.fillStyle="#153345",ctx.fillRect(-3,-20,16,9),ctx.fillStyle="#ffcf7e",ctx.fillRect(-57,13,24,10);}ctx.fillStyle="#fff1d0",ctx.font="bold 12px sans-serif",ctx.textAlign="center",ctx.fillText("\u5BFC\u5F39\u8247",0,43)}function le(){if(!(!u||!i)){ctx.save(),ctx.translate(i.x,i.y),guardUntil>Game.time&&(ctx.beginPath(),ctx.arc(0,0,i.r+14,0,Math.PI*2),ctx.strokeStyle="#73e8ff",ctx.lineWidth=3,ctx.stroke());if(typeof ThunderEscortArt==="undefined"||!ThunderEscortArt.draw(ctx,"cargo",i.hitFlash)){ctx.strokeStyle=i.hitFlash>0?"#fff":"#83edcc",ctx.fillStyle="#193c4b",ctx.lineWidth=2,ctx.beginPath(),ctx.moveTo(0,-29),ctx.lineTo(8,-6),ctx.lineTo(35,9),ctx.lineTo(33,16),ctx.lineTo(7,8),ctx.lineTo(7,24),ctx.lineTo(17,29),ctx.lineTo(-17,29),ctx.lineTo(-7,24),ctx.lineTo(-7,8),ctx.lineTo(-33,16),ctx.lineTo(-35,9),ctx.lineTo(-8,-6),ctx.closePath(),ctx.fill(),ctx.stroke();}ctx.fillStyle="#a5f6da",ctx.font="bold 12px sans-serif",ctx.textAlign="center",ctx.fillText(moving?"运输机":"\u8FD0\u8F93\u673A \xB7 \u56FA\u5B9A\u5F85\u63F4",0,46);for(let e=0;e<3;e++)ctx.fillStyle=e<i.hull?"#83edcc":"#4a4652",ctx.fillRect(-20+e*14,53,11,5);if(b){ctx.fillStyle="#d6fff3",ctx.font="bold 11px sans-serif",ctx.fillText((y?"\u6218\u673A\u50A8\u80FD ":"\u62E6\u622A\u53CD\u51FB ")+x+"/3",0,76);for(let e=0;e<3;e++)ctx.fillStyle=e<x?"#6dffd4":"#28484d",ctx.fillRect(-20+e*14,82,11,6)}if(ctx.restore(),y&&!a.dead&&(x===3||v>0)){const e=Game.player;ctx.save(),ctx.translate(e.x,e.y),ctx.strokeStyle="#6dffd4",ctx.lineWidth=2,ctx.beginPath(),ctx.arc(0,0,e.r+8+(v>0?(1-v/.35)*15:0),0,Math.PI*2),ctx.stroke(),ctx.fillStyle="#d6fff3",ctx.textAlign="center",ctx.font="bold 11px sans-serif";const n=_();ctx.fillText(v>0?"\u53CD\u51FB\u53D1\u5C04":n?.state==="release"?"C \xB7 \u5EFA\u8BAE\u53CD\u51FB":n?.state==="late"?"\u672C\u8F6E\u53EF\u80FD\u504F\u665A":"C \xB7 \u7B49\u5F85\u7A97\u53E3",0,38),ctx.restore()}y&&$>0&&(ctx.save(),ctx.fillStyle="#6dffd4",ctx.font="bold 14px sans-serif",ctx.textAlign="center",ctx.fillText("\u53D1\u5C04\u5DF2\u6253\u65AD \xB7 \u8FD0\u8F93\u673A\u83B7\u5598\u606F",a.x,a.y+78),ctx.restore()),!a.dead&&f-Game.time<=r.warning+1e-9&&f>Game.time&&(ctx.save(),ctx.strokeStyle="#ffbd69",ctx.lineWidth=2,ctx.setLineDash([8,7]),ctx.beginPath(),drawConvoyWarning(f),ctx.stroke(),ctx.setLineDash([]),ctx.fillStyle="#ffe7a5",ctx.font="bold 12px sans-serif",ctx.textAlign="center",!moving&&ctx.fillText(y?"\u9501\u5B9A\u4E2D \xB7 \u53CD\u51FB\u547D\u4E2D\u53EF\u6253\u65AD":"\u9501\u5B9A\u8FD0\u8F93\u673A",a.x-54,a.y+60),ctx.restore());drawThirdIntercept()}}function oe(e){ctx.save(),ctx.translate(e.x,e.y),ctx.rotate(Math.atan2(e.vy,e.vx)+Math.PI/2),ctx.fillStyle="#ff743e",ctx.beginPath(),ctx.moveTo(-4,10),ctx.lineTo(0,18),ctx.lineTo(4,10),ctx.fill(),ctx.fillStyle="#ffd59a",ctx.strokeStyle="#301a25",ctx.lineWidth=2,ctx.beginPath(),ctx.moveTo(0,-12),ctx.lineTo(6,-4),ctx.lineTo(6,8),ctx.lineTo(10,12),ctx.lineTo(-10,12),ctx.lineTo(-6,8),ctx.lineTo(-6,-4),ctx.closePath(),ctx.fill(),ctx.stroke(),ctx.restore(),ctx.fillStyle="#fff1cd",ctx.font="bold 9px monospace",ctx.textAlign="center",ctx.fillText("1HP",e.x,e.y-18)}return Object.freeze({get active(){return u},start:Q,clear:U,finish:L,kill:V,beginStep:ee,step:ae,resized:se,hud:F,drawBoss:ne,drawWorld:le,drawMissile:oe,onBomb:te,releaseCounter:Z,releaseGuard,inspect:N,layoutSafety:J,layoutValid:X})})();window.ThunderConvoyTrial=Object.freeze({start:()=>ConvoyTrial.start(),inspect:()=>ConvoyTrial.inspect()});

document.getElementById("convoy-crosswind-btn")?.addEventListener("click",()=>{SFX.ensure();ConvoyTrial.start("crosswind");});
