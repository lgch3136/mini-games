// Labels mark the projected footing, not whatever sprite happens to draw on top.
const on = unit => unit && !unit.dead && unit.hp > 0;
const building = unit => unit.kind === "tower" || unit.kind === "core";
const overlaps = (a,b) => a.left < b.right+3 && a.right > b.left-3 && a.top < b.bottom+3 && a.bottom > b.top-3;
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
export function readTarget(match,player,visible,reach){
  if(!on(player))return null;
  const eligible = u => on(u) && u.team !== player.team && !u.sceneryOnly && visible(u);
  const candidates = [match.groundOrder?.id,match.touchTargetId,match.laneMark?.until>=match.time?match.laneMark.id:null];
  const locked = candidates.map(id=>id==null?null:match.units.find(u=>u.id===id&&eligible(u))).find(Boolean);
  const active = player.action?.kind === "attack" && player.action.target!=null
    ? match.units.find(u=>u.id===player.action.target&&eligible(u)) : null;
  if(active)return {unit:active,kind:active===locked?"lock":"strike"};
  if(locked)return {unit:locked,kind:reach(player,locked)?"lock":"pursuit"};
  // A skill windup has its own marks. Do not advertise an unrelated automatic attack.
  if(player.action)return null;
  const next = match.playerBasicTargetId==null ? null : match.units.find(u=>u.id===match.playerBasicTargetId&&eligible(u)&&reach(player,u));
  return next ? {unit:next,kind:"preview"} : null;
}
export function attackCaption(towerFirst,explicit){
  if(explicit)return ["已锁目标",towerFirst?"推塔优先；J 先打射程内已锁目标，L 专打塔／核心。":"J 先打射程内已锁目标；未锁定时优先英雄／补刀。"];
  return towerFirst?["优先塔／核心","J 优先攻击射程内可拆的塔／核心，无塔时会攻击其他目标；L 只打塔／核心。"]:
    ["英雄／补刀","J 优先英雄和可补小兵；F 切换推塔优先。"];
}
export function placePin(point,role,width,height,blocks,prefer=role==="self"?-1:1){
  const w=role==="self"?26:60,h=20;
  let best=null;
  for(const sign of [prefer,-prefer])for(const offset of [18,38,62,88])for(const dy of [8,30,-19,53,-43,76]){
    const left=clamp(point.x+sign*offset-(sign<0?w:0),4,width-w-4);
    const top=clamp(point.y+dy-h*.5,4,height-h-4);
    const p={left,top,right:left+w,bottom:top+h};
    if(blocks.some(b=>overlaps(p,b)))continue;
    const cost=Math.hypot((sign<0?p.right:p.left)-point.x,top+h*.5-point.y)+(sign===prefer?0:9);
    if(!best||cost<best.cost)best={...p,cost,x:sign<0?p.right:p.left,y:top+h*.5};
  }
  return best;
}
const texts={lock:"已锁",pursuit:"追击",strike:"正攻",preview:"可攻"};
export function bridgePins(T,overlay,ground){
  const v=new T.Vector3;
  const pins=[...overlay.querySelectorAll("[data-bridge-pin]")].map(node=>({node,tag:node.querySelector("b"),line:node.querySelector("i"),foot:node.querySelector("em")}));
  const clear=()=>{if(!overlay.hidden)overlay.hidden=true;};
  function projection(unit,camera,w,h){
    const r=building(unit)?Math.min(.7,unit.radius*.45):0;
    v.set(unit.x,ground(unit.x,unit.z)+.05,unit.z+r).project(camera);
    if(v.z < -1 || v.z > 1 || Math.abs(v.x)>.99||Math.abs(v.y)>.99)return null;
    return {x:(v.x*.5+.5)*w,y:(.5-v.y*.5)*h};
  }
  function draw(player,selection,camera,w,h,bars,visible){
    if(!on(player)){clear();return;}
    const source=projection(player,camera,w,h);
    const target=selection&&visible(selection.unit)?projection(selection.unit,camera,w,h):null;
    if(!source&&!target){clear();return;}
    overlay.hidden=false;
    const blocks=[...bars];
    const pair=[[source,player,"self"],[target,selection?.unit,selection?.kind]];
    for(let i=0;i<2;i++){
      const {node,tag,line,foot}=pins[i],[anchor,unit,kind]=pair[i];
      node.hidden=!anchor;if(!anchor)continue;
      node.dataset.state=kind;
      const p=placePin(anchor,i?"target":"self",w,h,blocks,i?1:-1);
      const overlap=source&&target&&Math.hypot(source.x-target.x,source.y-target.y)<12;
      const markX=anchor.x+(overlap?(i?5:-5):0);
      tag.hidden=line.hidden=!p;
      foot.style.transform=`translate(${markX}px,${anchor.y}px)`;
      if(!p)continue;
      blocks.push(p);
      const caption=i?texts[kind]+(building(unit)?(unit.kind==="core"?"核心":"塔"):"目标"):"你";
      if(tag.textContent!==caption)tag.textContent=caption;
      tag.style.transform=`translate(${p.left}px,${p.top}px)`;
      const x=p.x-markX,y=p.y-anchor.y;
      line.style.transform=`translate(${markX}px,${anchor.y}px) rotate(${Math.atan2(y,x)}rad)`;
      line.style.width=Math.hypot(x,y)+"px";
    }
  }
  return {draw,clear};
}
