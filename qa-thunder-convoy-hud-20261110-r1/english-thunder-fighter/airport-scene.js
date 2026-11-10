'use strict';

// Decorative only. Ready path samples one baked image; guarded r1 cache is failure-only.
// No world, input, RNG,
// collision, reward, audio or storage state is read or written here.
// u increases toward the top of the strip. The host keeps its original
// y = H * (.5 + (time - u) / 8) projection and 24-second passage clock.
(function (host) {
  const WIDTH = 900, HEIGHT = 3200, UNIT = 80;
  const buildings = [
    [.035, -2, .21, 3, 0], [.77, 1, .19, 4, 1],
    [.045, 4, .18, 3, 2], [.75, 6, .22, 2, 3],
    [.03, 15, .20, 2, 1], [.79, 15, .17, 2, 2],
  ];
  let cache = null, view = null, scheduled = false;
  const world = new Image();
  let roofs = null, ground = null, mapFailed = false, fallbackStarted = false;
  const ready = image => !!(image && image.complete && image.naturalWidth > 0);
  const makeCanvas = (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height; return canvas;
  };
  const py = u => (32 - u) * UNIT;
  function build() {
    scheduled = false;
    if (ready(world)) return;
    if (!cache) cache = Array.from({length:5}, () => makeCanvas(WIDTH, 640));
    // Mirrored 2x2 material cells meet with identical edge samples. This is
    // explicit runtime tiling, not a claim that generated borders are exact.
    const tile = makeCanvas(256, 256), tc = tile.getContext('2d');
    tc.fillStyle = '#1c2a32'; tc.fillRect(0, 0, 256, 256);
    if (ready(ground)) {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        tc.save(); tc.translate(col ? 256 : 0, row ? 256 : 0);
        tc.scale(col ? -1 : 1, row ? -1 : 1);
        tc.globalAlpha = .24; tc.drawImage(ground, 0, 0, 128, 128); tc.restore();
      }
    } else {
      // Bounded, deterministic material fallback. Never consume game RNG.
      for (let i = 0; i < 512; i++) {
        const n = Math.imul(i + 17, 2654435761) >>> 0;
        tc.fillStyle = i % 2 ? '#24333a' : '#17262d';
        tc.fillRect(n % 256, (n >>> 8) % 256, 2, 1);
      }
    }
    for (let tileIndex = 0; tileIndex < 5; tileIndex++) {
    const c = cache[tileIndex].getContext('2d');
    c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,WIDTH,640);
    c.translate(0,-tileIndex*640);
    c.fillStyle = '#15242b'; c.fillRect(0,0,WIDTH,HEIGHT);
    const material = c.createPattern(tile, 'repeat');
    if (material) { c.fillStyle = material; c.fillRect(0, 0, WIDTH, HEIGHT); }
    const rect = (x, u, w, depth, color) => {
      c.fillStyle = color; c.fillRect(x * WIDTH, py(u + depth / 2), w * WIDTH, depth * UNIT);
    };
    const path = points => { c.beginPath(); for (const [x,u] of points) c.lineTo(x * WIDTH, py(u)); c.closePath(); };
    // Existing road/junction/apron topology and world anchors are unchanged.
    const road = [[.32,-8],[.32,14],[.13,18],[.13,32],[.87,32],[.87,18],[.68,14],[.68,-8]];
    path(road); c.fillStyle = '#182730'; c.fill();
    c.save(); path(road); c.clip();
    if (material) { c.globalAlpha = .32; c.fillStyle = material; c.fillRect(0,0,WIDTH,HEIGHT); }
    c.restore();
    rect(0, 11, 1, 2.7, '#293a41');
    // Low retaining walls and drainage strips give the service sides depth.
    for (const x of [.306,.688]) {
      rect(x, 2.7, .006, 22.6, '#0b161e');
      rect(x + .006, 2.7, .007, 22.6, '#415154');
      rect(x + .013, 2.7, .004, 22.6, '#26383f');
    }
    for (const x of [.335,.655]) rect(x,3,.006,21,'#4a5859');
    for (const u of [-5,-2,1,4,7,14]) rect(.495,u,.009,.75,'#3f4c50');
    for (const u of [9.55,12.45]) {
      rect(0,u,.32,.11,'#566060'); rect(.68,u,.32,.11,'#566060');
      for (const x of [.26,.71]) for(let n=0;n<5;n++) rect(x+n*.006,u,.003,.35,'#776f51');
    }
    // Side service pipe galleries use the same light direction as the art.
    // Never cross the central answer/firing lane.
    for (const x of [.263,.722]) {
      rect(x,3,.014,11.8,'#0b1820'); rect(x-.003,3,.009,11.8,'#526363');
      rect(x-.002,3,.003,11.8,'#6b7770');
      for (const u of [-2,0,2,4,6,8]) rect(x-.006,u,.022,.10,'#26383e');
    }
    // Service-side floor panel joints and sunken equipment pads, no bright dots.
    for (const u of [-6,-3,0,3,6,9,14,17,20,23,26,29]) {
      rect(0,u,.29,.025,'#101f27'); rect(.73,u,.27,.025,'#101f27');
    }
    for (const [x,u,w,depth,kind] of buildings) {
      const bw = w * WIDTH, bh = Math.min(depth * UNIT, bw * 1.12), bx = x * WIDTH, by = py(u) - bh / 2;
      // Atlas alpha and its own low-right shadow meet the textured ground;
      // no full rectangular backing under tank/L-shaped silhouettes.
      if (ready(roofs)) {
        const sw = roofs.naturalWidth / 2, sh = roofs.naturalHeight / 2;
        c.save(); c.filter = 'brightness(.72) saturate(.70)';
        c.drawImage(roofs, (kind % 2) * sw, Math.floor(kind / 2) * sh, sw, sh, bx, by, bw, bh);
        c.restore();
      } else {
        c.fillStyle = '#3c5059'; c.fillRect(bx, by, bw, bh);
        c.fillStyle = '#263a44'; c.fillRect(bx + 5, by + 7, bw - 12, bh - 15);
        for (let n=0;n<4;n++) { c.fillStyle = '#56676a'; c.fillRect(bx + 12 + n * bw / 5, by + 12, 3, bh - 28); }
        c.fillStyle = '#152a33'; c.fillRect(bx + bw * .3, by + bh * .28, bw * .4, bh * .3);
        c.strokeStyle = '#627273'; c.lineWidth = 2; c.strokeRect(bx + bw * .3, by + bh * .28, bw * .4, bh * .3);
      }
    }
    // Three distinct service landmarks, compiled into the same static strip.
    // All fixtures stay on the original apron sides; the central route is quiet.
    const serviceBay = (x, u, kind) => {
      c.save(); c.translate((x+.07)*WIDTH, py(u));
      const slab = (ox, oy, w, h, color, depth=5) => {
        c.fillStyle='rgba(3,12,18,.48)'; c.fillRect(ox+7,oy+10,w+3,h+3);
        c.fillStyle='#101e27';c.fillRect(ox,oy+depth,w,h);
        const g=c.createLinearGradient(ox,oy,ox+w,oy+h);
        g.addColorStop(0,color);g.addColorStop(1,'#253943');
        c.fillStyle=g;c.fillRect(ox,oy,w,h);
        c.strokeStyle='#647573';c.lineWidth=1;c.beginPath();c.moveTo(ox,oy+h);c.lineTo(ox,oy);c.lineTo(ox+w,oy);c.stroke();
        if(material){c.save();c.globalAlpha=.22;c.fillStyle=material;c.fillRect(ox+2,oy+2,w-4,h-4);c.restore();}
      };
      const bolt=(x,y)=>{c.fillStyle='#17272d';c.fillRect(x-2,y-1,4,4);c.fillStyle='#75807a';c.fillRect(x-1,y-1,2,1);};
      // Different structural footprints meet the textured apron directly.
      // No six repeated full rectangular backplates behind these silhouettes.
      if(kind===0){
        const oct=()=>{c.beginPath();for(const [xx,yy]of [[-42,-61],[42,-61],[54,-48],[54,48],[42,61],[-42,61],[-54,48],[-54,-48]])c.lineTo(xx,yy);c.closePath();};
        c.save();c.translate(7,10);oct();c.fillStyle='rgba(3,12,18,.48)';c.fill();c.restore();
        c.save();c.translate(0,4);oct();c.fillStyle='#152b34';c.fill();c.restore();
        oct();c.fillStyle='#40555b';c.fill();c.strokeStyle='#5d706f';c.lineWidth=1;c.stroke();
        c.save();oct();c.clip();if(material){c.globalAlpha=.32;c.fillStyle=material;c.fillRect(-54,-61,108,122);}c.restore();
        for(const xx of [-46,46])for(const yy of [-44,44])bolt(xx,yy);
      }else if(kind===1){
        for(const xx of [-23,23])slab(xx-23,-44,46,90,'#405157',3);
      }else{
        c.strokeStyle='#3e5155';c.lineWidth=2;c.setLineDash([7,7]);c.strokeRect(-55,-63,110,126);c.setLineDash([]);
        for(const xx of [-49,38])for(const yy of [-57,45])slab(xx,yy,13,16,'#3c5157',3);
      }
      if(kind===0){
        // Raised maintenance cradle: bevelled load plate and structural rails.
        c.fillStyle='rgba(3,11,17,.48)';c.beginPath();c.ellipse(7,10,41,45,0,0,Math.PI*2);c.fill();
        c.fillStyle='#172932';c.beginPath();c.ellipse(0,6,40,43,0,0,Math.PI*2);c.fill();
        const deck=c.createLinearGradient(-36,-37,34,39);deck.addColorStop(0,'#657473');deck.addColorStop(.5,'#3b5057');deck.addColorStop(1,'#263c46');
        c.fillStyle=deck;c.beginPath();c.ellipse(0,0,40,43,0,0,Math.PI*2);c.fill();
        c.save();c.beginPath();c.ellipse(0,0,36,39,0,0,Math.PI*2);c.clip();if(material){c.globalAlpha=.27;c.fillStyle=material;c.fillRect(-40,-43,80,86);}c.restore();
        c.strokeStyle='#263c46';c.lineWidth=2;for(const yy of [-22,0,22]){c.beginPath();c.moveTo(-30,yy);c.lineTo(30,yy);c.stroke();}
        for(const xx of [-21,21]){slab(xx-4,-29,8,58,'#66746c',3);for(const yy of [-23,23])bolt(xx,yy);}
        // A stationary L service arm and its low-right cast shadow, not a ship.
        slab(-47,-49,17,19,'#6d786a',7);slab(-42,-46,8,42,'#69756b',5);slab(-42,-11,31,8,'#737c6d',5);
        c.fillStyle='#192d36';c.fillRect(-15,-13,9,12);
        for(const yy of [-50,49])for(const xx of [-14,0,14]){c.fillStyle='#958967';c.fillRect(xx-4,yy,8,3);}
      }else if(kind===1){
        // Utility island: two condenser drums with curved volume and pipework.
        for(const xx of [-23,23]){
          c.fillStyle='rgba(2,12,17,.55)';c.beginPath();c.ellipse(xx+6,6,22,38,0,0,Math.PI*2);c.fill();
          const drum=c.createLinearGradient(xx-19,0,xx+19,0);drum.addColorStop(0,'#243943');drum.addColorStop(.28,'#6a7975');drum.addColorStop(.67,'#435b60');drum.addColorStop(1,'#1c303b');
          c.fillStyle=drum;c.fillRect(xx-19,-31,38,62);c.beginPath();c.ellipse(xx,-31,19,8,0,0,Math.PI*2);c.fill();
          c.fillStyle='#798780';c.beginPath();c.ellipse(xx,-31,17,6,0,0,Math.PI*2);c.fill();
          c.strokeStyle='#223b45';c.lineWidth=3;for(const yy of [-18,18]){c.beginPath();c.moveTo(xx-19,yy);c.lineTo(xx+19,yy);c.stroke();}
          c.fillStyle='#263d46';c.fillRect(xx-6,-36,12,8);c.fillStyle='#a0a18b';c.fillRect(xx-4,-36,8,2);
        }
        for(const yy of [40,49]){c.strokeStyle='#10242e';c.lineWidth=7;c.beginPath();c.moveTo(-36,yy+3);c.lineTo(37,yy+3);c.stroke();c.strokeStyle='#6b7971';c.lineWidth=4;c.beginPath();c.moveTo(-36,yy);c.lineTo(37,yy);c.stroke();}
        slab(-45,-55,22,12,'#61736e',4);for(let n=0;n<4;n++){c.fillStyle='#263c45';c.fillRect(-42+n*5,-52,2,6);}
      }else{
        // Cargo-transfer gantry: stacked ribbed containers and bridge legs.
        for(const [xx,yy,co] of [[-41,-38,'#676f59'],[4,-24,'#536e72'],[-35,10,'#5b6875']]){
          slab(xx,yy,37,37,co,6);for(let n=0;n<5;n++){c.fillStyle='#263c43';c.fillRect(xx+4+n*6,yy+4,2,29);c.fillStyle='#7c8579';c.fillRect(xx+5+n*6,yy+4,1,29);}
        }
        for(const xx of [-47,40]){slab(xx,-54,8,109,'#5f726d',6);for(const yy of [-47,45])bolt(xx+4,yy);}
        slab(-47,-53,95,11,'#79806b',8);slab(-47,44,95,9,'#68786c',5);
        c.strokeStyle='#253e47';c.lineWidth=2;c.beginPath();c.moveTo(-38,-50);c.lineTo(28,47);c.stroke();
        slab(25,-14,15,18,'#7c826c',6);c.fillStyle='#243b44';c.fillRect(29,-10,7,9);
      }
      c.restore();
    };
    for(const [u,left,right] of [[18.5,0,1],[21.5,2,0],[24.5,1,2]]){
      serviceBay(.155,u,left);serviceBay(.705,u,right);
    }
    }
  }
  function schedule() {
    if (ready(world) || scheduled) return;
    scheduled = true;
    // Coalesced setup, never a timer or allocation per rendered frame.
    setTimeout(build, 0);
  }
  function startFallback() {
    if (fallbackStarted || ready(world)) return;
    fallbackStarted = true;
    roofs = new Image(); ground = new Image();
    roofs.addEventListener('load', schedule); ground.addEventListener('load', schedule);
    roofs.addEventListener('error', schedule); ground.addEventListener('error', schedule);
    roofs.src = 'assets/airport-roofs-r1.webp?v=20261025-airport-depth-r1';
    ground.src = 'assets/airport-ground-r1.webp?v=20261025-airport-depth-r1';
    schedule();
  }
  world.addEventListener('load', () => {
    mapFailed = false;
    // Drop fallback Canvas and source-image references if a late map succeeds.
    cache = null; view = null; roofs = null; ground = null; fallbackStarted = false;
  });
  world.addEventListener('error', () => { mapFailed = true; startFallback(); });
  world.src = 'assets/airport-world-r3.webp?v=20261025-airport-landmarks-r3';
  host.ThunderAirportScene = Object.freeze({
    draw(context, width, height, time, alpha) {
      if (ready(world)) {
        context.save(); context.globalAlpha = Math.max(0, Math.min(1, alpha));
        context.drawImage(world,0,(28-time)*UNIT,WIDTH,640,0,0,width,height);
        context.restore(); return;
      }
      if (!mapFailed) {
        // Brief cold-load placeholder only. Never overlay two incompatible scenes
        // or hold up simulation while decoding a display-only resource.
        context.save(); context.globalAlpha = Math.max(0, Math.min(1, alpha));
        context.fillStyle = '#15242b'; context.fillRect(0,0,width,height);
        context.restore(); return;
      }
      startFallback();
      if (!cache) build();
      // Assemble integer rows first, then sample fractional scrolling once.
      // Independent alpha-blended subrects leave a translucent seam at a
      // fractional cut in some Canvas rasterizers, even with nearest sampling.
      if (!view) view = makeCanvas(WIDTH, 644);
      const staging = view.getContext('2d');
      staging.clearRect(0,0,WIDTH,644);
      const start = (28 - time) * UNIT, base = Math.floor(start) - 1;
      let offset = 0;
      while (offset < 644) {
        const source = base + offset, index = Math.floor(source / 640), top = source - index * 640;
        const count = Math.min(644 - offset, 640 - top);
        staging.drawImage(cache[index], 0, top, WIDTH, count, 0, offset, WIDTH, count);
        offset += count;
      }
      context.save(); context.globalAlpha = Math.max(0, Math.min(1, alpha));
      context.drawImage(view,0,start-base,WIDTH,640,0,0,width,height);
      context.restore();
    },
  });
})(window);
