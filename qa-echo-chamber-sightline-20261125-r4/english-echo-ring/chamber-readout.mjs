const ledgers=new WeakMap;
export const RECALL_NOTICE=.85;
export const FOLLOWUP_WINDOW=1.2;
export function liveChamber(g){
 const a=g.bullets[0],b=g.bullets[1];
 return (a&&!a.dead?1:0)+(b&&!b.dead?1:0);
}
export function stepChamber(g,dt,input){
 let memo=ledgers.get(g);
 if(!memo){memo={noticeUntil:-1,link:null,total:0,last:null};ledgers.set(g,memo);}
 const before=liveChamber(g);
 const eventStart=g.events.length,first=g.bullets[0]?.id,second=g.bullets[1]?.id;
 const link=memo.link;
 const survivorWasLive=before===1&&link&&g.bullets.some(b=>b.id===link.survivor&&!b.dead);
 g.step(dt,input);
 let fire=false,caught=false;
 for(let i=eventStart;i<g.events.length;i++){
  const type=g.events[i].type;
  fire ||= type==="shot";
  caught ||= type==="catch";
 }
 if(link){
  if(survivorWasLive&&g.time-link.at<=FOLLOWUP_WINDOW+1e-9&&fire){
   memo.total++;
   memo.last={at:g.time,delay:g.time-link.at};
  }
  if(fire||g.time-link.at>FOLLOWUP_WINDOW+1e-9||!g.bullets.some(b=>b.id===link.survivor&&!b.dead))memo.link=null;
 }
 if(caught){
  memo.noticeUntil=g.time+RECALL_NOTICE;
  const eligible=before===2&&!fire&&liveChamber(g)===1;
  const survivor=g.bullets.find(b=>!b.dead);
  // If deaths or another cause removed the other bullet too, do not claim a causal follow-up.
  if(eligible&&survivor&&(survivor.id===first||survivor.id===second)){
   memo.link={at:g.time,survivor:survivor.id};
  }
 }
}
export function interruptChamber(g){
 const memo=ledgers.get(g);
 if(memo){memo.link=null;memo.noticeUntil=-1;}
}
export function chamberRecap(g){
 const memo=ledgers.get(g);
 if(!memo?.total)return "";
 return `满仓回收后补射 ${memo.total} 次 · 最近一次 ${memo.last.delay.toFixed(2)} 秒（${Math.floor(memo.last.at/60)}:${String(Math.floor(memo.last.at%60)).padStart(2,"0")}）`;
}
export function chamberVisual(g){
 return {occupied:liveChamber(g),cooling:g.p.shootCooldown>0,notice:g.time<(ledgers.get(g)?.noticeUntil??-1)};
}
export function drawChamberReadout(ctx,g,x,y){
 const angle=g.aimLocked?g.p.aim:Math.hypot(x,y)>12?Math.atan2(-y,-x):g.p.aim;
 const {occupied,cooling,notice}=chamberVisual(g);
 ctx.save();
 ctx.translate(x,y);ctx.rotate(angle);
 ctx.lineWidth=1.05;ctx.lineJoin="round";
 for(let i=0;i<2;i++){
  const v=i===0?-5:5;
  if(i<occupied){
   ctx.fillStyle="#93a9bc";ctx.fillRect(-25,v-2,5,4);
  }else if(cooling){
   ctx.strokeStyle="#e4bc77";ctx.beginPath();
   ctx.moveTo(-20,v-2);ctx.lineTo(-25,v-2);ctx.lineTo(-25,v+2);ctx.lineTo(-22,v+2);ctx.stroke();
  }else{
   ctx.strokeStyle="#b2f3e1";ctx.strokeRect(-25,v-2,5,4);
  }
 }
 ctx.restore();
 if(notice){
  ctx.save();
  const tx=x-Math.cos(angle)*32,ty=y-Math.sin(angle)*32;
  ctx.font="bold 10px system-ui,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.strokeStyle="#0c1a21";ctx.lineWidth=2;ctx.strokeText("+1",tx,ty);
  ctx.fillStyle="#b2f3e1";ctx.fillText("+1",tx,ty);ctx.restore();
 }
}
