import { DIRS, mod, random } from "./engine.mjs?mobile=20261002-quality4-r1";

const THEMES = [
  {
    ground: "#e6edcc",
    tile: "#e3eac6",
    edge: "#c8d8ad",
    line: "#a0b67d",
    leaf: "#92ad73",
    flower: "#edb27d",
    name: "青草花园",
  },
  {
    ground: "#dcebdc",
    tile: "#d7e6d5",
    edge: "#b8d3bc",
    line: "#89b29d",
    leaf: "#84ab93",
    flower: "#d9a4b8",
    name: "薄荷溪谷",
  },
  {
    ground: "#f0e6ce",
    tile: "#ece0c6",
    edge: "#dac9a5",
    line: "#bdaa7c",
    leaf: "#b3b081",
    flower: "#df977d",
    name: "金色果园",
  },
];
const round = (ctx, x, y, w, h, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};
const disc = (ctx, x, y, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

export class GardenRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.cache = document.createElement("canvas");
    this.back = this.cache.getContext("2d", { alpha: false });
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.key = "";
    this.particles = [];
    this.rings = [];
    this.eatAge = 10;
    this.swallows=[];this.blooms=[];this.departingGates=[];this.gateAge=1;this.missAge=10;this.gameCols=24;this.gameRows=16;
    this.displayLength = 5;
    this.frames = 0;
    this.cacheBuilds = 0;
    this.maxParticles = 0;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  resize(width, height, dpr = devicePixelRatio || 1) {
    const ratio = Math.min(1.75, dpr);
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    if (width === this.width && height === this.height && ratio === this.dpr)
      return;
    this.width = width;
    this.height = height;
    this.dpr = ratio;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.cache.width = this.canvas.width;
    this.cache.height = this.canvas.height;
    this.key = "";
  }
  geometry(game) {
    const padding = this.width < 600 ? 10 : 23;
    this.cell = Math.min(
      (this.width - 2 * padding) / game.cols,
      (this.height - 2 * padding) / game.rows,
    );
    this.ox = (this.width - this.cell * game.cols) / 2;
    this.oy = (this.height - this.cell * game.rows) / 2;
  }
  background(game) {
    const theme = Math.floor(game.completed / 3) % 3;
    const key = `${this.width}/${this.height}/${this.dpr}/${game.cols}/${game.rows}/${theme}/${game.arena}/${game.route?.id}/${JSON.stringify(game.obstacles)}`;
    if (this.key === key) return;
    this.key = key;
    this.cacheBuilds++;
    const c = this.back,
      t = THEMES[theme],
      s = this.cell,
      x = this.ox,
      y = this.oy,
      w = game.cols * s,
      h = game.rows * s;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = t.edge;
    c.fillRect(0, 0, this.width, this.height);
    const rnd = random(26);
    // Garden dressing is baked once. No frame-by-frame grids, gradients, or filters.
    for (let i = 0; i < 100; i++) {
      const px = rnd() * this.width,
        py = rnd() * this.height;
      if (px > x - 9 && px < x + w + 9 && py > y - 9 && py < y + h + 9)
        continue;
      c.save();
      c.translate(px, py);
      c.rotate(rnd() * 6.28);
      c.fillStyle = t.leaf;
      c.beginPath();
      c.ellipse(0, 0, 3 + rnd() * 6, 2 + rnd() * 3, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      if (i % 6 === 0) {
        disc(c, px, py, 3, t.flower);
        disc(c, px, py, 1.1, "#fff8db");
      }
    }
    round(c, x - 4, y + 2, w + 8, h + 8, 15, "#53673b1c");
    round(c,x-5,y-5,w+10,h+10,12,'#b5a483');
    round(c,x-3,y-3,w+6,h+6,10,'#d7cbaa');
    c.strokeStyle='#aa9a75';c.lineWidth=1;
    for(let xx=x+18;xx<x+w;xx+=32){c.beginPath();c.moveTo(xx,y-5);c.lineTo(xx,y-1);c.moveTo(xx,y+h+1);c.lineTo(xx,y+h+5);c.stroke();}
    round(c, x, y, w, h, 12, t.ground);
    c.save();
    c.beginPath();
    c.roundRect(x, y, w, h, 12);
    c.clip();
    c.fillStyle = t.tile;
    for (let row = 0; row < game.rows; row++)
      for (let col = 0; col < game.cols; col++)
        if ((row + col) % 2 === 0) c.fillRect(x + col * s, y + row * s, s, s);
    c.fillStyle = `${t.line}55`;
    for (let row = 1; row < game.rows; row++)
      for (let col = 1; col < game.cols; col++) {
        c.beginPath();
        c.arc(x + col * s, y + row * s, 0.75, 0, 6.29);
        c.fill();
      }
    if (game.arena === "classic") {
      c.strokeStyle = "#9d7e52";
      c.lineWidth = 4;
      c.setLineDash([10, 3]);
      c.strokeRect(x + 2, y + 2, w - 4, h - 4);
      c.setLineDash([]);
    } else {
      c.fillStyle = t.line;
      c.globalAlpha = 0.65;
      for (let j = -1; j <= 1; j++) {
        c.beginPath();
        c.moveTo(x + 3, y + h / 2 + j * 10);
        c.lineTo(x + 6, y + h / 2 + j * 10 - 3);
        c.lineTo(x + 6, y + h / 2 + j * 10 + 3);
        c.fill();
        c.beginPath();
        c.moveTo(x + w - 3, y + h / 2 + j * 10);
        c.lineTo(x + w - 6, y + h / 2 + j * 10 - 3);
        c.lineTo(x + w - 6, y + h / 2 + j * 10 + 3);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    // Rounded hedge beds have visible roots, top-lit foliage, and exact cell silhouettes.
    for (const o of game.obstacles || []) {
      const px=x+o.x*s, py=y+o.y*s;
      round(c,px+s*.06,py+s*.12,s*.88,s*.83,s*.2,'#6b735440');
      round(c,px+s*.07,py+s*.04,s*.86,s*.85,s*.18,'#466b42');
      round(c,px+s*.12,py+s*.06,s*.76,s*.55,s*.18,'#78964e');
      c.strokeStyle='#b1c879'; c.lineWidth=1;
      c.beginPath();c.moveTo(px+s*.23,py+s*.24);c.lineTo(px+s*.67,py+s*.24);c.stroke();
    }
    if (game.route?.kind === 'gates' && game.arena !== 'classic') {
      const cy=game.route.gates.row, cx=game.route.gates.col;
      c.strokeStyle='#8c8058';c.lineWidth=3;c.strokeRect(x+1,y+1,w-2,h-2);
      for (const [px,py,pw,ph] of [[x,y+(cy-1)*s,s*.22,s*3],[x+w-s*.22,y+(cy-1)*s,s*.22,s*3],[x+(cx-1)*s,y,s*3,s*.22],[x+(cx-1)*s,y+h-s*.22,s*3,s*.22]]) {
        round(c,px,py,pw,ph,3,'#2b8076');
        c.fillStyle='#e8fff1';c.font=`800 ${Math.max(10,s*.48)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';
        c.fillText(pw<ph ? '↔' : '↕',px+pw/2,py+ph/2);
      }
    }
    c.restore();
  }
  event(event) {
    if(event.type==='fork')this.gateAge=0;
    if(event.type==='fork-chosen')this.departingGates=(event.gates||[]).map(g=>({...g,age:0}));
    if(event.type==='wrong'||event.type==='hurt')this.missAge=0;
    if (["eat", "fruit", "complete", "hurt", "basket"].includes(event.type)) {
      const color =
        event.type === "hurt"
          ? "#d68167"
          : event.type === "fruit"
            ? "#e2aa39"
            : "#f1aa61";
      if(event.type!=="eat")this.rings.push({ x: event.x + 0.5, y: event.y + 0.5, age: 0, color });
      if (this.rings.length > 6) this.rings.shift();
      if(event.type==='eat'){
        this.eatAge=0;
        if(!this.reduced){this.swallows.push({age:0});if(this.swallows.length>4)this.swallows.shift();}
        this.blooms.push({nx:(event.x+.5)/this.gameCols,ny:(event.y+.5)/this.gameRows,age:0,index:this.blooms.length});
        if(this.blooms.length>36)this.blooms.shift();
      }
      if (this.reduced || event.type==="eat") return;
      const count = event.type === "complete" ? 14 : 7;
      for (let i = 0; i < count && this.particles.length < 64; i++) {
        const a = (i / count) * Math.PI * 2 + 0.2;
        this.particles.push({
          x: event.x + 0.5,
          y: event.y + 0.5,
          vx: Math.cos(a) * (1.4 + (i % 3) * 0.4),
          vy: Math.sin(a) * 1.7 - 0.8,
          age: 0,
          life: 0.45 + (i % 3) * 0.1,
          color,
          size: 0.06 + (i % 2) * 0.03,
        });
      }
      this.maxParticles = Math.max(this.maxParticles, this.particles.length);
    }
  }
  update(dt, game) {
    this.eatAge += dt;this.missAge+=dt;this.gateAge+=dt;
    for(const g of this.departingGates)g.age+=dt;
    this.departingGates=this.departingGates.filter(g=>g.age<.48);
    this.displayLength=game.length;this.gameCols=game.cols;this.gameRows=game.rows;
    for(const wave of this.swallows)wave.age+=dt;
    this.swallows=this.swallows.filter(w=>w.age*8<game.length+1);
    for(const flower of this.blooms)flower.age+=dt;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 3 * dt;
      if (p.age >= p.life) this.particles.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].age += dt;
      if (this.rings[i].age > 0.55) this.rings.splice(i, 1);
    }
  }
  draw(game, extra = 0) {
    this.frames++;
    this.geometry(game);
    this.background(game);
    const c = this.ctx,
      s = this.cell;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.cache, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.save();
    c.beginPath();
    c.roundRect(this.ox, this.oy, game.cols * s, game.rows * s, 12);
    c.clip();
    c.translate(this.ox, this.oy);
    c.scale(s, s);
    const time = game.time + extra;
    for(const gate of this.departingGates){c.save();c.globalAlpha=Math.max(0,1-gate.age/.48);this.drawGate(c,gate,gate.selected?1:Math.max(0,1-gate.age/.18),s,false);c.restore();}
    for(const gate of game.forkGates||[])this.drawGate(c,gate,.5+.5*Math.min(1,this.gateAge/.12),s,true);
    // Preview fruit and active fruit share a silhouette; saturation carries order.
    for (const t of game.tiles) {
      const revealed = game.assistance !== "recall" || game.hintAge > 0;
      const active = game.mode === "choose" || (revealed && t.label === game.word.en[game.cursor]);
      const hinted = game.mode === "choose" && game.hintAge > 0 && t.correct;
      const x = t.x + 0.5,
        y = t.y + 0.5,
        bob = this.reduced ? 0 : Math.sin(time * 3 + t.id) * 0.025;
      if (active) {
        c.strokeStyle = hinted ? "#4d9d77" : "#da925550";
        c.lineWidth = 0.038;
        c.beginPath();
        c.arc(x, y, 0.57 + Math.sin(time * 3) * 0.025, 0, Math.PI * 2);
        c.stroke();
      }
      c.save();
      c.translate(x, y + bob);
      const fruitScale = s < 22 ? 1.22 : 1.12;
      c.scale(fruitScale, fruitScale);
      c.globalAlpha = active ? 1 : 0.88;
      c.fillStyle = active ? "#92683323" : "#75865a14";
      c.beginPath();
      c.ellipse(0, 0.3, 0.4, 0.13, 0, 0, Math.PI * 2);
      c.fill();
      const fruit = active ? "#e98b50" : "#c2d48e";
      c.fillStyle = fruit;
      c.beginPath();
      c.moveTo(0, -0.31);
      c.bezierCurveTo(0.32, -0.48, 0.49, -0.18, 0.37, 0.14);
      c.bezierCurveTo(0.28, 0.43, -0.24, 0.43, -0.37, 0.15);
      c.bezierCurveTo(-0.52, -0.16, -0.29, -0.48, 0, -0.31);
      c.fill();
      c.strokeStyle = active ? "#a05f37" : "#809954";
      c.lineWidth = 0.055;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(0, -0.31);
      c.quadraticCurveTo(-0.06, -0.46, 0.035, -0.5);
      c.stroke();
      c.fillStyle = active ? "#668b48" : "#8ea967";
      c.beginPath();
      c.ellipse(0.14, -0.4, 0.13, 0.06, -0.45, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = active ? "#fff3de" : "#f7fae2";
      c.beginPath();
      c.ellipse(-0.19, -0.17, 0.045, 0.105, 0.45, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // Render glyphs in real pixels rather than a fractional .52px world font.
      // Small-font hinting differs between browser/native rasterizers; measured
      // ink bounds keep every letter centered inside the same bobbing fruit.
      c.save();
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.fillStyle = active ? "#50331f" : "#30492c";
      let fontSize = Math.max(13, s * .58);
      c.font = `800 ${fontSize}px ui-rounded, system-ui, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "alphabetic";
      const label = game.mode === "choose" ? String.fromCharCode(65 + t.id) : t.label.toUpperCase();
      let metrics = c.measureText(label);
      // Keep cold-start phone letters at 13 CSS px; unusual narrow rotation
      // boards can scale down only when the measured ink would leave the fruit.
      const fit = Math.min(1, s * .78 / metrics.width,
        s * .68 / ((metrics.actualBoundingBoxAscent || fontSize * .8) + (metrics.actualBoundingBoxDescent || 0)));
      if (fit < 1) { fontSize *= fit; c.font = `800 ${fontSize}px ui-rounded, system-ui, sans-serif`; metrics = c.measureText(label); }
      const ascent = metrics.actualBoundingBoxAscent ?? s * .42;
      const descent = metrics.actualBoundingBoxDescent ?? 0;
      c.fillText(label, this.ox + x * s, this.oy + (y + bob) * s + (ascent - descent) / 2);
      c.restore();

    }
    for (const fruit of game.bonus) {
      const x = fruit.x + 0.5,
        y = fruit.y + 0.5;
      c.save();
      c.translate(x, y);
      c.rotate(Math.sin(time * 2) * 0.1);
      disc(c, 0, 0.13, 0.32, "#b0873923");
      disc(c, 0, 0, 0.28, "#edb844");
      disc(c, -0.07, -0.09, 0.09, "#fff0a8");
      c.strokeStyle = "#fff6bd";
      c.lineWidth = 0.035;
      c.beginPath();
      c.moveTo(-0.12, 0);
      c.lineTo(0.12, 0);
      c.moveTo(0, -0.12);
      c.lineTo(0, 0.12);
      c.stroke();
      c.restore();
    }
    const points = game.bodyPoints(extra, game.length);
    this.wrappedSnake(c, points, game, time);
    for (const ring of this.rings) {
      c.globalAlpha = Math.max(0, 1 - ring.age / 0.55);
      c.strokeStyle = ring.color;
      c.lineWidth = 0.035;
      c.beginPath();
      c.arc(ring.x, ring.y, 0.35 + ring.age * 1.6, 0, 6.29);
      c.stroke();
    }
    for (const p of this.particles) {
      c.globalAlpha = 1 - p.age / p.life;
      disc(c, p.x, p.y, p.size, p.color);
    }
    c.globalAlpha = 1;
    c.restore();
    this.drawBlooms(c,game);
  }
  drawGate(c,gate,open,s,label){
    const x=gate.x+.5,y=gate.y+.5;
    round(c,x-.48,y-.47,.96,.94,.16,'#b29a6540');
    for(const side of[-1,1]){
      round(c,x+side*.40-.09,y+.29,.18,.18,.04,'#a49f82');
      round(c,x+side*.40-.052,y-.40,.105,.77,.03,'#806642');
      round(c,x+side*.40-.035,y-.41,.042,.70,.02,'#c7ad78');
      const width=.34*(1-open*.68),start=side<0?x-.36:x+.36-width;
      round(c,start,y-.18,width,.48,.025,gate.selected?'#b39055':'#ae8f60');
      c.strokeStyle='#6c6b49';c.lineWidth=.028;
      c.beginPath();c.moveTo(start+.03,y-.12);c.lineTo(start+width-.03,y+.21);c.moveTo(start+.03,y+.02);c.lineTo(start+width-.03,y+.02);c.stroke();
    }
    round(c,x-.48,y-.47,.96,.12,.045,'#bfa47a');round(c,x-.41,y-.46,.82,.035,.01,'#e5d4a9');
    if(label){c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle=gate.reward>100?'#9b543b':'#315d40';c.font=`800 ${Math.max(13,s*.55)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(gate.label,this.ox+x*s,this.oy+(y+.10)*s);c.restore();}
  }
  drawBlooms(c,game){
    const left=this.ox,right=this.ox+game.cols*this.cell,top=this.oy,bottom=this.oy+game.rows*this.cell;
    const vertical=this.ox>=14,groups=new Map();
    for(const f of this.blooms){const side=vertical?(f.nx<.5?0:1):(f.ny<.5?0:1),bed=Math.min(2,Math.floor((vertical?f.ny:f.nx)*3)),key=side+','+bed;if(!groups.has(key))groups.set(key,{side,bed,flowers:[]});groups.get(key).flowers.push(f);}
    for(const group of groups.values()){
      const {side,bed}=group;let x=vertical?(side?right+13:left-13):left+(bed+.5)*(right-left)/3,y=vertical?top+(bed+.5)*(bottom-top)/3:(side?bottom+7:top-7);
      x=Math.max(7,Math.min(this.width-7,x));y=Math.max(vertical?16:8,Math.min(this.height-(vertical?16:6),y));
      c.save();c.translate(x,y);
      round(c,-7,vertical?-15:-4,14,vertical?31:8,5,'#b5ab7f66');
      for(let i=0;i<Math.min(4,group.flowers.length);i++){
        const f=group.flowers[i],age=this.reduced?1:Math.min(1,f.age/.45),xx=vertical?(i%2?3:-3):(i-1.5)*6,yy=vertical?(-9+Math.floor(i/2)*13):0;
        c.save();c.translate(xx,yy);c.scale(age,age);c.strokeStyle='#718b52';c.lineWidth=1.1;c.beginPath();c.moveTo(0,4);c.quadraticCurveTo(-.5,0,0,-2);c.stroke();
        c.fillStyle='#8fa664';for(const side of[-1,1]){c.beginPath();c.ellipse(side*1.6,1.3,2.1,1,side*.55,0,Math.PI*2);c.fill();}
        for(let k=0;k<5;k++){const a=k*Math.PI*2/5;disc(c,Math.cos(a)*2,Math.sin(a)*2-3,1.8,f.index%2?'#da9a74':'#dca4a1');}
        disc(c,0,-3,1.2,'#fff0b5');c.restore();
      }
      c.restore();
    }
  }
  wrappedSnake(c, points, game, time) {
    const shiftX = Math.floor(points[0].x / game.cols) * game.cols,
      shiftY = Math.floor(points[0].y / game.rows) * game.rows;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // The trail is immutable presentation input. Measure it once, then translate
    // visible wrapped copies instead of cloning every point nine times per frame.
    for (const p of points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    for (let oy = -game.rows; oy <= game.rows; oy += game.rows)
      for (let ox = -game.cols; ox <= game.cols; ox += game.cols) {
        const dx = ox - shiftX + 0.5, dy = oy - shiftY + 0.5;
        if (maxX + dx < -0.7 || minX + dx > game.cols + 0.7 ||
            maxY + dy < -0.7 || minY + dy > game.rows + 0.7) continue;
        c.save();
        c.translate(dx, dy);
        this.snake(c, points, game, time);
        c.restore();
      }
  }
  snake(c, points, game, time) {
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    const total=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
    const at=(distance)=>{let used=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);if(distance<=used+len||i===points.length-1){const u=Math.min(1,Math.max(0,(distance-used)/Math.max(.0001,len)));return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,angle:Math.atan2(b.y-a.y,b.x-a.x)};}used+=len;}return{...points[0],angle:0};};
    if(game.invincible>0)c.globalAlpha=.65+.2*Math.sin(time*15);
    // Every sample remains on the exact grid polyline; the widest swallow is
    // less than one cell. No spline cuts a hedge corner or hides an occupied tail.
    const sections=Math.ceil(total/.13),samples=this.bodySamples||(this.bodySamples=[]);
    for(let n=0;n<=sections;n++){
      const d=Math.min(total,n*.13),p=at(d),tail=Math.min(1,(total-d)/1.25);
      const swell=this.reduced?0:this.swallows.reduce((sum,w)=>{const v=Math.abs(d-(.3+w.age*8));return sum+.068*Math.max(0,1-v/.9)-.016*Math.max(0,1-Math.abs(v-1.25)/.4);},0);
      const sample=samples[n]||(samples[n]={});sample.x=p.x;sample.y=p.y;sample.r=.21+.15*tail+Math.min(.065,swell)-.055*Math.max(0,1-d/.85);
    }
    // Two compound fills, instead of hundreds of overlapping draw calls.
    for(let pass=0;pass<2;pass++){
      c.fillStyle=pass===0?'#3f6747':game.boosting?'#afcf66':'#98bf74';c.beginPath();
      for(let n=sections;n>=0;n--){const p=samples[n],r=p.r-(pass?.065:0),y=p.y+(pass?-.026:.04);c.moveTo(p.x+r,y);c.arc(p.x,y,r,0,Math.PI*2);}
      c.fill();
    }
    c.strokeStyle='#deebb075';c.lineWidth=.10;c.beginPath();c.moveTo(points[0].x,points[0].y-.15);for(const p of points.slice(1))c.lineTo(p.x,p.y-.15);c.stroke();
    if(game.shield){c.strokeStyle='#78aeb5';c.lineWidth=.038;c.beginPath();c.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))c.lineTo(p.x,p.y);c.stroke();}
    for(let d=1.1;d<total-.5;d+=.72){const p=at(d);c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.fillStyle='#60895465';c.beginPath();c.moveTo(-.16,0);c.quadraticCurveTo(0,-.19,.15,0);c.quadraticCurveTo(0,.14,-.16,0);c.fill();c.strokeStyle='#d7e6a56b';c.lineWidth=.025;c.beginPath();c.moveTo(-.12,-.025);c.lineTo(.10,-.025);c.stroke();c.restore();}
    const p = points[0];
    c.translate(p.x, p.y);
    c.rotate((game.direction * Math.PI) / 2);
    const dir=DIRS[game.direction];let facing=null;
    for(const tile of game.tiles){let dx=tile.x-points[0].x,dy=tile.y+.5-(points[0].y+.5);if(game.arena!=='classic'){dx=mod(dx+game.cols/2,game.cols)-game.cols/2;dy=mod(dy+game.rows/2,game.rows)-game.rows/2;}const forward=dx*dir.x+dy*dir.y,side=dy*dir.x-dx*dir.y;if(forward>0&&forward<2&&Math.abs(side)<.7&&(!facing||forward<facing.forward))facing={forward,side};}
    const anticipate=facing?Math.max(0,1-facing.forward/1.4):0;
    const chew = Math.max(0, 1 - this.eatAge / 0.28),open=Math.max(anticipate*.8,chew*.55);
    c.scale(1 + chew * 0.035, 1 - chew * 0.04);
    c.fillStyle = "#386b42";
    c.beginPath();
    c.ellipse(0.04, 0.03, 0.46, 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = game.boosting ? "#c6e77b" : "#a6cf7d";
    c.beginPath();
    c.ellipse(0.065, -0.015, 0.435, 0.355, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#d5e8a0";
    c.beginPath();
    c.ellipse(0.18, 0.06, 0.23, 0.22, 0, 0, 6.29);
    c.fill();
    const blink = !this.reduced && (time % 4.7 < 0.12 || (this.eatAge>.09&&this.eatAge<.16));
    for (const side of [-1, 1]) {
      const ex = 0.13,
        ey = side * 0.215;
      c.fillStyle = "#fcfceb";
      c.beginPath();
      c.ellipse(ex, ey, 0.14, blink ? 0.035 : 0.13, 0, 0, 6.29);
      c.fill();
      if (!blink) {
        disc(c, ex + 0.045+anticipate*.025, ey+(facing?facing.side*.045:0), 0.066, "#24392b");
        disc(c, ex + 0.061, ey - 0.028, 0.021, "#ffffff");
      }
    }
    // A small jaw opening accompanies this one swallow; the eyes stay forward.
    if(open>.04){c.fillStyle='#40543a';c.beginPath();c.moveTo(.47,-.15*open);c.quadraticCurveTo(.16,0,.47,.15*open);c.closePath();c.fill();c.strokeStyle='#deebad';c.lineWidth=.045;c.beginPath();c.moveTo(.21,.02);c.quadraticCurveTo(.35,.16*open,.46,.17*open);c.stroke();}
    if(this.missAge<.5){c.strokeStyle='#557142';c.lineWidth=.045;for(const side of[-1,1]){c.beginPath();c.moveTo(-.03,side*.29);c.lineTo(.22,side*.23);c.stroke();}}
    for(const side of[-1,1])disc(c,.33,side*.09,.018,'#527447');
    c.strokeStyle = "#496d3e";
    c.lineWidth = 0.025;
    c.beginPath();
    c.moveTo(0.35, -0.055);
    c.quadraticCurveTo(0.4, 0, 0.35, 0.055);
    c.stroke();
    if (game.boosting) {
      c.strokeStyle = "#f1f6c0";
      c.lineWidth = 0.035;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(-0.55, side * 0.5);
        c.lineTo(-1.2, side * 0.5);
        c.stroke();
      }
    }
    c.restore();
  }
  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.eatAge = 10;this.swallows.length=0;this.blooms.length=0;this.departingGates.length=0;this.missAge=10;
  }
  diagnostics() {
    return {
      reducedMotion: this.reduced,
      frames: this.frames,
      cacheBuilds: this.cacheBuilds,
      particles: this.particles.length,
      maxParticles: this.maxParticles,
      rings: this.rings.length,swallows:this.swallows.length,blooms:this.blooms.length,
      dpr: this.dpr,
      cell: this.cell,
      width: this.width,
      height: this.height,
    };
  }
}
