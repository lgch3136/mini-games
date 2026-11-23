const cells = {"dim":[2,1,46,140],"lit":[56,1,46,140],"spikes":[115,1,144,61],"chest":[113,69,109,72],"closed":[1,149,174,169],"open":[185,149,179,169]};

export function drawWaymark(ctx, atlas, kind, x, ground, width, height) {
  const [sx, sy, sw, sh] = cells[kind];
  if (kind === "chest") height = Math.min(height, width * sh / sw);
  ctx.drawImage(atlas, sx, sy, sw, sh, x-width/2, ground-height, width, height);
}
