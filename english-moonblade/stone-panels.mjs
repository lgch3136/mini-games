const density = 38;
const span = 16;

export function stonePanel(image) {
  const panel = document.createElement("canvas");
  panel.width = density * span;
  panel.height = density * 8;
  const c = panel.getContext("2d", {alpha:false});
  const w = panel.width;
  const band = Math.round(w * image.naturalHeight / image.naturalWidth);
  c.drawImage(image,0,0,w,band);
  const skip = Math.round(image.naturalHeight * .18);
  const bandBody = Math.round((image.naturalHeight - skip) * w / image.naturalWidth);
  for (let y=band; y<panel.height; y+=bandBody) {
    c.drawImage(image,0,skip,image.naturalWidth,image.naturalHeight-skip,0,y,w,bandBody);
  }
  const shade = c.createLinearGradient(0,band*.32,0,panel.height);
  shade.addColorStop(0,"rgba(8,22,29,0)");
  shade.addColorStop(.57,"rgba(8,22,29,.24)");
  shade.addColorStop(1,"rgba(8,22,29,.68)");
  c.fillStyle = shade;
  c.fillRect(0,0,w,panel.height);
  return panel;
}

export function drawStone(c, panel, x, y, platform, unit, viewWidth, viewHeight) {
  const width = platform.w * unit;
  const height = Math.min(platform.h * unit,viewHeight-y);
  const left = Math.max(x,0);
  const right = Math.min(x+width,viewWidth);
  if (height <= 0 || right <= left) return;
  const repeat = span*unit;
  const origin = x - ((platform.x%span+span)%span)*unit;
  const first = Math.floor((left-origin)/repeat);
  c.save();
  c.beginPath();
  c.rect(left,y,right-left,height);
  c.clip();
  for (let i=first; origin+i*repeat<right; i++) {
    const dx=origin+i*repeat;
    c.drawImage(panel,dx,y,repeat+.35,8*unit);
  }
  c.restore();
}
