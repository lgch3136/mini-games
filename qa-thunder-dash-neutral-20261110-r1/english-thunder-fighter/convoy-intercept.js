'use strict';
/* LOCAL candidate. Fixed encounter values, independent from normal progression.
 * Weapons, player motion, Dash, and B still belong to the original engine.
 * Only this scene uses swept, chronological projectile contact resolution.
 */
const ConvoyTrial = (() => {
  const RULES = Object.freeze({ bossHp:45, bossRadius:46, hull:3, shipRadius:24,
    missileRadius:9, missileHp:1, missileSpeed:150, firstShot:1.2,
    interval:2.4, warning:.6, deadline:32, tailLimit:40 });
  let active = false, result = null, ship = null, boss = null;
  let nextLaunch = RULES.firstShot, serial = 0, previousPlayer = null;
  let events = [];
  const record = (type, extra = {}) => events.push({type, time:Game.time, ...extra});
  const missiles = () => Game.enemyBullets.filter(b => b.convoyMissile);
  function inspect() {
    return JSON.parse(JSON.stringify({active, result, elapsed:Game.time, nextLaunch,
      ship, boss, missiles:missiles(), events, rules:RULES, layout:active?geometry():null}));
  }
  function place() {
    ship.x = W * .25; ship.y = H - 170;
    boss.x = W * .72; boss.y = Math.max(150, hudClearanceY() + 12);
  }
  function start() {
    if (Game.state !== 'menu' && !(active && Game.state === 'over')) return false;
    clearRewardReceipts(); invalidateBossPractice(); clearAnswerFlow(); releaseTouchControls();
    BossPractice.mode = 'convoy'; BossPractice.attemptId++;
    active = true; result = null; events = []; serial = 0; nextLaunch = RULES.firstShot;
    Game.bombPlan = bombPlanChoice; // Respect the original selector. Difficulty stays unchanged.
    Game.state = 'playing'; Game.phase = 'boss';
    Game.time = 0; Game.level = 1; Game.hp = 100; Game.shield = 0; Game.bombs = 1;
    Game.score = Game.combo = Game.maxCombo = Game._lastCombo = Game.graze = Game.medalChain = 0;
    Game.dashCooldown = Game.dashCount = Game.reactor = Game.sectors = 0;
    Game.refitPending = Game.bossPending = false; Game.nextWaveTimer = null;
    Game.question = null; Game.questionIndex = Game.questionStarted = 0;
    Game.spawnTimer = Game.eventTimer = Game.passageTime = 0; Game.passageSupply = false;
    Game.lastEncounter = Game.encounterKind = null; Game.encounterSlot = 0; Game.shake = 0;
    Game.review = []; Game.stats = {questions:0,correct:0,wrongAnswers:0,vocab:0,grammar:0};
    for (const key of ['bullets','enemyBullets','enemies','powerups','particles','shockwaves','floaters','carrierQueue']) Game[key].length = 0;
    GroundScene.time = 0; GroundScene.exitAge = 0; ThunderCoastScene.reset();
    const p = Game.player;
    Object.assign(p, {x:W/2,y:H-90,px:W/2,py:H-90,r:15,fireTimer:0,fireInterval:.15,
      weapon:'spread',weaponLevel:1,double:0,invuln:1.5,pointer:false,spawnRing:3,
      muzzle:0,berserk:0,kvx:0,kvy:0});
    ship = {x:0,y:0,r:RULES.shipRadius,hull:RULES.hull,maxHull:RULES.hull,hitFlash:0};
    boss = {x:0,y:0,r:RULES.bossRadius,hp:RULES.bossHp,maxHp:RULES.bossHp,
      boss:true,convoyBoss:true,t:0,phase:0,entering:false,leaving:false,dead:false,hitFlash:0};
    place(); Game.enemies.push(boss);
    document.activeElement?.blur?.();
    for (const id of ['menu','over','convoy-over','paused','refit','answer-layout-paused']) $id(id).classList.add('hidden');
    wrap.classList.add('convoy-trial'); els.hud.classList.remove('hidden');
    els.qKind.textContent = '固定短关'; els.qPrompt.textContent = '保住运输机，击败导弹艇';
    els.qFeedback.textContent = ''; els.qHint.textContent = '运输机固定待援；本关不计纪录';
    Game._nextLayoutCheck = 0; Game.answerLayoutDirty = true;
    syncBossLife(); place();
    syncAnswerLayout(); Game._minY = Math.min(H - 80, hudClearanceY());
    p.y = p.py = Math.max(Math.min(p.y,H-46),Math.min(Game._minY,H-46));
    previousPlayer = {x:p.x,y:p.y};
    updateHud(); syncBossLife(); place(); hud();
    if (window.ChipMusic) { ChipMusic.setMuted(SFX.muted); ChipMusic.play('thunder-stage'); }
    accumulator = 0; ensureLoop(); record('start',{plan:Game.bombPlan});
    return true;
  }
  function clear() {
    if (!active) return;
    active = false; result = null; previousPlayer = null;
    wrap.classList.remove('convoy-trial'); $id('convoy-over').classList.add('hidden');
    $id('convoy-readout').textContent = '';
    $id('answer-layout-title').textContent = '⏸ 数据通道已暂停';
  }
  function finish(reason) {
    if (!active || Game.state !== 'playing' || result) return false;
    result = {reason,success:reason==='success',time:Game.time,hull:ship.hull,
      bossHp:Math.max(0,boss.hp),missiles:missiles().length,playerHp:Game.hp};
    record('terminal',result);
    BossPractice.attemptId++; Game.state = 'over';
    Game.nextWaveTimer = null; Game.bossPending = Game.refitPending = false;
    clearAnswerFlow(); releaseTouchControls(); accumulator = 0;
    if (window.ChipMusic) ChipMusic.stop(); SFX.ac?.suspend().catch(() => {});
    for (const id of ['hud','over','paused','refit','answer-layout-paused','boss-practice-offer']) $id(id).classList.add('hidden');
    $id('convoy-over').classList.remove('hidden');
    const labels = {success:'运输机获救 · 导弹艇击破',cargo:'运输机损毁',dead:'战机损毁',withdrawn:'导弹艇撤离 · 未击破',timeout:'余弹处理超时 · 本次未完成'};
    $id('convoy-result-title').textContent = result.success ? '短关完成' : '短关结束';
    $id('convoy-result-summary').textContent = labels[reason];
    $id('convoy-result-stats').textContent = `运输机 ${ship.hull}/3 · 导弹艇 ${Math.max(0,boss.hp)}/45 · 在途导弹 ${missiles().length} · ${Game.time.toFixed(1)} 秒`;
    $id('convoy-over').scrollTop = 0; syncBossLife();
    return true;
  }
  function kill(e) {
    if (!active || !e.convoyBoss || e.dead) return false;
    e.dead = true; e.hp = Math.min(0,e.hp); removeEnemy(e);
    record('boss-death',{missiles:missiles().length});
    explode(e.x,e.y,'#ff9f43',50,1.8); SFX.boom();
    // Do not clear missiles, award score/loot, open refit, or finish before contacts.
    return true;
  }
  function beginStep() { previousPlayer = {x:Game.player.x,y:Game.player.y}; }
  function onBomb() {
    if (!active) return;
    record(Game.bombPlan==='escort'?'escort-shield':'bomb-clear',
      {missileIds:Game.bombPlan==='escort'?[]:missiles().map(b=>b.id)});
  }
  // Earliest intersection of two linear paths over [lo,1], including initial overlap.
  // Endpoint-only inherited enemy collision would tunnel through interceptable missiles.
  function contact(a,b,r,lo=0) {
    const ax=a.x+a.dx*lo, ay=a.y+a.dy*lo;
    const bx=b.x+b.dx*lo, by=b.y+b.dy*lo;
    const x=ax-bx,y=ay-by,dx=(a.dx-b.dx)*(1-lo),dy=(a.dy-b.dy)*(1-lo);
    const c=x*x+y*y-r*r;
    if(c<0) return lo;
    const aa=dx*dx+dy*dy,bb=2*(x*dx+y*dy),disc=bb*bb-4*aa*c;
    if(aa===0||disc<0) return null;
    const t=(-bb-Math.sqrt(disc))/(2*aa);
    return t>=0&&t<=1 ? lo+t*(1-lo) : null;
  }
  const stationary = o => ({x:o.x,y:o.y,dx:0,dy:0});
  function step(dt) {
    if (!active || Game.state!=='playing') return;
    boss.t += dt; boss.hitFlash = Math.max(0,boss.hitFlash-dt); ship.hitFlash = Math.max(0,ship.hitFlash-dt);
    const p=Game.player, prev=previousPlayer||p;
    const playerPath={x:prev.x,y:prev.y,dx:p.x-prev.x,dy:p.y-prev.y};
    const friendly=[], hostile=[], contacts=[];
    let order=0;
    const queue=(time,priority,type,data)=>{if(time!==null) contacts.push({time,priority,type,order:order++,...data});};
    for(const b of Game.bullets) {
      // Same homing law/target set as the engine: enemies only, never missiles.
      if(b.homing&&Game.enemies.length) {
        let target=Game.enemies[0],best=Infinity;
        for(const e of Game.enemies) {const d=Math.hypot(e.x-b.x,e.y-b.y);if(d<best){best=d;target=e;}}
        const desired=Math.atan2(target.y-b.y,target.x-b.x);
        b.vx+=Math.cos(desired)*900*dt;b.vy+=Math.sin(desired)*900*dt;
        const speed=Math.hypot(b.vx,b.vy)||1;b.vx*=560/speed;b.vy*=560/speed;
      }
      const f={item:b,x:b.x,y:b.y,dx:(b.vx||0)*dt,dy:b.vy*dt,used:false,removed:false};
      friendly.push(f);
      if(!boss.dead) queue(contact(f,stationary(boss),boss.r+b.r+4),2,'boss',{f});
    }
    for(const b of Game.enemyBullets) hostile.push({item:b,x:b.x,y:b.y,dx:b.vx*dt,dy:b.vy*dt,from:0,present:true,removed:false});
    const previousTime=Game.time-dt;
    if(!boss.dead && nextLaunch <= Game.time+1e-9 && nextLaunch < RULES.deadline) {
      const from=clamp((nextLaunch-previousTime)/dt,0,1);
      const x=boss.x-54,y=boss.y+18,angle=Math.atan2(ship.y-y,ship.x-x);
      const b={id:++serial,convoyMissile:true,kind:'convoy-missile',x,y,
        vx:Math.cos(angle)*RULES.missileSpeed,vy:Math.sin(angle)*RULES.missileSpeed,
        r:RULES.missileRadius,hp:RULES.missileHp,maxHp:RULES.missileHp,color:'#ffbd69'};
      const h={item:b,x:x-b.vx*dt*from,y:y-b.vy*dt*from,dx:b.vx*dt,dy:b.vy*dt,from,present:false,removed:false};
      hostile.push(h);queue(from,-1,'launch',{h,scheduled:nextLaunch});nextLaunch+=RULES.interval;
    }
    for(const h of hostile) {
      queue(contact(h,playerPath,h.item.r+p.r,h.from),0,'player',{h});
      if(h.item.convoyMissile) {
        queue(contact(h,stationary(ship),h.item.r+ship.r,h.from),0,'cargo',{h});
        for(const f of friendly) queue(contact(f,h,f.item.r+h.item.r+4,h.from),1,'intercept',{f,h});
      }
    }
    // All harmful and friendly contacts share one clock. For an exact tie, harm
    // precedes interception; a player blocks before cargo only if reached first.
    contacts.sort((a,b)=>a.time-b.time||a.priority-b.priority||a.order-b.order);
    for(const c of contacts) {
      if(Game.state!=='playing') break;
      const {f,h}=c;
      if(c.type==='launch') {
        if(!boss.dead) {h.present=true;Game.enemyBullets.push(h.item);record('missile-launch',{id:h.item.id,scheduled:c.scheduled,x:h.item.x,y:h.item.y,vx:h.item.vx,vy:h.item.vy});}
        continue;
      }
      if(h&&(!h.present||h.removed)) continue;
      if(f&&(f.used||f.removed)) continue;
      if(c.type==='boss'&&boss.dead) continue;
      if(c.type==='player'||c.type==='cargo') {
        h.removed=true;
        if(c.type==='player') {
          const hp=Game.hp,shield=Game.shield;damagePlayer(8);
          record('body-intercept',{id:h.item.id,hpBefore:hp,hpAfter:Game.hp,shieldBefore:shield,shieldAfter:Game.shield});
        } else {ship.hull=Math.max(0,ship.hull-1);ship.hitFlash=.25;record('cargo-impact',{id:h.item.id,hull:ship.hull});}
        explode(h.x+h.dx*c.time,h.y+h.dy*c.time,'#ff7b54',8,.6);
      } else {
        const target=c.type==='boss'?boss:h.item;
        target.hp-=f.item.damage||1;target.hitFlash=.08;
        hitSparks(f.x+f.dx*c.time,f.y+f.dy*c.time,f.item.color||'#9ff3ff');
        // Original laser contract: one target per fixed step; pierce counts
        // additional contacts, and a surviving boss can be hit again next step.
        f.used=true;if(f.item.pierce>0) f.item.pierce--;else f.removed=true;
        if(c.type==='intercept') {if(target.hp<=0) h.removed=true;record('shot-intercept',{id:target.id,damage:f.item.damage||1,weapon:f.item.kind||'spread'});}
        else { record('boss-damage',{damage:f.item.damage||1,hp:Math.max(0,boss.hp)}); if(boss.hp<=0) killEnemy(boss,false); }
      }
    }
    for(const f of friendly) {f.item.x=f.x+f.dx;f.item.y=f.y+f.dy;}
    for(const h of hostile) {h.item.x=h.x+h.dx;h.item.y=h.y+h.dy;}
    Game.bullets=Game.bullets.filter(b=>!friendly.some(f=>f.item===b&&f.removed)&&!(b.y < -30 || b.x < -40 || b.x > W+40));
    Game.enemyBullets=Game.enemyBullets.filter(b=>!hostile.some(h=>h.item===b&&h.removed)&&!(b.y>H+30||b.y< -30||b.x< -30||b.x>W+30));
    // Keep original discrete boss/player crash damage and pushback. No ram damage
    // to the boss, no transport collision with friendly fire or player shields.
    if(Game.state==='playing'&&!boss.dead&&Math.hypot(boss.x-p.x,boss.y-p.y)<boss.r+p.r) {
      damagePlayer(28);p.y=clamp(Math.max(p.y,boss.y+boss.r*1.9+47),Math.min(Game._minY,H-46),H-46);p.py=p.y;
    }
    // Evaluate only after this step's harmful contacts. Dead source alone is insufficient.
    if(Game.state==='playing') {
      if(Game.hp<=0) finish('dead');
      else if(ship.hull<=0) finish('cargo');
      else if(!boss.dead&&Game.time+1e-9>=RULES.deadline) {boss.leaving=true;finish('withdrawn');}
      else if(boss.dead&&missiles().length===0) finish('success');
      else if(Game.time+1e-9>=RULES.tailLimit) finish('timeout');
    }
    hud(); capCombatBudget();
  }
  function resized(sx,sy) {
    if(!active) return;
    const old={x:ship.x,y:ship.y};place();
    for(const b of missiles()) {
      b.x+=ship.x-old.x*sx;b.y+=ship.y-old.y*sy;
      const vx=b.vx*sx,vy=b.vy*sy,s=Math.hypot(vx,vy)||1;
      b.vx=vx/s*RULES.missileSpeed;b.vy=vy/s*RULES.missileSpeed;
    }
    releaseTouchControls();BossPractice.attemptId++;previousPlayer={x:Game.player.x,y:Game.player.y};
    record('resize',{width:W,height:H});
    if(['playing','paused','layout-paused'].includes(Game.state)) {
      Game.state='layout-paused';accumulator=0;els.paused.classList.add('hidden');
      layoutSafety(measureAnswerLayout());
    }
    hud();
  }
  function hud() {
    if(!active) return;
    const n=missiles().length;
    $id('convoy-readout').textContent=`运输机 ${ship.hull}/3 · 在途 ${n} 枚 · ${boss.dead?'清余弹':Math.max(0,RULES.deadline-Game.time).toFixed(1)+'s'}`;
    $id('sector-progress').textContent=boss.dead ? `导弹艇已击破 · 清除剩余 ${n} 枚导弹` : '固定待援 · 射击导弹 / 抢攻导弹艇';
  }
  // Added trial geometry requirements supplement, never weaken, the original
  // answer-layout gate. All measurements are logical game coordinates.
  function geometry() {
    const valid=!!ship&&!!boss&&ship.x-72>=8&&ship.x+72<=W-8&&
      boss.x-64>=8&&boss.x+64<=W-8&&
      boss.y+boss.r+48<=ship.y-ship.r&&
      ship.y-ship.r>=hudClearanceY()&&ship.y+62<=H-80;
    return {valid,width:W,height:H,bossBottom:boss?boss.y+boss.r:null,
      cargoTop:ship?ship.y-ship.r:null,cargoLabelBottom:ship?ship.y+62:null};
  }
  function layoutValid() { return geometry().valid; }
  function layoutSafety(layout) {
    if(!active||!['playing','paused','layout-paused'].includes(Game.state)) return;
    const valid=layout.valid&&layoutValid();
    if(!valid&&Game.state!=='layout-paused') {
      releaseTouchControls();BossPractice.attemptId++;Game.state='layout-paused';accumulator=0;
      els.paused.classList.add('hidden');
    }
    if(Game.state!=='layout-paused') return;
    $id('answer-layout-title').textContent='⏸ 运输机短关已暂停';
    $id('answer-layout-paused').classList.remove('hidden');
    $id('answer-layout-resume').disabled=!valid;
    $id('answer-layout-message').textContent=valid
      ? '布局已调整。短关与在途导弹仍冻结，点击继续；耐久、爆弹与发射预告不重置。'
      : '窗口不足以容纳导弹艇、运输机和标记。短关已冻结；请增大窗口，或返回主菜单。';
  }
  function drawBoss(e) {
    ctx.fillStyle=e.hitFlash>0?'#fff':'#5a4763';ctx.strokeStyle='#f7ad6e';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-55,-16);ctx.lineTo(42,-16);ctx.lineTo(62,0);ctx.lineTo(42,24);ctx.lineTo(-55,24);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#b68492';ctx.fillRect(-10,-28,30,39);ctx.fillStyle='#153345';ctx.fillRect(-3,-20,16,9);
    ctx.fillStyle='#ffcf7e';ctx.fillRect(-57,13,24,10);
    ctx.fillStyle='#fff1d0';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('导弹艇',0,43);
  }
  function drawWorld() {
    if(!active||!ship) return;
    ctx.save();ctx.translate(ship.x,ship.y);
    ctx.strokeStyle=ship.hitFlash>0?'#fff':'#83edcc';ctx.fillStyle='#193c4b';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,-29);ctx.lineTo(8,-6);ctx.lineTo(35,9);ctx.lineTo(33,16);ctx.lineTo(7,8);ctx.lineTo(7,24);ctx.lineTo(17,29);ctx.lineTo(-17,29);ctx.lineTo(-7,24);ctx.lineTo(-7,8);ctx.lineTo(-33,16);ctx.lineTo(-35,9);ctx.lineTo(-8,-6);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#a5f6da';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('运输机 · 固定待援',0,46);
    for(let i=0;i<3;i++){ctx.fillStyle=i<ship.hull?'#83edcc':'#4a4652';ctx.fillRect(-20+i*14,53,11,5);}
    ctx.restore();
    if(!boss.dead&&nextLaunch-Game.time<=RULES.warning+1e-9&&nextLaunch>Game.time) {
      ctx.save();ctx.strokeStyle='#ffbd69';ctx.lineWidth=2;ctx.setLineDash([8,7]);
      ctx.beginPath();ctx.moveTo(boss.x-54,boss.y+18);ctx.lineTo(ship.x,ship.y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#ffe7a5';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('锁定运输机',boss.x-54,boss.y+60);ctx.restore();
    }
  }
  function drawMissile(b) {
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx)+Math.PI/2);
    ctx.fillStyle='#ff743e';ctx.beginPath();ctx.moveTo(-4,10);ctx.lineTo(0,18);ctx.lineTo(4,10);ctx.fill();
    ctx.fillStyle='#ffd59a';ctx.strokeStyle='#301a25';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(6,-4);ctx.lineTo(6,8);ctx.lineTo(10,12);ctx.lineTo(-10,12);ctx.lineTo(-6,8);ctx.lineTo(-6,-4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.fillStyle='#fff1cd';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('1HP',b.x,b.y-18);
  }
  return Object.freeze({get active(){return active},start,clear,finish,kill,beginStep,step,resized,hud,drawBoss,drawWorld,drawMissile,onBomb,inspect,layoutSafety,layoutValid});
})();
// Only inspection and the same menu entry are public; no damage/weapon/test setters.
window.ThunderConvoyTrial=Object.freeze({start:()=>ConvoyTrial.start(),inspect:()=>ConvoyTrial.inspect()});
