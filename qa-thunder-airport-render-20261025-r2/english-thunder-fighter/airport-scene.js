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
  let cache = null, view = null, scheduled = false, builds = 0;
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
    // Junction opens into a broad maintenance apron with separate recessed bays.
    for (const u of [18.5,21.5,24.5]) for (const x of [.155,.705]) {
      rect(x,u,.14,1.9,'#0f2029'); rect(x+.006,u+.04,.128,1.75,'#293c44');
      rect(x+.013,u+.80,.114,.035,'#59696a');
      for (let n=0;n<3;n++) rect(x+.015+n*.04,u-.68,.022,.045,'#6e6c51');
      c.strokeStyle = '#475b61'; c.lineWidth = 2;
      c.beginPath(); c.ellipse((x+.07)*WIDTH,py(u),WIDTH*.039,UNIT*.53,0,0,Math.PI*2);c.stroke();
    }
    }
    builds++;
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
  world.src = 'assets/airport-world-r2.webp?v=20261025-airport-render-r2';
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
    // Read-only diagnostics for offline closure, cache and projection tests.
    inspect: () => ({width:WIDTH,height:HEIGHT,mode:ready(world)?'baked-image':mapFailed?'fallback':'loading-solid',tiles:cache?5:0,viewPixels:view?WIDTH*644:0,builds,scheduled,roofsReady:ready(roofs),groundReady:ready(ground),worldReady:ready(world),fallbackStarted}),
  });
})(window);
