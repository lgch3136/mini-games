const density = 38;
const shades = ["#1d2a35", "#26323a", "#30414a", "#25343e", "#2b3842"];

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function bakePlatform(p, facade) {
  const board = makeCanvas(p.w * density, p.h * density);
  const c = board.getContext("2d"), w = board.width, h = board.height;
  const stone = p.kind === "stone";
  const wood = p.oneWay || p.kind === "wood";
  if (!stone && !wood) {
    c.fillStyle = "#322e30";
    c.fillRect(0, 0, w, h);
    for (let x = -13, i = 0; x < w; x += 110, i++) {
      const lit = (i + Math.floor(p.x)) % 3 === 0;
      if (lit) c.drawImage(facade, 31, 184, 160, 49, x, 10, 110, 38);
      else c.drawImage(facade, 23, 249, 175, 77, x, 9, 110, 53);
      c.drawImage(facade, 394, 251, 99, 72, x, 59, 110, 66);
    }
    const base = c.createLinearGradient(0, 24, 0, Math.min(h, 160));
    base.addColorStop(0,"rgba(13,27,37,0.12)");
    base.addColorStop(0.65,"rgba(13,27,37,0.48)");
    base.addColorStop(1,"#172630");
    c.fillStyle = base; c.fillRect(0, 0, w, h);
  } else if (stone) {
    c.fillStyle = "#23313c"; c.fillRect(0, 0, w, h);
    for (let row = 0; row * 17 < h; row++) {
      for (let x = row%2 ? -25 : 0, n = 0; x < w; x += 47, n++) {
        c.fillStyle = shades[(row*3 + n + Math.abs(Math.floor(p.x))) % shades.length];
        c.fillRect(x+1, row*17+2, 45, 15);
        c.fillStyle = "#84969938"; c.fillRect(x+3, row*17+2, 40, 1);
      }
    }
  } else {
    c.fillStyle = "#302d2c"; c.fillRect(0,0,w,h);
    c.drawImage(facade, 34, 232, 155, 11, 0, 0, w, Math.min(9,h));
    for (let x = 5; x < w; x += 18) {
      c.fillStyle = "#1f292c"; c.fillRect(x, 5, 3, h-5);
      c.fillStyle = "#baa184"; c.fillRect(x, 5, 2, 2);
    }
  }
  // A thin continuous eave is the top of the actual collision rectangle.
  c.fillStyle = stone ? "#9daaaa" : wood ? "#b5a28a" : "#86a8ac";
  c.fillRect(0,0,w,2);
  c.fillStyle = stone ? "#586c73" : wood ? "#7a6655" : "#45646c";
  c.fillRect(0,2,w,3);
  for (let x=7; x<w; x+=stone?36:19) {
    c.fillStyle = "#263842"; c.fillRect(x,0,1,5);
  }
  return board;
}

export function bakeSky(image, width, height, city) {
  const w = Math.min(1180, Math.ceil(width + 38));
  const h = Math.max(2, Math.ceil(w * height / Math.max(1,width+38)));
  const board = makeCanvas(w,h), c = board.getContext("2d");
  const scale = Math.max(w/image.naturalWidth,h/image.naturalHeight);
  const iw = image.naturalWidth*scale, ih = image.naturalHeight*scale;
  c.drawImage(image,(w-iw)/2,(h-ih)*0.42,iw,ih);
  c.fillStyle = city ? "rgba(41,70,82,.20)" : "rgba(42,66,70,.13)";
  c.fillRect(0,0,w,h);
  const fade = c.createLinearGradient(0,0,0,h);
  fade.addColorStop(0,"rgba(15,31,48,.08)");
  fade.addColorStop(.62,"rgba(107,124,129,.13)");
  fade.addColorStop(1,"rgba(20,37,43,.34)");
  c.fillStyle = fade; c.fillRect(0,0,w,h);
  return board;
}

export function glowCard() {
  const board = makeCanvas(64,64), c = board.getContext("2d");
  const g = c.createRadialGradient(32,32,1,32,32,31);
  g.addColorStop(0,"#ffffff"); g.addColorStop(.18,"#ffffffe0");
  g.addColorStop(.55,"#ffffff39"); g.addColorStop(1,"#ffffff00");
  c.fillStyle = g; c.fillRect(0,0,64,64);
  return board;
}
