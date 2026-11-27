// Same target for the map and orientation hint; no engine state changes.
export function openedExit(world) {
  const zone=world.zone;
  if(world.map.id!=="foundry"||zone>=world.zones.length-1||!world.relays[zone])return null;
  const gate=world.gatePlans[zone];
  // Match the center plane of the world's gatewall and gate blocker.
  return {kind:"gate",x:gate.x,z:-zone*52-49,half:gate.half};
}
export function foundryBearing(world,stockBearing) {
  const gate=openedExit(world);
  if(!gate)return stockBearing(world,true);
  return {...stockBearing({p:world.p,props:[gate],zone:0}),label:"青色闸门",otherSide:""};
}
