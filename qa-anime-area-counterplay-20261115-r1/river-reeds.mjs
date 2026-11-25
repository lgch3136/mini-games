// Each bed is walkable. The visible plants and the sight rule use the same ellipse.
import {rushes} from "./estuary-map.mjs?v=river-marching6";
export const reedBeds=rushes;
export function patchAt(x,z) {
  for(let i=0;i<reedBeds.length;i++){
    const b=reedBeds[i],dx=(x-b.x)/b.rx,dz=(z-b.z)/b.rz;
    if(dx*dx+dz*dz<=1)return i;
  }
  return -1;
}
export function updateVisibility(match) {
  for(const hero of match.units){
    if(hero.kind!=="hero")continue;
    hero.reedBed=hero.dead?-1:patchAt(hero.x,hero.z);hero.reedScreened=false;
    if(hero.reedBed<0)continue;
    hero.reedScreened=!match.units.some(enemy=>{
      if(enemy.team===hero.team||enemy.dead||enemy.hp<=0)return false;
      const dx=hero.x-enemy.x,dz=hero.z-enemy.z;
      if(dx*dx+dz*dz<=2.05*2.05)return true;
      return enemy.kind==="hero"&&patchAt(enemy.x,enemy.z)===hero.reedBed;
    });
  }
}
export function visibleTo(match,team,unit) {
  return !unit||unit.team===team||!unit.reedScreened||match.time<(unit.reedExposedUntil||0);
}
export function openReeds(match,unit,seconds) {
  if(unit.kind==="hero")unit.reedExposedUntil=Math.max(unit.reedExposedUntil||0,match.time+seconds);
}
export function reedCaption(match,player) {
  if(player.dead||!(player.reedBed>=0))return "";
  if(match.time<(player.reedExposedUntil||0))return "芦丛 · 已现身";
  return player.reedScreened?"芦丛 · 已藏身":"芦丛 · 敌在近处";
}

export function addReeds(triangle) {
  const palette=["#627858","#6e8861","#899861","#a3a675","#b6ad78"];
  for(const [index,b] of reedBeds.entries()){
    let random=719+index*977;
    function rand(){random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;}
    for(let i=0;i<28;i++){
      const a=i*2.399+index*.4,r=Math.sqrt((i+.35)/28);
      const x=b.x+Math.cos(a)*b.rx*r,z=b.z+Math.sin(a)*b.rz*r;
      for(let j=0;j<5;j++){
        const phi=rand()*Math.PI*2,co=Math.cos(phi),si=Math.sin(phi),width=.038+rand()*.035;
        const lean=.14+rand()*.29,h=.36+rand()*.56;
        const cx=x+co*.09,cz=z+si*.09;
        const left=[cx-si*width,.073,cz+co*width],right=[cx+si*width,.073,cz-co*width];
        const mid=[cx+co*lean*.45,h*.7,cz+si*lean*.45],tip=[cx+co*lean,h,cz+si*lean];
        const mL=[mid[0]-si*width*.63,mid[1],mid[2]+co*width*.63];
        const mR=[mid[0]+si*width*.63,mid[1],mid[2]-co*width*.63];
        triangle(left,right,mR,palette[(i+j)%3]);triangle(left,mR,mL,palette[(i+j)%3]);
        triangle(mL,mR,tip,palette[2+(i+j)%3]);
        if(j===0&&i%3===0){
          const c=[tip[0]+.04,h+.09,tip[2]];
          triangle([tip[0]-.04,h-.025,tip[2]],[tip[0]+.046,h-.01,tip[2]],c,"#c8ac75");
        }
      }
    }
  }
}
