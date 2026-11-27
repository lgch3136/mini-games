import {FoundryStrike} from "../../qa-signal-foundry-shutter-20261125-r2/english-signal-strike/match-world.mjs";
import {WEAPONS} from "../../qa-signal-aim-charge-20261116-r1/english-signal-strike/world.mjs?v=20260918-play-r1&quality2=20261001-action-r1&mobile=20261002-quality4-r1";
import {rayBox} from "../../qa-signal-aim-charge-20261116-r1/shared/first-person/math.mjs?mobile=20261002-quality4-r1";
import {rifleShotRead} from "./shot-read.mjs";
export class ReadableStrike extends FoundryStrike{
  shot(input){
    const start=this.events.length;
    super.shot(input);
    const shot=this.events.at(-1);
    if(this.map.id!=="foundry"||this.events.length===start||shot?.type!=="shot"||shot.weapon!==0)return;
    // Misses leave the collision geometry untouched. Attaching metadata cannot change the ray or scoring.
    const armored=this.events.slice(start,-1).some(e=>e.type==="armor");
    const read=rifleShotRead({shot,armored,blockers:shot.hit||armored?[]:this.blockers(),rayBox,range:WEAPONS[0].range});
    if(read)shot.read=read;
  }
}
