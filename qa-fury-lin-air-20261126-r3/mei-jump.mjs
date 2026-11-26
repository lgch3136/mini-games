// Render sampling uses only confirmed jumps; it never changes player input or physics.
const active = new WeakMap();
const contact = (events, f, type) => events.some(e => e.type === type && e.side === f.side);

export function sampleMeiJump(fight, sheetReady) {
  for (const f of fight.f) {
    if (f.c.id !== 'mei') continue;
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
export function meiJumpPhase(f){return active.get(f)?.phase??null;}

export const meiJumpAtlas = {"mei":{"file":"mei-jump.webp","width":648,"height":544,"cells":{"jump/takeoff":[3,3,138,251,-41.85,-126.45,138,251],"jump/rise":[219,3,125,253,-33.75,-122.67,125,253],"jump/apex":[435,3,121,186,-34.02,-114.84,121,186],"jump/descent":[3,275,172,234,-48.6,-121.32,172,234],"land/absorb":[219,275,166,219,-48.06,-109.5,166,219]}}};
