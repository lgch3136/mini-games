import {openedExit} from "./exit-bearing.mjs";
// First-room handoff, render-only. No enemies or extra locations exposed.
export function relayMapGoal(world) {
  if(world.map.id!=="foundry"||world.zone!==0)return null;
  const relay=world.props[0],opened=openedExit(world);
  if(opened)return opened;
  if(world.objectives.some(n=>n.kind==="isolator"&&n.zone===0&&!n.done))return {kind:"fork"};
  return {kind:world.remaining===0?"connect":"locked",x:relay.x,z:relay.z};
}
export function mapNorthBounds(goal) {
  // Original fork scale, then the whole room through the actual exit.
  return goal.kind==="fork"?{front:5,back:-37}:{front:5,back:-51};
}
