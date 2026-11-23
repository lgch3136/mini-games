import {Fight,hurtbox,moveFor} from '../qa-fury-mei-heavy-windup-20261121-r1/engine/combat.mjs';

// This input surface is only for the grounded round. Do not remap classic.
export const groundedKeys=new Set(['left','right','down','guard','A','B','C']);
export const groundedMoves=new Set(['jab','kick','lowKick','punch']);
export class GroundedFight extends Fight {
  #read=[];
  #guardReadUntil=0;
  #nextGuardRead=0;
  #mixed=0;
  step(){
    super.step();
    // Observable released swings only; a mistaken press, queued move or
    // cancelled startup cannot add to the pattern.
    if(this.state!=='fight')return;
    const swing=this.events.find(e=>e.type==='swing'&&e.side===0);
    if(!swing)return;
    this.#read=this.#read.filter(e=>this.frame-e.frame<=90);
    if(swing.name==='lowKick')this.#mixed=0;
    else if(++this.#mixed>=2){this.#read=[];this.#mixed=0;}
    this.#read.push({low:swing.name==='lowKick',frame:this.frame});
    if(this.#read.length>4)this.#read.shift();
  }
  ai(){
    if(this.mode!=='arcade')return super.ai();
    const [hero,foe]=this.f;
    if(this.#guardReadUntil){
      if(this.frame<this.#guardReadUntil&&!foe.action&&!foe.down&&foe.state!=='hurt'){
        foe.held.add('guard');foe.held.add('down');return;
      }
      foe.held.delete('guard');foe.held.delete('down');
      this.#guardReadUntil=0;
    }
    const recent=this.#read.filter(e=>this.frame-e.frame<=90);
    if(this.frame>=this.#nextGuardRead&&this.frame>=foe.aiNext&&this.frame-recent.at(-1)?.frame>=5&&
       !foe.action&&!foe.freeze&&!foe.stun&&!foe.down&&!foe.aiQueue&&!foe.buffer.length&&foe.y===0&&
       Math.abs(hero.x-foe.x)<=2.05&&recent.filter(e=>e.low).length>=3){
      foe.held.clear();foe.held.add('guard');foe.held.add('down');
      this.#guardReadUntil=this.frame+18;this.#nextGuardRead=this.frame+135;
      return;
    }
    return super.ai();
  }
  input(side,key,on=true){
    if(!groundedKeys.has(key))return;
    const down=this.f[side].held.has('down');
    // Public rules: J and U are standing only; never reinterpret S+J/S+U.
    if(down&&(key==='A'||key==='C'))return;
    const press=key==='A'?'jab':key==='C'?'punch':key==='B'?(down?'lowKick':'kick'):key;
    super.input(side,press,on);
  }
  queue(f,key){
    if(key==='A')key='jab';
    else if(key==='B')key=f.held.has('down')?'lowKick':'kick';
    else if(key==='C')key='punch';
    if(f.side===1&&this.mode==='arcade'){
      if(key==='overhead'||key==='upper')key='punch';
      if(key==='punch'){
        const target=this.f[0], normal=moveFor(f,'punch'), h=hurtbox(target);
        const lower=f.y+(normal.y-normal.h/2)*f.c.size;
        if(target.crouch && h.y+h.h<lower)key='kick';
      }
    }
    if(groundedMoves.has(key)){super.queue(f,key);return;}
    // The original arcade AI still picks its action for current range, guard,
    // whiff, reaction and cooldown. Only unavailable actions are translated.
    if(f.side!==1||this.mode!=='arcade')return;
    if(key==='D')super.queue(f,'kick');
    else if(key==='throw'||key==='grab')super.queue(f,'lowKick');
    else if(['jump','run','rush','wave','super','max'].includes(key)){
      if(!f.action && !f.stun && !f.down && Math.abs(this.f[0].x-f.x)>1.40){
        f.held.delete('down');f.held.delete('guard');
        const towards=this.f[0].x>f.x?'right':'left';
        f.held.delete(towards==='left'?'right':'left');f.held.add(towards);
      }
    }else if(key==='roll'&&!f.action&&!f.stun&&!f.down){
      f.held.delete('left');f.held.delete('right');f.held.add('guard');
    }
  }
  start(f,key){
    return groundedMoves.has(key)&&f.y===0&&super.start(f,key);
  }
}
