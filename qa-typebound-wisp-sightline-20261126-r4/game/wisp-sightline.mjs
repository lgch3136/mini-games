import {WideAdventureStage} from "../../qa-typebound-battle-framing-20261123-r2/game/adventure-framing.mjs?v=qa-typebound-battle-framing-20261123-r2";

export class WispSightlineStage extends WideAdventureStage {
  enemy(x,y,scale,run,pose){
    const sprite=this.images.get("book-spirit");
    if(run.mode!=="journey"||run.enemy?.kind!=="wisp"||
        !sprite?.complete||!sprite.naturalWidth||!sprite.naturalHeight)
      return super.enemy(x,y,scale,run,pose);
    if(pose.death>=1)return;
    // Original sprite/cast anchor and hit flash. Only the old binary halo changes.
    const c=this.ctx,h=74*scale,w=h*sprite.naturalWidth/sprite.naturalHeight,
      a=this.anchors().enemy;
    c.save();c.globalAlpha=1-pose.death;c.translate(a.x,a.y);
    c.rotate(this.reduced?0:Math.sin(this.motion.time*2.4)*.015+(pose.enemyTilt||0));
    c.drawImage(sprite,-w/2,-h/2,w,h);c.restore();
    if(pose.flash>.02)this.oval(a.x,a.y,w*.56,h*.56,null,"#fff4d9",.5+pose.flash*2);
    const charge=Math.max(0,Math.min(1,run.enemy.charge));
    if(run.phase!=="combat"||!run.roomStarted||!charge)return;
    // Short top sweep, never over eyes/body. Color AND terminal ticks distinguish
    // the actual energy-enabled Enter window from merely being close to a strike.
    const ready=charge>=.78&&run.energy>=1;
    const rx=w*.59,ry=h*.59,start=-Math.PI*.84,span=Math.PI*.68;
    const sweep=(end)=>{c.beginPath();c.ellipse(a.x,a.y,rx,ry,0,start,end);c.stroke()};
    c.save();c.lineCap="round";c.lineWidth=Math.max(1,1.45*scale);
    c.strokeStyle="#24353980";sweep(start+span);
    c.strokeStyle=ready?"#ffe6a1":charge>.72?"#ffad9c":"#f4c6a4";
    c.lineWidth=Math.max(1.6,2.1*scale);sweep(start+span*charge);
    if(ready)for(const theta of [start,start+span]){
      const px=a.x+Math.cos(theta)*rx,py=a.y+Math.sin(theta)*ry;
      c.beginPath();c.moveTo(px,py);c.lineTo(px+Math.cos(theta)*4*scale,py+Math.sin(theta)*4*scale);c.stroke();
    }
    c.restore();
  }
}
