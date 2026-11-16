'use strict';
// Presentation only. Never receives game objects, reads input or consumes RNG.
// One 900x2700 image (~9.27 MiB RGBA), one lazy 900x256 sea cache (~0.88 MiB).
(function(host) {
  const map = new Image();
  map.src = 'assets/coast-world-r1.webp?v=20261103-r1';
  let origin = null, age = 0, previous = -1, sea = null, checkpoint = null;
  const ready = () => map.complete && map.naturalWidth > 0 && map.naturalHeight >= 640;
  function reset() {origin = null;age = 0;previous = -1;checkpoint = null;}
  function capture() {checkpoint = {origin,age,previous};}
  function restore() {if(checkpoint) ({origin,age,previous}=checkpoint);else reset();}
  function update(time, eligible) {
    if (time < previous) reset();
    previous = time;
    if (origin === null && eligible) origin = time;
    age = origin === null ? 0 : Math.max(0, time - origin);
  }
  function prepareSea() {
    if (sea) return;
    sea = document.createElement('canvas'); sea.width = 900;sea.height = 256;
    const c = sea.getContext('2d');
    // The runtime strip's top 64px has an alpha ramp; use opaque original
    // sea at rows64..128. Mirror both joins for a continuous 128px period.
    c.drawImage(map, 0,64,map.naturalWidth,64, 0,0,900,128);
    c.save();c.translate(0,256);c.scale(1,-1);
    c.drawImage(map, 0,64,map.naturalWidth,64, 0,0,900,128);c.restore();
  }
  function draw(ctx,w,h,reduced) {
    if (origin === null || !ready()) return false;
    prepareSea();
    // Reduced motion is genuinely static within each geographical phase.
    const t = reduced ? (age < 10 ? 0 : age < 22 ? 16 : 34) : age;
    const seaOffset = (t * 8) % 256;
    // Scale sea period to a full viewport: only two draws, even very tall screens.
    ctx.save();
    if (seaOffset > 0) ctx.drawImage(sea,0,256-seaOffset,900,seaOffset,0,0,w,h*seaOffset/256);
    ctx.drawImage(sea,0,0,900,256-seaOffset,0,h*seaOffset/256,w,h*(256-seaOffset)/256);
    // A 640-source-pixel camera preserves the original airport's ground speed.
    // Draw only the visible source interval; no reads beyond naturalHeight.
    const top = map.naturalHeight - 640 - t * 80;
    const sy = Math.max(0,top), end = Math.min(map.naturalHeight,top+640);
    if (end > sy) ctx.drawImage(map,0,sy,map.naturalWidth,end-sy,
      0,(sy-top)*h/640,w,(end-sy)*h/640);
    ctx.restore();
    return true;
  }
  host.ThunderCoastScene = Object.freeze({reset,capture,restore,update,draw,visible:()=>origin !== null && ready(),
    inspect:()=>({origin,age,previous,ready:ready(),cache:sea?{width:sea.width,height:sea.height}:null})});
})(globalThis);
