// World-anchored scenery: every bright walking edge is existing collision terrain.
// Walls, braces and cables are a recessed background layer, never new surfaces.
export const STAGE_PALETTES = [
  {sky:'#b2c6ae',far:'#8fa99a',mid:'#607e70',dark:'#243d39',wall:'#496154',edge:'#c9bc84',soil:'#596650',name:'forest'},
  {sky:'#d7c4a4',far:'#b6ac94',mid:'#8c8b77',dark:'#343f3c',wall:'#6e7361',edge:'#d5bf88',soil:'#8d7e61',name:'cliff'},
  {sky:'#9cafb6',far:'#7f98a1',mid:'#587480',dark:'#213c48',wall:'#426373',edge:'#b7cdd0',soil:'#536e70',name:'relay'},
  {sky:'#25394f',far:'#304959',mid:'#385969',dark:'#152d3a',wall:'#385764',edge:'#bfbd9a',soil:'#41575c',name:'freight'},
  {sky:'#c4dce0',far:'#a1c1cc',mid:'#779fad',dark:'#254958',wall:'#558392',edge:'#e3ece4',soil:'#6b9aaa',name:'ice'},
  {sky:'#53484a',far:'#645255',mid:'#6a5857',dark:'#2b3039',wall:'#52494f',edge:'#c99e76',soil:'#5b5353',name:'furnace'},
];

function polygon(c, points, color) { c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill(); }
function line(c,points,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}

export function buildStageBackdrop(operation, environmentAtlas = null, operationAtlas = null) {
  const panel=document.createElement('canvas');panel.width=1600;panel.height=600;
  const c=panel.getContext('2d'),p=STAGE_PALETTES[operation];
  const sky=c.createLinearGradient(0,0,0,500);sky.addColorStop(0,p.sky);sky.addColorStop(1,p.far);c.fillStyle=sky;c.fillRect(0,0,1600,600);
  // Each transport operation has an authored place, in the same painted language.
  if(operationAtlas && [1,3,4].includes(operation)) {
    const row={1:0,3:1,4:2}[operation],h=operationAtlas.height/3;
    c.drawImage(operationAtlas,0,row*h,operationAtlas.width,h,0,0,1600,600);
    c.fillStyle=operation===3?'#152c4138':operation===4?'#82a7b71c':'#6b817022';
    c.fillRect(0,0,1600,600);return panel;
  }
  // The existing forest and furnace keep their established painted atmosphere.
  if(environmentAtlas && [0,2,5].includes(operation)) {
    const row=operation===5?1:0;
    c.drawImage(environmentAtlas,0,row*environmentAtlas.height/2,environmentAtlas.width,environmentAtlas.height/2,0,0,1600,600);
    c.fillStyle=operation===0?'#71857025':operation===2?'#557a8a45':'#29394550';
    c.fillRect(0,0,1600,600);return panel;
  }
  // The horizon is restrained; the live route owns the contrast and detail.
  for(let layer=0;layer<2;layer++){
    c.fillStyle=layer?p.mid:p.far;c.beginPath();c.moveTo(0,600);
    for(let i=0;i<=20;i++)c.lineTo(i*80,215+layer*75-Math.sin(i*1.7+operation)*32-Math.cos(i*.6)*22);
    c.lineTo(1600,600);c.fill();
  }
  if(operation<=1){
    for(let i=0;i<24;i++){
      const x=i*73+((i*31)%40),y=255+(i%4)*20,h=85+(i%5)*19;
      c.fillStyle=i%3?p.mid:p.far;c.fillRect(x-3,y-h,6,h+90);
      for(let k=0;k<3;k++)polygon(c,[[x,y-h-20+k*24],[x-26-k*6,y-h+33+k*24],[x+26+k*6,y-h+33+k*24]],i%3?p.mid:p.far);
    }
    if(operation===1){
      polygon(c,[[200,320],[290,215],[384,260],[432,440],[190,440]],'#8c8c79');
      polygon(c,[[1030,345],[1090,198],[1160,214],[1240,440],[1000,440]],'#9a9c84');
      line(c,[[380,270],[680,317],[1025,281]],'#718077',3);
    }
  }else if(operation===2){
    for(let i=0;i<4;i++){
      const x=130+i*400;c.fillStyle=p.mid;c.fillRect(x,235,110,220);c.fillRect(x-18,230,147,8);
      line(c,[[x+22,235],[x+52,132],[x+84,235]],p.mid,5);
      line(c,[[x+52,138],[x+114,166],[x+72,194]],p.mid,4);
      c.fillStyle=p.far;c.fillRect(x+14,268,76,11);
    }
  }else if(operation===3){
    for(let i=0;i<5;i++){
      const x=i*360-20;c.fillStyle=p.mid;c.fillRect(x,265,270,190);
      polygon(c,[[x-10,265],[x+70,220],[x+280,265]],p.mid);
      c.fillStyle='#718178';c.fillRect(x+25,300,6,8);c.fillRect(x+45,300,6,8);
    }
    line(c,[[380,440],[380,154],[620,154]],'#4c6873',9);line(c,[[387,200],[500,160]],'#4c6873',5);
  }else if(operation===4){
    for(let i=0;i<5;i++){
      const x=i*340;polygon(c,[[x,315],[x+91,146],[x+152,265],[x+223,182],[x+341,380]],i%2?'#8eb4c0':'#9bbdc6');
      polygon(c,[[x+91,146],[x+57,207],[x+93,195],[x+117,214]],'#d9e6e1');
    }
    c.fillStyle='#8bb1bd';c.fillRect(0,391,1600,209);
    for(let i=0;i<20;i++){c.fillStyle='#bed5d730';c.fillRect((i*193)%1600,401+(i*17)%140,65+(i%4)*16,2);}
  }else{
    for(let i=0;i<6;i++){
      const x=i*290;c.fillStyle='#4a434a';c.fillRect(x,225,170,260);c.fillRect(x+22,150,34,100);
      line(c,[[x+140,410],[x+140,190],[x+245,190],[x+245,460]],'#73615b',16);
      c.fillStyle='#93705b';c.fillRect(x+35,307,75,3);
    }
  }
  // Soft aerial separation, not a photograph or full-screen ornamental texture.
  c.fillStyle=operation===3?'#14293825':'#c4cebd10';c.fillRect(0,150,1600,450);
  return panel;
}

export function drawStageScenery(r,world,cam){
  const p=STAGE_PALETTES[r.operation],c=r.ctx,W=r.width;
  // Grounded silhouettes frame the route, behind the playable terrain and actors.
  for(const floor of world.terrain){
    if(floor.oneWay||floor.x>cam+W+100||floor.x+floor.w<cam-100)continue;
    const start=floor.x+45;
    for(let wx=start;wx<Math.min(floor.x+floor.w-35,cam+W+100);wx+=460){
      if(wx<cam-100)continue;
      const x=wx-cam,y=floor.y;
      if(r.operation===0 && !r.environmentAtlas){
        r.polygon([[x-20,y],[x-12,y-152],[x-25,y-200],[x-4,y-240],[x+12,y-159],[x+22,y]],p.dark);
        r.line([[x-2,y-13],[x-1,y-143],[x-11,y-182]],'#5c7360',3);
        r.polygon([[x-8,y-156],[x-79,y-163],[x-39,y-193],[x-64,y-213],[x-9,y-248],[x+45,y-214],[x+24,y-198],[x+74,y-169]],'#3e5a4e');
        r.polygon([[x-6,y-225],[x-47,y-211],[x-23,y-229],[x-9,y-248],[x+21,y-230]],'#657d5c');
        r.polygon([[x-23,y],[x-6,y-16],[x+20,y],[x+37,y+5],[x-40,y+5]],'#334d41');
      }else if(r.operation===1 && !r.operationAtlas){
        r.polygon([[x-45,y],[x-35,y-78],[x+1,y-115],[x+40,y-63],[x+65,y]],'#7e806a');
        r.polygon([[x-35,y-78],[x+1,y-115],[x+12,y-66],[x-9,y-21]],'#a1a084');
      }else if(r.operation===2){
        r.rect(x-22,y-107,44,105,p.dark);r.rect(x-15,y-100,29,70,p.wall);
        r.line([[x,y-107],[x,y-176],[x+36,y-176]],p.mid,7);
        r.ellipse(x+38,y-176,19,13,p.mid);r.ellipse(x+38,y-176,13,8,p.sky);
        r.rect(x-29,y-5,58,5,'#708b8d');
      }else if(r.operation===3){
        r.rect(x-18,y-138,10,138,p.dark);r.line([[x-13,y-133],[x+30,y-147]],p.dark,7);
        r.rect(x+22,y-148,20,5,'#a9afa1');r.rect(x+27,y-143,12,3,'#e5cf97');
        r.rect(x-27,y-7,30,7,'#526f72');
      }else if(r.operation===4){
        r.polygon([[x-50,y],[x-27,y-42],[x+3,y-54],[x+44,y-21],[x+65,y]],'#719aab');
        r.polygon([[x-27,y-42],[x+3,y-54],[x+44,y-21],[x+10,y-27]],'#d6e3de');
        r.line([[x+5,y-28],[x+23,y-18],[x+32,y-4]],'#9fc6d1',3);
      }else if(r.operation===5 && !r.environmentAtlas){
        r.rect(x-10,y-157,20,157,p.dark);r.rect(x-6,y-151,4,144,'#80736c');
        for(let k=0;k<3;k++){r.rect(x-13,y-125+k*40,26,5,'#4c444c');r.rect(x-10,y-123+k*40,3,2,'#a8947f');}
        r.line([[x+6,y-130],[x+74,y-130],[x+74,y-55]],'#746157',11);
      }
    }
  }
  // Recessed facilities belong to actual upper routes. Their roofs are the existing decks.
  for(const t of world.terrain){
    if(!t.oneWay||t.motion||t.x>cam+W+20||t.x+t.w<cam-20)continue;
    const floor=world.terrain.find(g=>!g.oneWay&&g.x<=t.x+t.w/2&&g.x+g.w>=t.x+t.w/2&&g.y>t.y+20);
    if(!floor)continue;
    const x=t.x-cam,y=t.y+18,h=floor.y-y,w=t.w;
    if(h<30)continue;
    if(r.facilityAtlas && t.w >= 200 && (floor.y-t.y) <= 158) {
      drawFacility(r, t, x, floor.y);
      continue;
    }
    if(r.facilityAtlas) continue;
    c.save();
    if(r.operation===0){
      // A forest post: an open lower passage and timber-backed upper walkway.
      r.rect(x+12,y+4,w-24,h-4,'#304b40');
      for(let q=20;q<w-20;q+=30)r.rect(x+q,y+10,20,h-12,'#52634b');
      r.rect(x+w*.38,y+10,w*.28,h-10,'#203b35');
      r.rect(x+30,y+23,37,27,'#213b35');r.rect(x+32,y+25,33,3,'#a59f6d');
      r.line([[x+14,y+3],[x+w-14,y+3]],'#938d66',4);
      r.polygon([[x+16,floor.y],[x+30,floor.y-11],[x+43,floor.y]],'#65784f');
    }else if(r.operation===1){
      // Open hoist gantry: large voids preserve the cliff gap and landing route.
      r.line([[x+16,y],[x+w-16,floor.y],[x+16,floor.y],[x+w-16,y]],'#777e67',7);
      r.rect(x+w*.5-18,y+18,36,24,'#4f5b50',3);r.ellipse(x+w*.5,y+30,9,9,'#afa786');r.ellipse(x+w*.5,y+30,4,4,p.dark);
    }else if(r.operation===2){
      r.rect(x+15,y,w-30,h,'#2b4a58');
      for(let q=20;q<w-20;q+=45){r.rect(x+q,y+9,31,h-17,'#3c5c69');r.rect(x+q+3,y+13,25,3,'#63808b');}
      r.rect(x+w*.4,y+17,w*.24,h-17,'#1d3745');r.rect(x+w*.4+5,y+24,w*.24-10,8,'#648088');
      r.line([[x+17,floor.y-8],[x+w-17,floor.y-8]],'#759291',5);
    }else if(r.operation===3){
      r.rect(x+14,y,w-28,h,'#284655');
      for(let q=24;q<w-30;q+=67){r.rect(x+q,y+8,53,h-10,'#1a3341');r.rect(x+q+3,y+10,47,5,'#587580');for(let k=0;k<4;k++)r.rect(x+q+4,y+25+k*12,45,2,'#3e5c67');}
      r.rect(x+12,floor.y-7,w-24,7,'#5f7271');
      r.rect(x+21,y+1,8,4,'#e0ba74');r.rect(x+w-32,y+1,8,4,'#e0ba74');
    }else if(r.operation===4){
      const tankX=x+w*.52;
      r.rect(tankX-37,y+12,74,h-13,'#416d80',16);r.ellipse(tankX,y+14,36,12,'#80a7b3');
      r.rect(tankX-21,y+21,7,h-30,'#6f9caa');
      r.line([[x+17,floor.y-7],[x+17,y+34],[tankX-37,y+34]],'#9dbec4',10);
      r.line([[tankX+37,y+36],[x+w-17,y+36],[x+w-17,floor.y-7]],'#486d7c',10);
      r.ellipse(tankX,y+43,14,14,'#344f5d');r.ellipse(tankX,y+43,10,10,'#b5d0d0');r.line([[tankX-9,y+43],[tankX+9,y+43]],'#344f5d',3);
    }else{
      r.rect(x+15,y,w-30,h,'#333640');
      r.rect(x+26,y+14,w-52,h-22,'#1f2d35');
      for(let q=36;q<w-30;q+=30)r.rect(x+q,y+18,6,h-32,'#5e5356');
      r.rect(x+33,y+20,w-66,3,'#c18355');
      r.line([[x+17,floor.y-5],[x+17,y+4],[x+w-17,y+4],[x+w-17,floor.y-5]],'#79665a',8);
    }
    c.restore();
  }
}

export function drawPlatformSupport(r,world,t,x,y){
  const p=STAGE_PALETTES[r.operation],W=t.w;
  if(t.motion){
    if(t.motion==='x'){
      const left=t.base-t.range-r.cam,right=t.base+t.range+W-r.cam;
      r.line([[left,y+34],[right,y+34]],p.dark,9);r.line([[left,y+31],[right,y+31]],'#91a8a0',2);
      for(const at of [left+10,right-10]){
        r.rect(at-5,y+26,10,22,p.dark);r.rect(at-2,y+26,4,6,p.edge);
        const bank=world.terrain.find(g=>!g.oneWay&&g.x<=at+r.cam&&g.x+g.w>=at+r.cam&&g.y>y+25);
        if(bank){r.rect(at-7,y+34,14,bank.y-y-34,p.dark);r.rect(at-5,y+37,3,bank.y-y-37,p.wall);r.rect(at-13,bank.y-7,26,7,p.wall);}
      }
      for(const at of [x+20,x+W-20]){r.ellipse(at,y+25,8,8,p.dark);r.ellipse(at,y+25,4,4,'#b4c1aa');}
      r.line([[x+12,y+17],[x+24,y+26],[x+W-24,y+26],[x+W-12,y+17]],'#647d76',4);
    }else{
      const top=t.base-t.range-56,bottom=t.base+t.range+52,cx=x+W/2;
      r.rect(cx-17,top,34,bottom-top,p.dark);r.rect(cx-8,top+4,16,bottom-top-4,'#637b72');
      for(let yy=top+12;yy<bottom;yy+=22)r.rect(cx-5,yy,10,4,'#354e49');
      r.line([[cx-55,top+3],[cx+55,top+3]],p.dark,12);r.ellipse(cx,top+3,15,15,p.edge);r.ellipse(cx,top+3,8,8,p.dark);
      for(const dx of [-W*.34,W*.34])r.line([[cx+dx,y+18],[cx+dx,top+4],[cx,top+4]],'#909e87',3);
      r.rect(cx-27,y+18,54,14,'#607970',3);
      const mastX=cx+r.cam;
      const bank=world.terrain.filter(g=>!g.oneWay).map(g=>({g,d:Math.max(g.x-mastX,mastX-g.x-g.w,0)})).sort((a,b)=>a.d-b.d)[0]?.g;
      if(bank){
        const anchor=Math.max(bank.x+15,Math.min(bank.x+bank.w-15,mastX))-r.cam;
        const foot=bank.y+30;
        r.rect(cx-17,bottom-2,34,Math.max(3,foot-bottom+8),p.dark);
        r.line([[anchor,bank.y+12],[cx,foot]],p.dark,13);
        r.line([[anchor,bank.y+12],[cx,foot]],'#6e7e71',7);
        r.rect(anchor-13,bank.y+4,26,18,p.dark);r.ellipse(anchor,bank.y+11,3,3,p.edge);
        r.rect(cx-25,foot-6,50,12,p.dark);r.rect(cx-21,foot-5,42,2,'#899985');
      }
    }
    return;
  }
  const floor=world.terrain.find(g=>!g.oneWay&&g.x<=t.x+W/2&&g.x+g.w>=t.x+W/2&&g.y>y);
  if(floor){
    // The atlas already provides load-bearing pillars, rear wall and footings.
    if(r.facilityAtlas && t.w >= 200 && (floor.y-t.y) <= 158) return;
    const wood=t.material==='wood', beam=wood?'#5c5945':r.operation===5?'#5d5852':'#45616a';
    const edge=wood?'#918967':r.operation===5?'#99876e':'#8aa4a1';
    for(const leg of [16,W-16]){
      r.rect(x+leg-7,y+13,14,floor.y-y-13,p.dark);
      r.rect(x+leg-5,y+19,9,floor.y-y-20,beam);
      r.rect(x+leg-5,y+19,2,floor.y-y-20,edge);
      r.rect(x+leg-13,floor.y-9,26,9,r.operation===4?'#aac7cb':r.operation===5?'#796e5c':'#748578');
      r.line([[x+leg+(leg<W/2?5:-5),y+49],[x+leg+(leg<W/2?31:-31),y+18]],p.dark,10);
      r.line([[x+leg+(leg<W/2?5:-5),y+48],[x+leg+(leg<W/2?30:-30),y+18]],beam,6);
      for(const joint of [y+18,y+48]){
        r.rect(x+leg-9,joint-3,18,7,beam);
        r.rect(x+leg-7,joint-2,14,1,edge);
        r.ellipse(x+leg,joint+.5,1.7,1.7,'#20313a');
      }
    }
    r.line([[x+16,y+23],[x+W-16,y+23]],p.dark,9);
    r.line([[x+16,y+22],[x+W-16,y+22]],beam,5);
    r.line([[x+16,y+20],[x+W-16,y+20]],edge,1.2);
  }else{
    // Suspension terminates at visible anchors on the actual two banks.
    const middle=t.x+W/2;
    const left=world.terrain.filter(g=>!g.oneWay&&g.x+g.w<=middle).sort((a,b)=>b.x+b.w-a.x-a.w)[0];
    const right=world.terrain.filter(g=>!g.oneWay&&g.x>=middle).sort((a,b)=>a.x-b.x)[0];
    if(left&&right){
      const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
      const lx=clamp(t.x-14,left.x+8,left.x+left.w-8)-r.cam;
      const rx=clamp(t.x+W+14,right.x+8,right.x+right.w-8)-r.cam;
      const top=y-68,sag=38,steel=t.material!=='wood';
      for(const [at,bank] of [[lx,left],[rx,right]]){
        r.rect(at-8,top-7,16,bank.y-top+7,p.dark);
        r.rect(at-5,top-4,5,bank.y-top+4,steel?'#6e7976':'#8b8060');
        r.rect(at-15,bank.y-9,30,9,steel?'#73776c':'#7c8068');
        r.ellipse(at,top+4,9,9,p.dark);r.ellipse(at,top+4,5,5,p.edge);
      }
      const c=r.ctx;c.strokeStyle=steel?'#a0ada5':'#c0b285';c.lineWidth=3;
      c.beginPath();c.moveTo(lx,top+4);c.quadraticCurveTo((lx+rx)/2,top+4+sag,rx,top+4);c.stroke();
      for(const at of [x+12,x+W-12]){
        const u=clamp((at-lx)/(rx-lx),0,1),anchorY=top+4+2*u*(1-u)*sag;
        r.line([[at,anchorY],[at,y+15]],steel?'#89988e':'#b1a780',3);
        r.rect(at-5,y+10,10,10,p.dark);r.rect(at-3,y+12,6,2,p.edge);
      }
      r.rect(x+5,y+15,W-10,5,p.dark);
    }

  }
}

// Generated structural sprites are attached to the collision tread and real floor.
// End pillars keep their scale; only the recessed central bay adapts horizontally.
const FACILITY_CELLS = [
  {x:0,top:194,tread:250,foot:466}, {x:628,top:164,tread:252,foot:466},
  {x:0,top:497,tread:650,foot:837}, {x:628,top:556,tread:565,foot:837},
  {x:0,top:900,tread:963,foot:1202}, {x:628,top:914,tread:971,foot:1202},
];
function drawFacility(r,t,x,floor){
  const image=r.facilityAtlas,a=FACILITY_CELLS[r.operation],c=r.ctx;
  const scale=(floor-t.y)/(a.foot-a.tread),fullWidth=t.w+12,dx=x-6;
  const capSource=120,capWidth=Math.min(fullWidth*.27,capSource*scale);
  const top=t.y-(a.tread-a.top)*scale,height=(a.foot-a.top)*scale;
  const parts=[[0,capSource,dx,capWidth],[capSource,626-2*capSource,dx+capWidth,fullWidth-2*capWidth],[626-capSource,capSource,dx+fullWidth-capWidth,capWidth]];
  c.save();c.globalAlpha=.73;
  for(const [sx,sw,tx,tw] of parts)c.drawImage(image,a.x+sx,a.top,sw,a.foot-a.top,tx,top,tw,height);
  c.restore();
}

export function paintDeck(c,image,operation,width){
  const cell=FACILITY_CELLS[operation],sy=cell.tread-2,cap=90,edge=Math.min(30,width*.24);
  c.drawImage(image,cell.x,sy,cap,34,0,-1,edge,18);
  c.drawImage(image,cell.x+cap,sy,626-cap*2,34,edge,-1,width-edge*2,18);
  c.drawImage(image,cell.x+626-cap,sy,cap,34,width-edge,-1,edge,18);
  c.fillStyle=operation===0?'#b6b083aa':operation===5?'#c8ae89bb':'#b6c8bfaa';c.fillRect(0,0,width,1.3);
}
