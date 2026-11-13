import {createCoilGame} from './coil.mjs?v=20261103-route-segment-r1';
import {CoilRoute} from './route-recap.mjs?v=20261103-route-segment-r1';

export const MOVE_BUDGET=60;
export const STAGES=Object.freeze(['绕开盘身','穿过尾门','沿槽回转']);
// Authored starting boards only. Collision, turning, pickup and growth remain production rules.
export function createRelayBoard(stage) {
  if(!Number.isInteger(stage)||stage<0||stage>=STAGES.length) throw new RangeError('Unknown relay stage');
  const g=createCoilGame();
  if(stage>0){
    const boards=[null,
      {trail:[[6,5],[5,5],[4,5],[4,6],[4,7],[5,7],[6,7],[7,7],[8,7]],tiles:[[7,6],[8,8],[5,8]],direction:0},
      {trail:[[8,4],[8,5],[8,6],[7,6],[6,6],[5,6],[5,5],[5,4],[5,3],[6,3],[7,3]],tiles:[[7,4],[6,5],[9,7]],direction:3}
    ];
    const b=boards[stage];
    g.trail=b.trail.map(([x,y])=>({x,y}));g.head={...g.trail[0]};g.length=b.trail.length;g.direction=b.direction;
    g.tiles=b.tiles.map(([x,y],id)=>({x,y,id,label:'arc'[id],correct:true}));
  }
  g.challenge=`distinct-routes-20261114-r1-${stage}`;
  g.route=new CoilRoute(g.head,g.trail.slice(0,g.length));
  return g;
}
export class CleanRelay {
  constructor(){this.reset();}
  reset(){
    this.stage=0;this.totalSteps=0;this.results=[];this.state='ready';this.paused=false;
    this.game=createRelayBoard(0);this.reason='';this.message='三张图共60步，碰撞即结束。按“开始接力”后再选方向。';
  }
  get remaining(){return Math.max(0,MOVE_BUDGET-this.totalSteps);}
  start(){
    if(this.state!=='ready') return false;
    this.state='running';this.message='第一图：按 A → R → C 取字，注意盘身让路。';return true;
  }
  pause(){
    if(this.state!=='running'||this.paused) return false;
    this.paused=true;this.message='已暂停。点击继续后，仍需每次按键才走一格。';return true;
  }
  resume(){
    if(this.state!=='running'||!this.paused) return false;
    this.paused=false;this.message=`继续第${this.stage+1}图，还剩${this.remaining}步。`;return true;
  }
  next(){
    if(this.state!=='between') return false;
    this.stage++;this.game=createRelayBoard(this.stage);this.state='running';this.paused=false;
    this.message=`第${this.stage+1}图 · ${STAGES[this.stage]}。看清新的起点、朝向和身体，再选方向。`;return true;
  }
  finish(reason){
    this.reason=reason;this.state=reason==='complete'?'won':'lost';this.paused=false;
    this.game.setPaused(true);this.game.clearInput();
    const reasons={complete:`三图接力完成！用${this.totalSteps}步，还剩${this.remaining}步。`,
      body:'碰到身体，接力结束。可以先在不限步练习里试另一条路线。',
      wall:'碰到护栏，接力结束。接力不使用护栏救援继续闯关。',
      budget:'60步已用完，接力结束。重来时试着少绕几格。'};
    this.message=reasons[reason];
  }
  step(direction){
    const g=this.game;
    if(this.state!=='running'||this.paused||!Number.isInteger(direction)||direction<0||direction>3) return false;
    if(direction===(g.direction+2)%4){this.message='不能直接掉头，本次不走格也不扣步数。';return false;}
    const before=g.eventSerial,steps=g.steps,hits=g.hits;
    g.setPaused(false);
    if(direction!==g.direction&&!g.input(direction)){
      g.setPaused(true);this.message='转向未接受，本次不走格也不扣步数。';return false;
    }
    // Stop at the first production damage event, even if the guard rail auto-turns.
    for(let i=0;i<4&&g.phase==='playing'&&g.hits===hits;i++)g.update(.05);
    g.setPaused(true);this.totalSteps+=g.steps-steps;
    const events=g.events.filter(e=>e.id>before),hurt=events.find(e=>e.type==='hurt');
    if(hurt){this.finish(hurt.reason==='wall'?'wall':'body');return true;}
    if(g.won){
      this.results.push({stage:this.stage,name:STAGES[this.stage],steps:g.steps,pickups:g.route.pickups.map(p=>({...p}))});
      if(this.stage===STAGES.length-1){this.finish('complete');return true;}
      if(this.remaining===0){this.finish('budget');return true;}
      this.state='between';this.message=`第${this.stage+1}图完成，用${g.steps}步。还剩${this.remaining}步；准备好后进入下一图。`;return true;
    }
    if(this.remaining===0){this.finish('budget');return true;}
    const eat=events.find(e=>e.type==='eat');
    this.message=eat?`取到 ${eat.label.toUpperCase()}！三图共剩${this.remaining}步。`:`已走一格。三图共剩${this.remaining}步，松手可随时观察。`;
    return true;
  }
}
