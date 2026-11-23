import {hurtbox,moveFor} from '../qa-fury-mei-heavy-windup-20261121-r1/engine/combat.mjs';
import {GroundedFight} from './grounded-fight.mjs';

const STUDY_TICKS=116, STUDY_GAP=.22, ARM_GAP=.36, WAIT_TICKS=45, RESET_TICKS=122;
export class RangeResponseFight extends GroundedFight {
  #swing=null;
  #past=[];
  #plan=null;
  #receipt=null;
  #next=0;
  #answer=null;
  standingKickCue(){return this.state==='fight'?this.#receipt:null;}
  #eligible(){return this.mode==='arcade'&&this.f[0].c.id==='mei'&&this.f[1].c.id==='lin';}
  #gap(){return Math.abs(this.f[0].x-this.f[1].x);}
  #reach(side){const actor=this.f[side], target=this.f[1-side];return moveFor(actor,'kick').range*actor.c.size+hurtbox(target).w/2;}
  #stamp(phase, reason, context={}){
    this.#receipt=Object.freeze({phase,frame:this.frame,gap:this.#gap(),reach:this.#reach(0),reason,...context});
  }
  #retire(reason){
    this.#plan=null;this.#past=[];
    this.#next=this.frame+RESET_TICKS;
    this.f[1].held.delete('left');this.f[1].held.delete('right');
    this.#stamp('reset',reason);
  }
  #walk(side, towards){
    const actor=this.f[side];
    const positive=this.f[1-side].x>actor.x;
    const right=towards===positive;
    actor.held.clear();actor.held.add(right?'right':'left');
  }
  step(){
    const previousVictim=this.f[0].action?.serial;
    super.step();
    if(!this.#eligible()||this.state!=='fight')return;
    const player=this.f[0], k=player.action;
    if(this.#answer){
      const a=this.#answer, attack=this.events.find(e=>e.type==='attack'&&e.side===1&&e.name==='kick');
      if(attack && a.nativeSerial==null && this.frame-a.queuedFrame<=2)a.nativeSerial=this.f[1].action?.serial;
      const hit=this.events.find(e=>e.type==='hit'&&e.side===1&&e.target===0&&e.name==='kick'&&e.punish);
      if(hit && a.nativeSerial!=null && a.nativeSerial===this.f[1].action?.serial && previousVictim===a.targetSerial){
        this.#stamp('counter-hit','native-punish',{swingFrame:a.swingFrame,activeEnd:a.whiffFrame,nativeFrame:hit.frame,damage:hit.damage});
        this.#answer=null;
      }else if(this.frame-a.queuedFrame>14 || (a.nativeSerial!=null && this.f[1].action?.serial!==a.nativeSerial))this.#answer=null;
    }
    const observed=this.events.find(e=>e.type==='swing'&&e.side===0);
    if(observed){
      if(observed.name==='kick'&&k?.name==='kick'){
        this.#swing={serial:k.serial,frame:this.frame,gap:this.#gap(),outcome:'whiff',observedPhase:this.#plan?.phase};
      }else{
        this.#swing=null;
        if(this.#plan?.phase==='toe-out')this.#retire('different-move');
      }
    }
    const seen=this.#swing;
    if(!seen)return;
    const contact=this.events.find(e=>e.side===0&&e.name==='kick'&&['hit','block'].includes(e.type));
    if(contact)seen.outcome=contact.type;
    const same=k?.serial===seen.serial;
    if(same&&k.frame<k.spec.startup+k.spec.active)return;
    // A startup cancelled by the rival is not a spacing whiff; distinguish it
    // from a completed untouched active window.
    if(!same&&!contact){this.#swing=null;return;}
    this.#past.push(Object.freeze({frame:seen.frame,gap:seen.gap,outcome:seen.outcome}));
    this.#past=this.#past.filter(s=>this.frame-s.frame<=STUDY_TICKS).slice(-4);
    this.#swing=null;
    if(this.#plan?.phase!=='toe-out'||seen.observedPhase!=='toe-out')return;
    if(seen.outcome!=='whiff'||seen.gap<this.#reach(0)+.03){this.#retire('contact-or-moved');return;}
    if(same&&k.frame>=k.spec.startup+k.spec.active){
      this.#plan={...this.#plan,phase:'close',whiffFrame:this.frame,swingFrame:seen.frame,serial:seen.serial};
      this.#stamp('close','kick-whiff',{swingFrame:seen.frame,activeEnd:this.frame,recordedGap:seen.gap});
    }
  }
  ai(){
    if(!this.#eligible())return super.ai();
    const [player,foe]=this.f, gap=this.#gap(), reach=this.#reach(0), plan=this.#plan;
    if(!plan&&this.#receipt&&this.frame-this.#receipt.frame>35)this.#receipt=null;
    if(plan){
      if(foe.hp===0||foe.stun||foe.freeze||foe.action||foe.down){
        this.#retire('rival-engaged');
        return super.ai();
      }
      if(plan.phase==='step-out'){
        if(Math.abs(player.x-plan.anchor)>.28||this.frame-plan.start>26){this.#retire('changed-distance');return super.ai();}
        if(gap>=reach+.14){
          foe.held.clear();
          this.#plan={...plan,phase:'toe-out',waitStart:this.frame};
          this.#stamp('toe-out','out-of-range');
        }else this.#walk(1,false);
        return;
      }
      if(plan.phase==='toe-out'){
        if(Math.abs(player.x-plan.anchor)>.28||gap<reach+.04||gap>reach+.51){this.#retire('changed-distance');return super.ai();}
        if(this.frame-plan.waitStart>=WAIT_TICKS){this.#retire('no-kick');return super.ai();}
        foe.held.clear();return;
      }
      if(plan.phase==='close'){
        const a=player.action;
        if(a?.serial!==plan.serial||a.frame<a.spec.startup+a.spec.active||a.connected){
          this.#retire('recovered');return super.ai();
        }
        const ready=this.#reach(1)-.08;
        if(gap<=ready&&a.spec.startup+a.spec.active+a.spec.recovery-a.frame>=6){
          this.#retire('counter-attempt');
          this.#answer={targetSerial:plan.serial,swingFrame:plan.swingFrame,whiffFrame:plan.whiffFrame,queuedFrame:this.frame,nativeSerial:null};
          this.queue(foe,'kick'); // Native kick, no guaranteed impact.
          return;
        }
        if(gap>reach+.70){this.#retire('changed-distance');return super.ai();}
        this.#walk(1,true);return;
      }
    }
    const recent=this.#past.filter(s=>this.frame-s.frame<=STUDY_TICKS),
          ref=recent.at(-1), similar=recent.filter(s=>ref&&Math.abs(s.gap-ref.gap)<=STUDY_GAP);
    const free=!foe.action&&!foe.freeze&&!foe.stun&&!foe.down&&!foe.aiQueue&&!foe.buffer.length&&foe.y===0;
    if(this.frame>=this.#next&&this.frame>=foe.aiNext&&free&&similar.length>=3&&
       gap>=1.30&&gap<=reach+.36&&Math.abs(gap-ref.gap)<=ARM_GAP){
      this.#plan={phase:'step-out',start:this.frame,anchor:player.x};
      this.#stamp('step-out','repeat-standing-kick',{observations:similar.length,lastSwingFrame:ref.frame});
      this.#walk(1,false);return;
    }
    return super.ai();
  }
}
