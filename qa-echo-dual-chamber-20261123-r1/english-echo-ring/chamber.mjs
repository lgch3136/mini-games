import { Game } from "../../qa-echo-single-catch-20261117-r1/english-echo-ring/sim.mjs?v=20261116-dash-catch-r1";
export const chamberLimit=2;
export function chamberSlots(game) {
  return Math.max(0,chamberLimit-game.bullets.reduce((total,shot)=>total+Number(!shot.dead),0));
}
export class ChamberGame extends Game {
  shoot() {
    if (chamberSlots(this)>0) return super.shoot();
  }
}
const data=new Map();
export const previewMemory=Object.freeze({getItem(key){return data.get(key)??null},setItem(key,value){data.set(key,String(value))}});
