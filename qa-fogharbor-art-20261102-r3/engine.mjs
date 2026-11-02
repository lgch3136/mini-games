export const STEP=1/60, LIMITS={enemy:160,bullet:180,hostile:120,xp:180,particle:160};
export const UPGRADES=[
 {id:'power',name:'聚焰镜',note:'铜灯弹伤害 +25%',tag:'主武器'},
 {id:'haste',name:'双棘发条',note:'射击间隔 ×0.85',tag:'主武器'},
 {id:'split',name:'分光棱镜',note:'每轮 +1 弹（最多5），散射覆盖',tag:'清群'},
 {id:'pierce',name:'穿雾芯',note:'弹丸额外贯穿 1 个敌人',tag:'穿透'},
 {id:'orbit',name:'回旋灯刃',note:'增加一枚近身环绕刃（最多4）',tag:'近身保护'},
 {id:'stride',name:'轻铜足具',note:'移速 +10%，冲刺冷却 -0.25秒',tag:'机动'},
 {id:'magnet',name:'引烬风箱',note:'拾取范围 +45，立即回复15生命',tag:'续航'},
 {id:'hull',name:'铆接护甲',note:'最大生命 +20，回复30生命',tag:'生存'},
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class Pool{constructor(cap){this.items=Array.from({length:cap},()=>({active:false}));this.cursor=0;}spawn(data){for(let i=0;i<this.items.length;i++){let j=(this.cursor+i)%this.items.length,o=this.items[j];if(!o.active){for(const k of Object.keys(o))delete o[k];Object.assign(o,data,{active:true});this.cursor=(j+1)%this.items.length;return o;}}return null;}each(fn){for(const o of this.items)if(o.active)fn(o);}get count(){return this.items.reduce((n,o)=>n+!!o.active,0);}}
export class World{
 constructor(seed=817){this.seed=seed>>>0;this.rng=this.seed||1;this.time=0;this.status='playing';this.reason='';this.kills=0;this.level=1;this.xp=0;this.need=6;this.choices=[];this.nextId=1;this.wave=0;this.spawnAt=0;this.bossSpawned=false;this.bossKilled=false;this.upgrades={};
 this.player={x:800,y:600,px:800,py:600,hp:100,maxHp:100,speed:190,damage:19,interval:.56,shots:1,pierce:0,orbit:0,magnet:65,fire:0,dashCD:0,dash:0,dx:1,dy:0,inv:0};
 this.lamps=[{x:420,y:380,progress:0,lit:false},{x:1180,y:380,progress:0,lit:false},{x:800,y:940,progress:0,lit:false}];
 this.enemies=new Pool(LIMITS.enemy);this.bullets=new Pool(LIMITS.bullet);this.hostiles=new Pool(LIMITS.hostile);this.gems=new Pool(LIMITS.xp);this.particles=new Pool(LIMITS.particle);this.orbitHit=new Map();this.flash=0;this.messages=[];this.message('巡亮三座港灯，准备迎击潮王'); }
 random(){this.rng=(Math.imul(1664525,this.rng)+1013904223)>>>0;return this.rng/4294967296;}
 message(text){this.messages.push({text,until:this.time+4});if(this.messages.length>4)this.messages.shift();}
 get lit(){return this.lamps.filter(l=>l.lit).length;}
 get dps(){return Math.round(this.player.damage*this.player.shots/this.player.interval);}
 hurt(n){let p=this.player;if(p.inv>0||p.dash>0)return;p.hp=Math.max(0,p.hp-n);p.inv=.65;this.flash=.18;if(p.hp<=0){this.status='lost';this.reason='灯火熄灭';}}
 burst(x,y,color,n=8){for(let i=0;i<n;i++){const a=i*Math.PI*2/n+this.time;this.particles.spawn({x,y,vx:Math.cos(a)*55,vy:Math.sin(a)*55,life:.45,color});}}
 enemy(kind,x,y){const scale=1+this.time/150;return this.enemies.spawn({id:this.nextId++,kind,x,y,px:x,py:y,r:kind==='boss'?44:kind==='charger'?19:kind==='ranged'?17:13,hp:kind==='boss'?900+this.lamps.filter(l=>!l.lit).length*180:(kind==='charger'?85:kind==='ranged'?45:32)*scale,maxHp:kind==='boss'?900+this.lamps.filter(l=>!l.lit).length*180:0,speed:kind==='boss'?42:kind==='charger'?65:kind==='ranged'?58:74+this.time*.18,phase:'move',timer:kind==='boss'?2:1.5+this.random()*1.5,tx:x,ty:y,hit:0});}
 spawnEnemy(){if(this.enemies.count>=LIMITS.enemy-1)return;const p=this.player,a=this.random()*Math.PI*2,d=500+this.random()*100;let x=clamp(p.x+Math.cos(a)*d,30,1570),y=clamp(p.y+Math.sin(a)*d,30,1170);const roll=this.random();this.enemy(this.time>28&&roll>.76?'charger':this.time>14&&roll>.52?'ranged':'chaser',x,y);}
 gem(x,y,value){if(!this.gems.spawn({x,y,value})){let target=this.gems.items.find(g=>g.active);if(target)target.value+=value;}}
 hit(e,n){e.hp-=n;e.hit=.12;if(e.hp<=0&&e.active){e.active=false;this.kills++;this.gem(e.x,e.y,e.kind==='boss'?30:e.kind==='chaser'?2:4);this.burst(e.x,e.y,'#efbb67');this.orbitHit.delete(e.id);if(e.kind==='boss'){this.bossKilled=true;this.message('潮王已退！巡齐港灯即可守住雾港');}}}
 offer(){if(this.level===2){this.choices=['split','orbit','pierce'].map(id=>UPGRADES.find(u=>u.id===id));this.status='upgrade';return;}const available=UPGRADES.filter(u=>u.id!=='split'||this.player.shots<5).filter(u=>u.id!=='orbit'||this.player.orbit<4);this.choices=[];for(let i=0;i<3;i++){let j=Math.floor(this.random()*available.length);this.choices.push(available.splice(j,1)[0]);}this.status='upgrade';}
 choose(id){if(this.status!=='upgrade'||!this.choices.some(c=>c.id===id))return false;let p=this.player;this.upgrades[id]=(this.upgrades[id]||0)+1;
 if(id==='power')p.damage*=1.25;if(id==='haste')p.interval=Math.max(.12,p.interval*.85);if(id==='split')p.shots++;if(id==='pierce')p.pierce++;if(id==='orbit')p.orbit++;if(id==='stride')p.speed*=1.1;if(id==='magnet'){p.magnet+=45;p.hp=Math.min(p.maxHp,p.hp+15);}if(id==='hull'){p.maxHp+=20;p.hp=Math.min(p.maxHp,p.hp+30);}
 this.choices=[];this.status='playing';if(this.xp>=this.need)this.levelUp();return true;}
 levelUp(){this.xp-=this.need;this.level++;this.need=Math.round(this.need*1.3+3);this.offer();}
 pause(){if(this.status==='playing')this.status='paused';} resume(){if(this.status==='paused')this.status='playing';}
 step(input={}){if(this.status!=='playing')return;const dt=STEP,p=this.player;this.time+=dt;p.px=p.x;p.py=p.y;p.inv=Math.max(0,p.inv-dt);p.dashCD=Math.max(0,p.dashCD-dt);p.dash=Math.max(0,p.dash-dt);this.flash=Math.max(0,this.flash-dt);
 let ix=Number(input.x)||0,iy=Number(input.y)||0,len=Math.hypot(ix,iy);if(len>1){ix/=len;iy/=len;}if(len>.1){p.dx=ix/(Math.hypot(ix,iy)||1);p.dy=iy/(Math.hypot(ix,iy)||1);}
 if(input.dash&&p.dashCD===0){p.dash=.19;p.dashCD=Math.max(1.2,3-(this.upgrades.stride||0)*.25);this.burst(p.x,p.y,'#7fd9d2');}
 if(p.dash>0){ix=p.dx;iy=p.dy;}const speed=p.speed*(p.dash>0?3.8:1);p.x=clamp(p.x+ix*speed*dt,28,1572);p.y=clamp(p.y+iy*speed*dt,28,1172);
 for(const l of this.lamps)if(!l.lit){l.progress=clamp(l.progress+(Math.hypot(p.x-l.x,p.y-l.y)<75?dt:-dt*.2),0,3);if(l.progress>=3){l.lit=true;p.hp=Math.min(p.maxHp,p.hp+20);this.gem(l.x,l.y,10);this.message(`港灯 ${this.lit}/3 已点亮 · 回复20`);this.burst(l.x,l.y,'#ffe7a0',16);}}
 if(this.time>=140&&!this.bossSpawned){this.bossSpawned=true;this.enemy('boss',800,100);this.message('潮王抵港！红环爆发前及时冲刺');}
 this.spawnAt-=dt;if(this.spawnAt<=0){this.spawnAt=Math.max(.23,1.15-this.time*.0048);for(let n=0;n<(this.time>80?2:1);n++)this.spawnEnemy();}
 this.enemies.each(e=>{e.px=e.x;e.py=e.y;e.hit=Math.max(0,e.hit-dt);let dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;e.timer-=dt;
 if(e.kind==='chaser'){e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;}
 else if(e.phase==='windup'){if(e.timer<=0){if(e.kind==='charger'){e.phase='charge';e.timer=.55;let l=Math.hypot(e.tx-e.x,e.ty-e.y)||1;e.vx=(e.tx-e.x)/l*400;e.vy=(e.ty-e.y)/l*400;}else{let a=Math.atan2(e.ty-e.y,e.tx-e.x),count=e.kind==='boss'?16:3;for(let k=0;k<count;k++){let angle=e.kind==='boss'?k*Math.PI*2/count:a+(k-1)*.13;this.hostiles.spawn({x:e.x,y:e.y,vx:Math.cos(angle)*(e.kind==='boss'?155:210),vy:Math.sin(angle)*(e.kind==='boss'?155:210),life:4,r:6});}e.phase='move';e.timer=e.kind==='boss'?2.1:2.7;}}}
 else if(e.phase==='charge'){e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.timer<=0){e.phase='move';e.timer=2;}}
 else{if(e.kind!=='ranged'||d>280){e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;}else if(d<170){e.x-=dx/d*e.speed*dt;e.y-=dy/d*e.speed*dt;}if(e.timer<=0){e.phase='windup';e.timer=e.kind==='boss'?1.1:.85;e.tx=p.x;e.ty=p.y;}}
 e.x=clamp(e.x,12,1588);e.y=clamp(e.y,12,1188);if(Math.hypot(p.x-e.x,p.y-e.y)<e.r+13)this.hurt(e.kind==='boss'?25:12);
 if(p.orbit&&this.time>=(this.orbitHit.get(e.id)||0)){for(let k=0;k<p.orbit;k++){let a=this.time*2.8+k*Math.PI*2/p.orbit;if(Math.hypot(e.x-p.x-Math.cos(a)*68,e.y-p.y-Math.sin(a)*68)<e.r+13){this.hit(e,25);if(e.active)this.orbitHit.set(e.id,this.time+.5);break;}}}
 });
 p.fire-=dt;if(p.fire<=0){let nearest=null,best=460;this.enemies.each(e=>{let d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;nearest=e;}});if(nearest){p.fire=p.interval;let a=Math.atan2(nearest.y-p.y,nearest.x-p.x);for(let k=0;k<p.shots;k++){let angle=a+(k-(p.shots-1)/2)*.16;this.bullets.spawn({x:p.x,y:p.y,vx:Math.cos(angle)*490,vy:Math.sin(angle)*490,life:1.1,damage:p.damage,left:p.pierce+1,hits:[]});}}}
 this.bullets.each(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0){b.active=false;return;}for(const e of this.enemies.items){if(!b.active)break;if(e.active&&!b.hits.includes(e.id)&&Math.hypot(e.x-b.x,e.y-b.y)<e.r+5){b.hits.push(e.id);this.hit(e,b.damage);if(--b.left<=0)b.active=false;}}});
 this.hostiles.each(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0)b.active=false;if(Math.hypot(b.x-p.x,b.y-p.y)<18){this.hurt(13);b.active=false;}});
 this.gems.each(g=>{let dx=p.x-g.x,dy=p.y-g.y,d=Math.hypot(dx,dy);if(d<p.magnet){g.x+=dx*7*dt;g.y+=dy*7*dt;}if(d<23){this.xp+=g.value;g.active=false;}});
 this.particles.each(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;if(q.life<=0)q.active=false;});
 if(this.status==='lost')return;
 if(this.bossKilled&&this.lit===3){this.status='won';this.reason='三灯长明，潮王退散';return;}
 if(this.time>=180){this.status='lost';this.reason=this.lit<3?'潮涌吞没未亮的港灯':'潮王冲破了防线';return;}
 if(this.xp>=this.need)this.levelUp();
 }
}
