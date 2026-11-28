"use strict";
// Model for the center pellet at spread level 1. It only asks: if fired
// vertically at current altitude, where would it meet this straight missile?
const InterceptSlot = Object.freeze({
  choose(live, pilot, limits, warning) {
    for (const missile of live) {
      if (missile.y >= pilot.y-25) continue;
      const slot = this.project(missile,pilot,limits);
      if (slot) return slot;
    }
    const upcoming=warning?.();
    return upcoming?this.project(upcoming,pilot,limits):null;
  },
  project(missile, pilot, limits) {
    const {x, y, vx, vy, startIn = 0} = missile;
    const {width, top, bottom, halfWidth = 11, horizon = 1.5} = limits;
    const firingDelay=Math.max(0,pilot.fireTimer||0);
    if (![x,y,vx,vy,startIn,pilot.y,width,top,bottom,firingDelay].every(Number.isFinite) ||
        startIn < 0 || vy <= 0 || pilot.weapon !== "spread" || pilot.weaponLevel !== 1 ||
        pilot.berserk > 0 || width < 320) return null;
    const muzzle = pilot.y - 22;
    const shotSpeed = 590;
    const meet = (muzzle-y + shotSpeed*firingDelay + vy*startIn)/(vy+shotSpeed);
    if (meet < Math.max(firingDelay,startIn) + .025 || meet > horizon) return null;
    const px = x+vx*(meet-startIn), py = y+vy*(meet-startIn);
    if (px < 30+halfWidth || px > width-30-halfWidth || py < top || py > bottom) return null;
    const READY = Math.abs(pilot.x-px) <= halfWidth;
    return {x:px,y:py,t:meet,ready:READY,halfWidth};
  }
});
