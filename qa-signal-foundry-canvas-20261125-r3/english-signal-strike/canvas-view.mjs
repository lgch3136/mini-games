import {routeParts,ROUTE_COLORS} from "../../qa-signal-foundry-route-20261123-r1/english-signal-strike/foundry-route.mjs";
import {rayBox} from "../../qa-signal-aim-charge-20261116-r1/shared/first-person/math.mjs?mobile=20261002-quality4-r1";

// Render-only view of the original Strike world. Near-plane clipping uses camera space.
const NEAR=.11, neutral=["#263747","#334653","#425461","#4c5a62","#415260"];
function clip(points) {
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],inside=a.d>=NEAR,next=b.d>=NEAR;
    if(inside)result.push(a);
    if(inside!==next){const t=(NEAR-a.d)/(b.d-a.d);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,d:NEAR});}
  }
  return result;
}
const hex=n=>"#"+n.toString(16).padStart(6,"0");
const within=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r;
export class SignalCanvas {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext("2d",{alpha:false});if(!this.ctx)throw Error("Canvas 2D context unavailable");
    this.renderer={info:{render:{calls:0,triangles:0},memory:{geometries:0,textures:0}}};
    this.ready=false;this.quality=1;this.reduced=false;this.traces=[];
  }
  async preload(){this.ready=true;}
  build(world){this.traces=[];this.routes=world.objectives.filter(n=>n.kind==="isolator").map(node=>({node,parts:routeParts(node).filter(k=>k.y<.2)}));}
  resize(){
    const w=Math.max(1,this.canvas.clientWidth||960),h=Math.max(1,this.canvas.clientHeight||540);
    const scale=Math.min(devicePixelRatio||1,1.5,1440/w,900/h);
    this.canvas.width=Math.round(w*scale);this.canvas.height=Math.round(h*scale);
  }
  event(e){if(e.type==="shot"&&e.impacts?.length)this.traces=e.impacts.map(o=>({origin:e.origin,end:o,fade:.075}));}
  dispose(){this.ready=false;this.routes=[];this.traces=[];}
  render(world,_alpha=1,delta=0){
    const {ctx:g,canvas}=this,{width:w,height:h}=canvas,eye=world.eye(),p=world.p;
    const yaw=p.yaw,pitch=p.pitch+p.kick,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const focal=h/(2*Math.tan((p.aim?49:72)*Math.PI/360)),cx=w/2,cy0=h/2;
    const cam=(x,y,z)=>{
      x-=eye.x;y-=eye.y;z-=eye.z;const fore=-x*sy-z*cy;
      return {x:x*cy-z*sy,y:y*cp-fore*sp,d:fore*cp+y*sp};
    };
    const px=q=>[cx+q.x*focal/q.d,cy0-q.y*focal/q.d];
    const polygon=(pts,color,stroke=false)=>{
      g.beginPath();pts.forEach((q,i)=>{const [x,y]=px(q);i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();
      g.fillStyle=color;g.fill();if(stroke){g.strokeStyle="#111c24";g.lineWidth=1;g.stroke();}
    };
    const faces=[];
    const add=(pts,color,stroke=false,bias=0)=>{
      const poly=clip(pts.map(k=>cam(...k)));if(poly.length<3)return;
      faces.push({poly,d:poly.reduce((s,q)=>s+q.d,0)/poly.length+bias,color,stroke});
    };
    const box=(b,colors,yaw=0)=>{
      const cs=Math.cos(yaw),ss=Math.sin(yaw);
      const v=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[b.x+x*b.hx*cs+z*b.hz*ss,b.z+z*b.hz*cs-x*b.hx*ss]);
      const vs=y=>v.map(([x,z])=>[x,y,z]);const lo=vs(b.y-b.hy),hi=vs(b.y+b.hy);
      add(hi,colors[4],true);
      for(let j=0;j<4;j++){const k=(j+1)%4;add([lo[j],lo[k],hi[k],hi[j]],colors[j],true);}
    };
    const mark=(o, color, r, label="",shape="round")=>{
      if(!within(o,p,58))return;
      const tip=cam(o.x,o.y,o.z);if(tip.d<NEAR)return;
      const [x,y]=px(tip),sz=Math.min(h*.15,Math.max(2,focal*r/tip.d));
      if(x+sz<0||x-sz>w||y+sz<0||y-sz>h)return;
      // Reject fully hidden actors/markers using the stock 3D blocker test.
      const dist=Math.hypot(o.x-eye.x,o.y-eye.y,o.z-eye.z);
      const dir={x:(o.x-eye.x)/dist,y:(o.y-eye.y)/dist,z:(o.z-eye.z)/dist};
      if(dist>.1&&solid.some(b=>rayBox(eye,dir,b,dist-r)<dist-r))return;
      g.fillStyle=color;g.strokeStyle="#121c25";g.lineWidth=2;g.beginPath();
      if(shape==="diamond"){g.moveTo(x,y-sz);g.lineTo(x+sz,y);g.lineTo(x,y+sz);g.lineTo(x-sz,y);g.closePath();}
      else if(shape==="rect")g.rect(x-sz,y-sz*.65,sz*2,sz*1.3);
      else g.arc(x,y,sz,0,Math.PI*2);
      g.fill();g.stroke();
      if(label){g.textAlign="center";g.font=`600 ${Math.max(10,h*.025)}px system-ui`;g.strokeStyle="#101820";g.lineWidth=3;g.strokeText(label,x,y-sz-5);g.fillText(label,x,y-sz-5);}
      return true;
    };
    g.fillStyle="#202e39";g.fillRect(0,0,w,h);
    g.fillStyle="#29353c";const horizon=cy0+Math.tan(pitch)*focal;g.fillRect(0,horizon,w,Math.max(0,h-horizon));
    const physical=world.blockers(),solid=physical.filter(k=>!k.shootable);
    for(const t of this.routes){
      if(t.node.zone!==world.zone)continue;
      for(const k of t.parts){
        if(t.node.done&&k.material.endsWith("On"))continue;
        const cs=Math.cos(k.yaw),sn=Math.sin(k.yaw);
        const q=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[k.x+x*k.w*.5*cs+z*k.d*.5*sn,k.y,k.z+z*k.d*.5*cs-x*k.w*.5*sn]);
        add(q,hex(ROUTE_COLORS[k.material]),false,-.11);
      }
    }
    for(const b of physical){
      if(!within(b,p,65+Math.max(b.hx,b.hz)))continue;
      const colors=b.kind==="foundry-shutter"?(b.x<0?["#66452a","#8b5c34","#a97a47","#79532f","#eead63"]:["#2f525a","#345e69","#4b8792","#396971","#80c7d4"]):b.kind==="gate"?["#254b4d","#315d60","#427d7e","#44777b","#67aaad"]:neutral;
      box(b,colors);
    }
    faces.sort((a,b)=>b.d-a.d);for(const f of faces)polygon(f.poly,f.color,f.stroke);
    for(const o of world.objectives)if(o.zone===world.zone&&o.kind!=="core")
      mark(o,o.done?"#828f90":o.side<0?"#ffc47c":"#86deeb",.50,within(o,p,11)?(o.done?"已断电":o.label):"","diamond");
    for(const o of world.props)mark({...o,y:1.52},"#eee193",.46,"","diamond");
    for(const o of world.drops??[])if(!o.dead&&!o.taken)mark({...o,y:o.y??.35},"#81dca7",.40,"","diamond");
    const actors=world.enemies.filter(o=>!o.dead&&o.zone===world.zone).sort((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)-Math.hypot(a.x-p.x,a.z-p.z));
    for(const o of actors){
      const radius=o.kind==="boss"?1.27:o.kind==="drone"?.56:.65;
      if(world.protected(o))mark(o,"#6cd8e0",radius*1.35,"","round");
      const visible=mark(o,o.disabled?"#73818a":o.wind>0?"#ffbe71":"#ef8587",radius,o.wind>0?"正在蓄力":"",o.kind==="drone"?"diamond":"rect");
      if(visible&&o.lock&&o.wind>0&&!this.reduced){
        const len=Math.hypot(o.lock.x-o.x,o.lock.y-o.y,o.lock.z-o.z);
        const dir={x:(o.lock.x-o.x)/len,y:(o.lock.y-o.y)/len,z:(o.lock.z-o.z)/len};
        const max=solid.reduce((d,b)=>Math.min(d,rayBox(o,dir,b,d)),len);
        const tail=len>.01&&max>.05&&clipLine(cam(o.x,o.y,o.z),cam(o.x+dir.x*max,o.y+dir.y*max,o.z+dir.z*max));
        if(tail){g.strokeStyle="#ff896b";g.lineWidth=1.4;g.beginPath();g.moveTo(...px(tail[0]));g.lineTo(...px(tail[1]));g.stroke();}
      }
    }
    for(const o of world.bullets)if(o.life>0)mark(o,"#ff7359",Math.max(.18,o.r??.18));
    if(!this.reduced)for(const t of this.traces)if(t.fade>0){
      const o=t.origin,e=t.end,a=cam(o.x,o.y-.18,o.z),b=cam(e.x,e.y,e.z),line=clipLine(a,b);
      if(line){g.strokeStyle="#e6d9a6";g.lineWidth=1;g.beginPath();g.moveTo(...px(line[0]));g.lineTo(...px(line[1]));g.stroke();}
    }
    for(const t of this.traces)t.fade-=delta;
    // Keep the shipped central crosshair (HTML). A compact facing marker is the local player's geometry.
    g.fillStyle="#314956";g.strokeStyle="#8aabb5";g.lineWidth=2;g.beginPath();
    g.moveTo(cx+w*.035,h);g.lineTo(cx+w*.075,h*.885);g.lineTo(cx+w*.105,h*.885);g.lineTo(cx+w*.162,h);g.closePath();g.fill();g.stroke();
    if(world.map.id==="foundry"&&world.zone===0&&world.objectives.filter(o=>o.zone===0).some(o=>!o.done))this.forkMap(world,physical);
    this.renderer.info.render.calls=faces.length;
  }
  forkMap(world,physical){
    const {ctx:g,canvas:{width:w,height:h}}=this;
    const s=Math.min(3.4,w*.0046,h*.0062), bw=34*s,bh=42*s, x=w-bw-14,y=Math.min(h*.33,170);
    const sx=v=>x+bw*.5+v*s,sy=v=>y+bh-(5-v)*s;
    g.save();g.beginPath();g.rect(x,y,bw,bh);g.clip();
    g.fillStyle="#151f28";g.fillRect(x,y,bw,bh);
    for(const b of physical)if(!b.shootable&&b.kind!=="foundry-shutter"){
      g.fillStyle="#344854";g.fillRect(sx(b.x-b.hx),sy(b.z-b.hz),b.hx*2*s,b.hz*2*s);
    }
    for(const t of this.routes.filter(t=>t.node.zone===0)){
      for(const k of t.parts.filter(k=>k.material.endsWith("On"))){
        g.save();g.translate(sx(k.x),sy(k.z));g.rotate(-k.yaw);g.fillStyle=t.node.done?"#87979b":hex(ROUTE_COLORS[k.material]);g.fillRect(-.5,-k.d*s*.5,1,k.d*s);g.restore();
      }
      const o=t.node;g.fillStyle=o.done?"#87979b":o.side<0?"#ffc47c":"#86deeb";g.fillRect(sx(o.x)-2.5,sy(o.z)-2.5,5,5);
    }
    for(const b of physical)if(b.kind==="foundry-shutter"){
      g.fillStyle=b.x<0?"#ffae63":"#7bdae8";g.fillRect(sx(b.x-b.hx),sy(b.z)-1,b.hx*2*s,2);
    }
    const p=world.p;g.translate(sx(p.x),sy(p.z));g.rotate(-p.yaw);g.fillStyle="#f5f8fa";g.beginPath();g.moveTo(0,-5);g.lineTo(3.5,4);g.lineTo(-3.5,4);g.closePath();g.fill();g.restore();
  }
}
function clipLine(a,b){
  if(a.d<NEAR&&b.d<NEAR)return null;
  if(a.d>=NEAR&&b.d>=NEAR)return [a,b];
  const t=(NEAR-a.d)/(b.d-a.d),p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,d:NEAR};return a.d<NEAR?[p,b]:[a,p];
}
