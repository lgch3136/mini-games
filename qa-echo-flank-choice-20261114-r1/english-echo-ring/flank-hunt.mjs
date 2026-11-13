import { FocusHuntPractice } from './focus-hunt.mjs?v=20261113-opposite-side-r1';
// Optional encounter composition. Production movement/collision/shot code unchanged.
export class FlankHuntPractice extends FocusHuntPractice {
  constructor(lesson=1,pace=1,opposite=false){super(lesson,pace,opposite);this.flank=true;this.attempt=0;this.reset();}
  reset(advance=true){super.reset();if(!this.flank)return;if(advance||!this.blockedSign)this.blockedSign=(this.attempt++%2===0)?-1:1;
    const g=this.game,p=g.p,vertical=this.lesson===2;
    g.enemies.push({id:g.nextId++,type:'seek',x:p.x+(vertical?0:this.blockedSign*72),y:p.y+(vertical?this.blockedSign*72:0),px:p.x+(vertical?0:this.blockedSign*72),py:p.y+(vertical?this.blockedSign*72:0),vx:0,vy:0,age:0,cue:1.8,cueDuration:1.8,r:12,spin:1,phase:0,hp:1,flash:0});
    this.flankEnemy=g.enemies[g.enemies.length-1];
    this.blockedName=vertical?(this.blockedSign<0?'上方':'下方'):(this.blockedSign<0?'左侧':'右侧');
    this.message=`侧翼选择：${this.blockedName}有第二名追迹者。先观察两个红色预警，点射一发，选择空侧让开回弹并截击身后敌人。每次重练侧翼交替，不计成绩。`;
  }
  step(dt,input){
    const eventStart=this.game.events.length;
    super.step(dt,input);
    if(this.status==='failed'&&this.failure==='enemy'){
      const source=this.game.events.slice(eventStart).find(e=>e.type==='hurt')?.source;
      if(source?.kind==='seek'&&this.flankEnemy&&source.x===this.flankEnemy.x&&source.y===this.flankEnemy.y){
        this.message=`被${this.blockedName}的侧翼追迹者撞到：观察两个红色预警，选择另一侧的空隙让开回弹。重练将交换受压侧，不计成绩。`;
      }
    }
if(this.status==='success')this.message='侧翼截击成功：避开侧翼追击，单发回弹击杀身后目标。重练会交换受压侧；不计成绩。';else if(this.status==='active'&&!this.message.startsWith('侧翼'))this.message=`侧翼${this.blockedName}受压，观察空侧再移动。${this.message}`;}
}
