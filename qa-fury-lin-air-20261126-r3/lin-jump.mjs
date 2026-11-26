// Render sampling uses only confirmed jumps; it never changes player input or physics.
const active = new WeakMap();
const contact = (events, f, type) => events.some(e => e.type === type && e.side === f.side);

export function sampleLinJump(fight, sheetReady) {
  for (const f of fight.f) {
    if (f.c.id !== 'lin') continue;
    const launched=contact(fight.events,f,'jump');
    const canShow = fight.state === 'fight' && f.hp > 0 && !f.action && !f.stun &&
      !f.freeze && !f.down && !f.crouch && (!f.blocking || launched) && !f.held.has('guard') &&
      !['roll','backstep','hurt','ko'].includes(f.state);
    if (!canShow) {active.delete(f);continue;}
    let s=active.get(f);
    if(s?.round!==fight.round){active.delete(f);s=null;}
    if(launched){
      // Decide art selection once per jump. A late decode only affects the next one.
      s={start:fight.frame,round:fight.round,ready:sheetReady===true,phase:null};
      active.set(f,s);
    }
    if(!s?.ready)continue;
    if(f.y>0 && f.state==='jump'){
      const age=fight.frame-s.start;
      s.phase=age<5 && f.vy>.07 ? 'jump/takeoff' :
        f.vy>.07 ? 'jump/rise' : f.vy<-.07 ? 'jump/descent' : 'jump/apex';
    } else if(f.y===0 && f.land===2 && contact(fight.events,f,'land')){
      s.phase='land/absorb';
      s.touch=fight.frame;
    } else if(s.touch!=null && fight.frame-s.touch===1 && f.y===0 && f.land===1){
      s.phase='land/absorb';
    } else active.delete(f);
  }
}
export function linJumpPhase(f){return active.get(f)?.phase??null;}

export const linJumpAtlas = {"lin":{"file":"lin-jump.webp","width":768,"height":576,"cells":{"jump/gather":[48,92,164,178,-40,-89,164,178],"jump/takeoff":[322,18,136,252,-31,-126,136,252],"jump/rise":[576,24,128,244,-32,-123,128,244],"jump/apex":[78,340,116,176,-25,-109,116,176],"jump/descent":[324,334,142,224,-30,-112,142,224],"land/absorb":[566,358,164,200,-37,-100,164,200]}}};
