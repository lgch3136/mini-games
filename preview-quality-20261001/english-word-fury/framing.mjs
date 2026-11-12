// Smooth stage framing, never a change to combat coordinates or move ranges.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*Math.max(0,dt)));
export class ArenaFraming {
  constructor(){this.reset();}
  reset(){this.width=0;this.x=0;this.y=2.25;this.quiet=0;}
  update(fight,aspect,dt=1/60,narrow=aspect<1.45){
    const portrait=narrow,base=portrait?10.8:16;
    let left=Infinity,right=-Infinity,head=0,actualHead=0,feet=Infinity;
    for(const f of fight.f){
      const size=f.c.size,back=f.x-f.facing*.88*size,front=f.x+f.facing*2.12*size;
      left=Math.min(left,back,front);right=Math.max(right,back,front);
      head=Math.max(head,f.y+3.60*size+Math.max(0,f.vy)*6);
      actualHead=Math.max(actualHead,f.y+3.60*size);feet=Math.min(feet,f.y);
    }
    const wide=!!fight.projectiles.length||fight.f.some(f=>f.action?.spec.projectile);
    const busy=fight.f.some(f=>f.action||f.freeze||f.stun||f.down||f.y>.02);
    for(const p of fight.projectiles){left=Math.min(left,p.x-p.r-.15);right=Math.max(right,p.x+p.r+.15);}
    this.quiet=busy||wide?0:this.quiet+dt;
    const vertical=(head-feet+1.1)*.972*aspect;
    const want=wide?Math.max(19.6,right-left+2.4,vertical):Math.max(base,right-left+2.4,vertical);
    if(!this.width){this.width=want;this.x=wide?0:(left+right)/2;}
    const target=want<this.width&&(busy||this.quiet<.42)?this.width:want;
    this.width=approach(this.width,target,target>this.width?8.5:1.65,dt);
    // Reserve a safety envelope for arms, back steps and live projectiles.
    // The wide view begins in projectile startup, before the projectile exists.
    this.width=Math.max(this.width,(right-left)/.92,(actualHead-feet+.6)*.972*aspect);
    let centre=wide?0:(left+right)/2;
    if(busy&&!wide)centre=this.x;
    this.x=approach(this.x,centre,4,dt);
    this.x=clamp(this.x,right-this.width*.46,left+this.width*.46);
    const height=this.width/aspect;
    const targetY=Math.max(portrait?1.8:2.25,head+.45-height*.5/.972);
    this.y=approach(this.y,targetY,targetY>this.y?9:3.5,dt);
    // Vertical safety is used during a jump apex, never by stretching actors.
    this.y=clamp(this.y,actualHead+.15-height*.5/.972,feet-.45+height*.5/.972);
    return {width:this.width,height,x:this.x,y:this.y,wide,portrait};
  }
}
