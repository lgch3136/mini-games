import {CleanRelay,STAGES,MOVE_BUDGET} from './distinct-relay.mjs?v=20261114-r1';
export {STAGES,MOVE_BUDGET};
export const STAGE_LIMIT=16;
// Optional stage-local challenge. Original movement, damage and pickups stay authoritative.
export class TightRelay extends CleanRelay {
  constructor(){super();this.tight=false;}
  chooseTight(enabled){if(this.state!=='ready')return false;this.tight=enabled===true;return true;}
  reset(){super.reset();this.tight=false;}
  start(){const ok=super.start();if(ok&&this.tight)this.message='每图独立16步：A → R → C。空余步数不带到下一图；第16步取齐仍可过关。';return ok;}
  resume(){const ok=super.resume();if(ok&&this.tight)this.message=`继续第${this.stage+1}图，本图还剩${Math.max(0,STAGE_LIMIT-this.game.steps)}步。`;return ok;}
  next(){const ok=super.next();if(ok&&this.tight)this.message+= ' 本图重新获得16步。';return ok;}
  step(direction){
    const lettersBefore=this.game.letters;
    const targetLabel=this.game.tiles.find(t=>t.id===this.game.cursor)?.label;
    const ok=super.step(direction);
    if(!ok||!this.tight)return ok;
    // Completion at the exact boundary wins; production collisions always remain losses.
    if(this.state==='running'&&this.game.steps>=STAGE_LIMIT){
      this.finish('budget');this.reason='stage-budget';this.message='本图16步已用完，字母还没取齐。挑战结束；可进不限步练习，试着缩短绕路。';
    }else if(this.state==='running')this.message=(this.game.letters>lettersBefore?`取到 ${targetLabel.toUpperCase()}！`:'已走一格。')+`本图剩${STAGE_LIMIT-this.game.steps}步，松手可随时观察。`;
    else if(this.state==='between')this.message=`第${this.stage+1}图16步挑战通过，用${this.game.steps}步。下一图重新给16步，余步不结转。`;
    else if(this.state==='won')this.message=`每图16步挑战完成！三图共${this.totalSteps}步，原60步接力未计入。`;
    return ok;
  }
}
