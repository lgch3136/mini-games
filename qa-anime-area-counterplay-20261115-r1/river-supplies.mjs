import {visibleTo} from "./river-reeds.mjs?v=team-vision1";
const gear={
  boots:{name:"渡风履",price:20},coat:{name:"守楼甲",price:20},
  blade:{name:"听潮刃",price:55},focus:{name:"流光佩",price:58},standard:{name:"先登旗",price:76}
};
const builds=[["boots","blade","standard"],["boots","focus","standard"],["focus","boots","coat"],["focus","blade","boots"],["coat","blade","standard"]];
const alive=u=>u&&!u.dead&&u.hp>0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const player=m=>m.units.find(u=>u.id===m.playerId);

export function fieldBounty(match,killer,fallen){
  const me=player(match);
  if(!me||!killer||killer.team!==me.team||fallen.team===me.team)return 0;
  const personal=killer.id===me.id, nearby=alive(me)&&distance(me,fallen)<=6.5;
  let coins=0,xp=0;
  if(fallen.kind==="minion"){
    coins=personal?10:nearby?3:0;xp=personal?12:nearby?6:0;
    if(personal){
      match.lastHits=(match.lastHits||0)+1;
      match.events.push({id:++match.eventSeq,type:"lastCoin",x:fallen.x,z:fallen.z,source:me.id,coins,ttl:.92});
    }
  }else if(fallen.kind==="hero"){
    coins=personal?36:nearby?14:0;xp=personal?60:nearby?30:0;
    if(personal)match.soloKills=(match.soloKills||0)+1;
  }else if(fallen.kind==="tower"){
    coins=personal?28:nearby?18:8;xp=personal?50:nearby?36:12;
  }
  if(coins){
    match.gold+=coins;
    const verb=fallen.kind==="minion"?(personal?"补刀":"附近收兵"):fallen.kind==="tower"?"破楼":personal?"击败":"助阵";
    match.coinNotice={text:verb+" +"+coins+" 铜钱",until:match.time+1.6};
    buyRecommended(match);
  }
  return xp;
}

export function prepareBuild(match){
  if(match.inventory)return;
  match.inventory=match.equipment?[match.equipment]:[];
  let auto=true;try{auto=globalThis.localStorage?.getItem("estuary-auto-shop-v1")!=="off";}catch{}
  match.autoBuild=auto;
}
export function buySupply(match,key){
  prepareBuild(match);
  const me=player(match);
  if(!me||!Object.hasOwn(gear,key)||match.result||match.inventory.length>=3||match.inventory.includes(key)||match.gold<gear[key].price)return false;
  match.gold-=gear[key].price;match.inventory.push(key);match.equipment=key;
  if(key==="boots")me.speed*=1.18;
  if(key==="coat"){me.maxHp+=75;if(alive(me))me.hp=Math.min(me.maxHp,me.hp+75);}
  if(key==="blade")me.damage+=14;
  if(key==="focus")me.haste=.16;
  if(key==="standard")me.siegeBanner=true;
  match.lastPurchase=match.time;match.coinNotice={text:"已装备"+gear[key].name,until:match.time+2.6};
  match.events.push({type:"buy",id:++match.eventSeq,source:me.id,x:me.x,z:me.z,gear:key,price:gear[key].price,ttl:1.0});
  return true;
}
function nextItem(m){const me=player(m);return (builds[me?.hero]||builds[0]).find(key=>!m.inventory.includes(key));}
function buyRecommended(m){prepareBuild(m);if(m.autoBuild&&m.inventory.length<3){const key=nextItem(m);if(key)buySupply(m,key);}}
export function laneDamage(match,source,target){
  if(!source||target.kind!=="tower"&&target.kind!=="core")return 1;
  const playerUnit=player(match);
  if(!playerUnit?.siegeBanner||!alive(playerUnit)||source.team!==playerUnit.team||distance(playerUnit,target)>7.4)return 1;
  if(source.kind==="minion")return 1.32;
  return 1;
}

export function markLaneUnit(match,point){
  const me=player(match);
  if(!alive(me)||!point)return null;
  let mark=null,radius=1.04;
  for(const unit of match.units){
    if(unit.kind!=="minion"||unit.team===me.team||!alive(unit)||distance(me,unit)>14||!visibleTo(match,me.team,unit))continue;
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

export function fieldOutfitter(getMatch,playing,dirty){
  const open=document.getElementById("field-supplies"),panel=document.getElementById("field-stock");
  const caption=document.getElementById("purse-line"),place=document.getElementById("field-counter");
  const results=document.getElementById("field-kit-note"),buy=[...panel.querySelectorAll("[data-gear]")];
  const auto=panel.querySelector("[data-build]"),owned=panel.querySelector("[data-owned]");
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
    const next=nextItem(m),full=m.inventory.length>=3;
    const state=full?"三个装备位已满":m.autoBuild&&next?"下一件 "+gear[next].name+" · "+Math.max(0,gear[next].price-m.gold)+" 铜钱后自动购买":"点选可购买的装备，立即生效";
    const stats=m.gold+" 铜钱 · "+(m.lastHits||0)+" 次补刀";
    if(place.textContent!==stats)place.textContent=stats;
    if(results.textContent!==state)results.textContent=state;
    const bag=m.inventory.length?m.inventory.map(k=>gear[k]?.name).filter(Boolean).join(" · "):"装备位 0 / 3";
    if(owned.textContent!==bag)owned.textContent=bag;
    auto.setAttribute("aria-pressed",String(m.autoBuild));auto.textContent=m.autoBuild?"自动出装已开":"手动出装";
    for(const b of buy){
      const key=b.dataset.gear,has=m.inventory.includes(key);
      b.disabled=has||full||m.gold<gear[key].price;b.setAttribute("aria-pressed",String(has));
    }
  }
  function toggle(){if(!playing())return;if(panel.hidden){panel.hidden=false;open.setAttribute("aria-expanded","true");paint(true);}else close();}
  open.addEventListener("click",toggle);
  panel.querySelector("[data-close]").addEventListener("click",close);
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
