import {visibleTo} from "./river-reeds.mjs?v=canyon-palm1";

const gear = {
  boots:    {name:"渡风履",  price:[20,80],   detail:["移动速度 +18%","移速加成提高至 25%"]},
  coat:     {name:"守楼甲",  price:[20,90],   detail:["最大生命 +75","再增加 105 最大生命"]},
  blade:    {name:"听潮刃",  price:[55,112],  detail:["普攻伤害 +14","再增加 16 普攻伤害"]},
  focus:    {name:"流光佩",  price:[58,108],  detail:["技能冷却缩短 16%","冷却缩减提高至 24%"]},
  standard: {name:"先登旗",  price:[76,125],  detail:["附近兵线攻塔伤害 +32%","兵线攻塔加成提高至 48%"]}
};
const builds = [["boots","blade","standard"],["boots","focus","standard"],["focus","boots","coat"],["focus","blade","boots"],["coat","blade","standard"]];
const ascent = [0,30,74,126,192,270,360,464,580,710,856,1018,1196,1390,1600];
const alive = u => u && !u.dead && u.hp > 0;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const player = match => match.units.find(u => u.id === match.playerId);
const cachedRosters = new WeakMap();
const slots = ["Q","E","R"];
const teamActor = u => u && (u.team === 0 || u.team === 1);

export function skillPoints(hero) {
  const ranks=hero?.skillRanks;
  return ranks?Math.max(0,hero.level-ranks[0]-ranks[1]-ranks[2]):0;
}

function rankLimit(level,slot) {
  return slot===2?Math.min(3,Math.floor(level/4)):Math.min(6,Math.ceil(level/2));
}

export function canLearnSkill(hero,slot) {
  return Number.isInteger(slot)&&slot>=0&&slot<3&&skillPoints(hero)>0&&hero.skillRanks[slot]<rankLimit(hero.level,slot);
}

export function learnPlayerSkill(match,slot) {
  if(!match||match.result)return false;
  prepareBuild(match);
  const hero=player(match);
  if(!canLearnSkill(hero,slot))return false;
  hero.skillRanks[slot]++;
  return true;
}

function train(hero,lead=hero.skillPriority===1?1:0) {
  const ranks = hero.skillRanks;
  for (let point = ranks[0]+ranks[1]+ranks[2]+1; point <= hero.level; point++) {
    const ultimate = rankLimit(point,2);
    const basic = rankLimit(point,lead);
    if (ranks[2] < ultimate) ranks[2]++;
    else if (point === 2) ranks[ranks[0]===0?0:1]++;
    else if (ranks[lead] < basic) ranks[lead]++;
    else ranks[1-lead]++;
  }
}

export function setPlayerTraining(match,mode) {
  if(!match||match.result||![-1,0,1].includes(mode))return false;
  prepareBuild(match);
  match.autoSkillSlot=mode;
  if(mode>=0)train(player(match),mode);
  return true;
}

function syncLocal(match,hero) {
  if (hero.id !== match.playerId) return;
  match.gold=hero.gold; match.xp=hero.xp; match.level=hero.level;
  match.lastHits=hero.lastHits; match.soloKills=hero.kills; match.deaths=hero.deaths;
  match.inventory=hero.inventory; match.equipment=hero.inventory.at(-1);
}

export function prepareBuild(match) {
  let teams = cachedRosters.get(match);
  if (teams) return teams;
  teams = [[],[]];
  match.autoSkillSlot ??= -1;
  if (match.autoBuild == null) {
    match.autoBuild = true;
    try { match.autoBuild = globalThis.localStorage?.getItem("estuary-auto-shop-v1") !== "off"; } catch {}
  }
  for (const hero of match.units) {
    if (hero.kind !== "hero" || !teamActor(hero)) continue;
    const old = hero.id === match.playerId ? match : {};
    hero.inventory ??= old.inventory || (old.equipment?[old.equipment]:[]);
    hero.gearTiers ??= Object.fromEntries(hero.inventory.map(key=>[key,1]));
    hero.gold ??= old.gold || 0;
    hero.earnedGold ??= hero.gold + hero.inventory.reduce((sum,key)=>sum+(gear[key]?.price[0]||0),0);
    hero.xp ??= old.xp || 0; hero.level ??= old.level || 1;
    hero.kills ??= old.soloKills || 0; hero.deaths ??= old.deaths || 0;
    hero.assists ??= 0; hero.lastHits ??= old.lastHits || 0;
    const local=hero.id===match.playerId;
    hero.skillPriority ??= local && match.openingSkill===1?1:0;
    if(!hero.skillRanks){
      hero.skillRanks=[0,0,0];
      if(local&&hero.level>1&&match.openingSkill!==-1)train(hero);
      else if(local&&match.openingSkill!==-1)hero.skillRanks[hero.skillPriority===1?1:0]=1;
    }
    if(!local)train(hero);
    else if(match.autoSkillSlot>=0)train(hero,match.autoSkillSlot);
    teams[hero.team].push(hero);
    syncLocal(match,hero);
  }
  match.teamKills ??= [match.kills || 0,0];
  match.nextIncome ??= Math.max(12, 4*(Math.floor(match.time/4)+1));
  cachedRosters.set(match,teams);
  return teams;
}

export function skillRank(hero,slot) { return hero?.skillRanks?.[slot] || 0; }
export function skillCooldown(hero,slot,base) {
  return base*(1-(hero.haste||0))*(1-.035*Math.max(0,skillRank(hero,slot)-1));
}

export function skillStudyControls(getMatch,available,definitions,announce) {
  const buttons=slots.map(key=>document.querySelector('.skills [data-key="'+key.toLowerCase()+'"]'));
  const study=slots.map((_,slot)=>document.querySelector('.skills [data-study="'+slot+'"]'));
  const level=document.getElementById("level");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let previousHero,previousLevel,previousPoints,previousHaste;
  function paint(hero) {
    const points=skillPoints(hero);
    if(hero===previousHero&&hero.level===previousLevel&&points===previousPoints&&hero.haste===previousHaste)return;
    previousHero=hero;previousLevel=hero.level;previousPoints=points;previousHaste=hero.haste;
    setText(level,"Lv."+hero.level+(points?" · "+points+"点":""));
    for(let slot=0;slot<3;slot++){
      const button=buttons[slot],plus=study[slot],rank=skillRank(hero,slot);
      const name=definitions[hero.hero].skills[slot],eligible=canLearnSkill(hero,slot);
      const lock=slot===2&&hero.level<4?"4级":eligible?"可学":hero.level===1?"2级":"未学";
      button.disabled=rank===0;
      button.dataset.lockHint=lock;
      button.classList.toggle("unlearned",!rank);
      button.classList.toggle("can-study",eligible&&!rank);
      button.style.setProperty("--trained-ranks",String(rank));
      button.setAttribute("aria-label",name+(rank?"，招式 "+rank+" 级":"，"+lock));
      if(!rank)setText(document.getElementById(slots[slot].toLowerCase()+"c"),lock);
      plus.hidden=!eligible;
      if(eligible){
        const verb=rank?"升级":"学习";
        const next=rank+1;
        plus.setAttribute("aria-label",verb+name+"至 "+next+" 级，快捷键 "+(slot+1));
        const cooldown=definitions[hero.hero].cds[slot]*(1-(hero.haste||0))*(1-.035*rank);
        plus.title=verb+name+" · "+next+"级 · 冷却 "+Number(cooldown.toFixed(1))+" 秒（"+(slot+1)+"）";
      }
    }
  }
  function spend(slot) {
    if(!available())return false;
    const match=getMatch();
    if(!learnPlayerSkill(match,slot))return false;
    const hero=player(match),rank=skillRank(hero,slot),button=buttons[slot];
    paint(hero);
    if(!reduced.matches)button.animate?.([
      {boxShadow:"0 0 0 2px #fff4a8,0 0 12px #e7bd68"},
      {boxShadow:"0 0 0 5px transparent,0 0 0 transparent"}
    ],{duration:440,easing:"ease-out"});
    announce(definitions[hero.hero].skills[slot],rank);
    return true;
  }
  study.forEach((plus,slot)=>{
    let press=null;
    const onButton=(event)=>{
      const rect=plus.getBoundingClientRect();
      return event.clientX>=rect.left&&event.clientX<rect.right&&event.clientY>=rect.top&&event.clientY<rect.bottom;
    };
    plus.addEventListener("pointerdown",event=>{
      if(event.button!==0||press)return;
      press={id:event.pointerId,x:event.clientX,y:event.clientY,cancelled:false};
      plus.setPointerCapture(event.pointerId);
    });
    plus.addEventListener("pointermove",event=>{
      if(press?.id===event.pointerId&&(!onButton(event)||Math.hypot(event.clientX-press.x,event.clientY-press.y)>12))press.cancelled=true;
    });
    plus.addEventListener("pointerup",event=>{
      if(press?.id!==event.pointerId)return;
      const tapped=!press.cancelled&&onButton(event);
      press=null;
      if(tapped)spend(slot);
    });
    plus.addEventListener("lostpointercapture",event=>{if(press?.id===event.pointerId)press=null;});
    plus.addEventListener("pointercancel",event=>{if(press?.id===event.pointerId)press=null;});
    // Keyboard and assistive technology activate a button with a zero-detail click.
    plus.addEventListener("click",event=>{if(event.detail===0)spend(slot);});
  });
  return {paint,spend};
}
export function basicDamage(hero) {
  return hero.damage * (1+.055*((hero.level||1)-1));
}

function nextItem(hero) {
  const order=builds[hero.hero] || builds[0];
  if (hero.inventory.length<3) {
    const empty=order.find(key=>!hero.gearTiers[key]);
    if (empty) return empty;
  }
  // A manually assembled kit keeps all three pieces. Improve the combat item first.
  return [...order.filter(key=>key!=="boots"),...hero.inventory].find(key=>hero.gearTiers[key]===1);
}
function purchase(match,hero,key) {
  const item=gear[key];
  if (!item || match.result) return false;
  const tier=hero.gearTiers[key]||0;
  if (tier>=2 || (!tier && hero.inventory.length>=3) || hero.gold<item.price[tier]) return false;
  hero.gold-=item.price[tier];
  if (!tier) hero.inventory.push(key);
  hero.gearTiers[key]=tier+1;
  if (key==="boots") hero.speed*=tier?1.25/1.18:1.18;
  if (key==="coat") {
    const hp=tier?105:75; hero.maxHp+=hp;
    if (alive(hero)) hero.hp=Math.min(hero.maxHp,hero.hp+hp);
  }
  if (key==="blade") hero.damage+=tier?16:14;
  if (key==="focus") hero.haste=tier?.24:.16;
  if (key==="standard") hero.siegeBanner=true;
  if (hero.id===match.playerId) {
    match.lastPurchase=match.time;
    match.coinNotice={text:(tier?"进阶 · ":"已装备 ")+item.name,until:match.time+2.25};
    match.events.push({type:"buy",id:++match.eventSeq,source:hero.id,team:hero.team,x:hero.x,z:hero.z,gear:key,price:item.price[tier],ttl:1});
  }
  syncLocal(match,hero);
  match.rosterRevision=(match.rosterRevision||0)+1;
  return true;
}
export function buySupply(match,key) {
  prepareBuild(match);const hero=player(match);
  return !!hero && Object.hasOwn(gear,key) && purchase(match,hero,key);
}
function buyRecommended(match,hero=player(match)) {
  if (!hero || hero.id===match.playerId && !match.autoBuild || hero.kitComplete) return;
  for (;;) {
    const key=nextItem(hero);
    if (!key) {hero.kitComplete=true;return;}
    if (!purchase(match,hero,key)) return;
  }
}

function award(match,hero,coins,xp,reason) {
  hero.gold+=coins; hero.earnedGold+=coins; hero.xp+=xp;
  const before=hero.level;
  while (hero.level<ascent.length && hero.xp>=ascent[hero.level]) hero.level++;
  if (hero.level>before) {
    const rise=hero.level-before;
    hero.maxHp+=40*rise;
    if (alive(hero)) hero.hp=Math.min(hero.maxHp,hero.hp+65*rise);
    if(hero.id!==match.playerId)train(hero);
    else if(match.autoSkillSlot>=0)train(hero,match.autoSkillSlot);
    if (alive(hero)) match.events.push({type:"level",id:++match.eventSeq,source:hero.id,sourceKind:"hero",sourceTeam:hero.team,
      team:hero.team,x:hero.x,z:hero.z,level:hero.level,ttl:.65});
  }
  if (hero.id===match.playerId && reason) match.coinNotice={text:reason+" +"+coins+" 铜钱",until:match.time+1.45};
  buyRecommended(match,hero);
  syncLocal(match,hero);
  match.rosterRevision=(match.rosterRevision||0)+1;
}
export function fieldIncome(match) {
  if (match.time<match.nextIncome) return;
  const teams=prepareBuild(match);
  if (match.time<match.nextIncome) return;
  const ticks=1+Math.floor((match.time-match.nextIncome)/4);
  match.nextIncome+=ticks*4;
  for (const team of teams) for (const hero of team) award(match,hero,ticks,0);
}

export function recordCombat(match,victim,source) {
  if (victim.kind!=="hero" || source?.kind!=="hero" || victim.team===source.team || !teamActor(source)) return;
  (victim.recentAttackers ??= {})[source.id]=match.time;
  source.drewWaveUntil=match.time+1.65;
}
function shareWave(match,team,killer,fallen) {
  const taker=killer.kind==="hero"?killer:null;
  if (taker) {
    taker.lastHits++;
    award(match,taker,10,12,"补刀");
    if (taker.id===match.playerId) match.events.push({type:"lastCoin",id:++match.eventSeq,source:taker.id,team:taker.team,x:fallen.x,z:fallen.z,coins:10,ttl:.92});
  }
  const nearby=team.filter(u=>u!==taker && alive(u) && distance(u,fallen)<=6.5);
  const share=nearby.length>1?.72:1;
  for(const u of nearby) award(match,u,Math.round((taker?3:6)*share),Math.round((taker?6:9)*share),"附近收兵");
}
function takeDown(match,teams,killer,victim) {
  const team=teams[1-victim.team],history=victim.recentAttackers||{};
  victim.recentAttackers={}; victim.deaths++; syncLocal(match,victim);
  let credited=teamActor(killer) && killer.team!==victim.team && killer.kind==="hero"?killer:null;
  const helpers=team.filter(u=>match.time-history[u.id]<=8);
  if (!credited && helpers.length) credited=helpers.reduce((a,b)=>history[a.id]>=history[b.id]?a:b);
  if (!credited && (!teamActor(killer)||killer.team===victim.team)) return;
  match.teamKills[1-victim.team]++;match.kills=match.teamKills[0];
  if (credited) {credited.kills++;award(match,credited,36,60,"击败");}
  for (const helper of helpers) {
    if (helper===credited) continue;
    helper.assists++;award(match,helper,18,32,"助攻");
  }
  match.rosterRevision=(match.rosterRevision||0)+1;
}
export function fieldBounty(match,killer,fallen) {
  const teams=prepareBuild(match);
  if (fallen.kind==="hero") {takeDown(match,teams,killer,fallen);return;}
  if (!teamActor(killer) || fallen.team===killer.team) return;
  const team=teams[killer.team];
  if (fallen.kind==="minion") {shareWave(match,team,killer,fallen);return;}
  if (fallen.kind==="camp") {
    if(fallen.secured===killer.id && !fallen.paid){
      fallen.paid=true;
      award(match,killer,fallen.coins,fallen.xp,fallen.name);
    }
    return;
  }
  if (fallen.kind!=="tower" && !(fallen.kind==="keeper" && fallen.claimedBy===killer.team)) return;
  const tower=fallen.kind==="tower";
  for(const hero of team) {
    const near=hero===killer || alive(hero) && distance(hero,fallen)<=6.5;
    const coins=tower?(hero===killer?28:near?18:8):(near?22:8);
    const xp=tower?(hero===killer?50:near?36:12):(near?38:12);
    award(match,hero,coins,xp,tower?"破塔":"夺取河蟹");
  }
}
export function laneDamage(match,source,target) {
  if (source?.kind!=="minion" || !teamActor(source) || target.kind!=="tower" && target.kind!=="core") return 1;
  let bonus=1;
  for(const hero of prepareBuild(match)[source.team]) {
    if(hero.siegeBanner && alive(hero) && distance(hero,target)<=7.4) bonus=Math.max(bonus,hero.gearTiers.standard===2?1.48:1.32);
  }
  return bonus;
}

export function markLaneUnit(match,point){
  const me=player(match);
  if(!alive(me)||!point)return null;
  let mark=null,radius=1.04;
  for(const unit of match.units){
    if((unit.kind!=="minion"&&unit.kind!=="camp")||unit.team===me.team||!alive(unit)||distance(me,unit)>14||!visibleTo(match,me.team,unit))continue;
    const r=distance(point,unit);if(r<=radius){mark=unit;radius=r;}
  }
  if(mark)match.laneMark={id:mark.id,until:match.time+3};
  return mark;
}
export function markedLaneUnit(match,me){
  const mark=match.laneMark;
  if(!mark||mark.until<match.time||!alive(me))return null;
  const unit=match.units.find(u=>u.id===mark.id&&alive(u)&&distance(me,u)<=14&&visibleTo(match,me.team,u));
  if(!unit)match.laneMark=null;
  return unit||null;
}

function setText(node,value) {
  const text=String(value);
  if (node.textContent!==text) node.textContent=text;
}
function kitName(hero,key) { return gear[key].name+(hero.gearTiers[key]===2?"Ⅱ":""); }

export function fieldScoreboard(getMatch,playing,definitions,releaseInput) {
  const scoreFaceCrop=[[56,35,114,133],[51,32,125,146],[56,49,119,139],[67,68,108,126],[58,27,114,133]];
  const trigger=document.getElementById("score-open"),panel=document.getElementById("field-scoreboard");
  const closeButton=panel.querySelector("[data-score-close]"),sheet=panel.querySelector("[data-teams]");
  let previous=null,revision=-1,rows=[],headings=[];
  const el=(tag,cls)=>{const n=document.createElement(tag);n.className=cls;return n;};
  function paint() {
    if (!panel.open) return;
    const match=getMatch();
    if(!playing() || !match || match.result) {close();return;}
    if (previous===match && revision===match.rosterRevision) return;
    const teams=prepareBuild(match);
    if(previous!==match) {
      sheet.replaceChildren();rows=[];headings=[];
      for(const [side,team] of teams.entries()) {
        const section=el("section","score-team side-"+side),title=el("h3","team-line");
        const name=el("span","team-name"),sum=el("span","team-summary");
        setText(name,side===0?"我方":"敌方");title.append(name,sum);section.append(title);headings.push(sum);
        const list=el("ol","score-list");
        for(const hero of team) {
          const row=el("li","score-row"+(hero.id===match.playerId?" is-me":""));
          const face=el("i","score-face"),legend=el("span","score-identity"),upper=el("b","score-name"),
            rank=el("small","score-rank"),items=el("span","score-items"),figures=el("span","score-numbers"),
            kda=el("b","score-kda"),gold=el("small","score-gold");
          // At 25–30 CSS pixels each hero needs the eyes, brim or blindfold inside the tile.
          const [x,y,w,h]=scoreFaceCrop[hero.hero];
          face.style.backgroundSize=(1120/w*100)+"% "+(560/h*100)+"%";
          face.style.backgroundPosition=((hero.hero*224+x)/(1120-w)*100)+"% "+(y/(560-h)*100)+"%";
          face.setAttribute("aria-hidden","true");
          setText(upper,definitions[hero.hero].name+(hero.id===match.playerId?" · 你":""));
          legend.append(upper,rank);figures.append(kda,gold);row.append(face,legend,items,figures);list.append(row);
          rows.push({hero,rank,items,kda,gold});
        }
        section.append(list);sheet.append(section);
      }
    }
    previous=match;revision=match.rosterRevision;
    for(const [side,team] of teams.entries()) {
      setText(headings[side],match.teamKills[side]+" 击败  ·  "+team.reduce((n,h)=>n+h.earnedGold,0)+" 总经济");
    }
    for(const {hero,rank,items,kda,gold} of rows) {
      setText(rank,"Lv."+hero.level+" · "+hero.lastHits+" 补刀"+(hero.hunts||hero.campsTaken?" · "+(hero.campsTaken||0)+" 野":""));
      setText(items,hero.inventory.map(k=>kitName(hero,k)).join(" · ") || "尚未购装");
      setText(kda,hero.kills+" / "+hero.deaths+" / "+hero.assists);
      setText(gold,hero.earnedGold+" 铜钱");
    }
  }
  function close() { if(panel.open) panel.close(); }
  function toggle() {
    if(panel.open) {close();return;}
    if(!playing()) return;
    releaseInput();panel.showModal();trigger.setAttribute("aria-expanded","true");paint();
    closeButton.focus({preventScroll:true});
  }
  trigger.addEventListener("click",toggle);closeButton.addEventListener("click",close);
  panel.addEventListener("close",()=>trigger.setAttribute("aria-expanded","false"));
  panel.addEventListener("click",event=>{
    if(event.target!==panel)return;
    const box=panel.getBoundingClientRect();
    if(event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) close();
  });
  return {paint,toggle,close,isOpen:()=>panel.open};
}

export function fieldOutfitter(getMatch,playing,dirty,definitions){
  const open=document.getElementById("field-supplies"),panel=document.getElementById("field-stock");
  const caption=document.getElementById("purse-line"),place=document.getElementById("field-counter");
  const results=document.getElementById("field-kit-note"),buy=[...panel.querySelectorAll("[data-gear]")];
  const auto=panel.querySelector("[data-build]"),owned=panel.querySelector("[data-owned]");
  const priorityKey=panel.querySelector("[data-train]"),training=panel.querySelector("[data-ranks]");
  let previous,at=-1;
  function close(){panel.hidden=true;open.setAttribute("aria-expanded","false");}
  function paint(force=false){
    const m=getMatch();
    if(!m||!playing()||m.result){close();return;}
    if(previous===m&&!force&&m.time>=at&&m.time-at<.15)return;
    previous=m;at=m.time;
    prepareBuild(m);
    let line=m.coinNotice?.until>m.time?m.coinNotice.text:m.gold+" 铜钱 · 商店 ›";
    if(caption.textContent!==line)caption.textContent=line;open.classList.toggle("received",m.lastPurchase!=null&&m.time-m.lastPurchase<.62);
    if(panel.hidden)return;
    const hero=player(m),next=nextItem(hero),full=m.inventory.length>=3;
    const state=!next?"三件装备均已进阶":m.autoBuild?"下一件 "+gear[next].name+(hero.gearTiers[next]?"Ⅱ":"")+" · 还差 "+Math.max(0,gear[next].price[hero.gearTiers[next]||0]-m.gold)+" 铜钱":"点选装备购买或进阶，立即生效";
    const stats=m.gold+" 铜钱 · "+(m.lastHits||0)+" 次补刀";
    if(place.textContent!==stats)place.textContent=stats;
    if(results.textContent!==state)results.textContent=state;
    const bag=m.inventory.length?m.inventory.map(k=>kitName(hero,k)).join(" · "):"装备位 0 / 3";
    if(owned.textContent!==bag)owned.textContent=bag;
    auto.setAttribute("aria-pressed",String(m.autoBuild));auto.textContent=m.autoBuild?"自动出装已开":"手动出装";
    for(const b of buy){
      const key=b.dataset.gear,tier=hero.gearTiers[key]||0,item=gear[key];
      b.disabled=tier===2 || !tier&&full || m.gold<item.price[tier];
      setText(b.querySelector("b"),item.name+(tier?"Ⅱ":""));
      setText(b.querySelector("span"),item.detail[tier?1:0]);
      setText(b.querySelector("em"),tier===2?"已进阶":(tier?"进阶 ":"")+item.price[tier]+" 铜钱");
    }
    if(priorityKey.value!==String(m.autoSkillSlot))priorityKey.value=String(m.autoSkillSlot);
    setText(priorityKey.options[1],"自动主升 "+definitions[hero.hero].skills[0]);
    setText(priorityKey.options[2],"自动主升 "+definitions[hero.hero].skills[1]);
    setText(training,slots.map((s,i)=>s+" "+hero.skillRanks[i]).join("　")+" · "+skillPoints(hero)+" 点可用");
  }
  function toggle(){if(!playing())return;if(panel.hidden){panel.hidden=false;open.setAttribute("aria-expanded","true");paint(true);}else close();}
  open.addEventListener("click",toggle);
  panel.querySelector("[data-close]").addEventListener("click",close);
  priorityKey.addEventListener("change",()=>{
    if(!playing())return;
    setPlayerTraining(getMatch(),Number(priorityKey.value));
    paint(true);dirty();
  });
  auto.addEventListener("click",()=>{
    if(!playing())return;const m=getMatch();prepareBuild(m);m.autoBuild=!m.autoBuild;
    try{globalThis.localStorage?.setItem("estuary-auto-shop-v1",m.autoBuild?"on":"off");}catch{}
    if(m.autoBuild)buyRecommended(m);paint(true);dirty();
  });
  for(const b of buy)b.addEventListener("click",()=>{
    if(!playing()||!buySupply(getMatch(),b.dataset.gear)){paint(true);return;}
    paint(true);close();dirty();
  });
  return {paint,toggle,close,isOpen:()=>!panel.hidden};
}
