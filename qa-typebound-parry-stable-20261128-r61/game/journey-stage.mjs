import {WispSightlineStage} from "../../qa-typebound-wisp-sightline-20261126-r4/game/wisp-sightline.mjs?v=qa-typebound-wisp-sightline-20261126-r4";
import {fitJourneyRig} from "./arena-close.mjs";
export class CloseJourneyStage extends WispSightlineStage {
 resize(...args){
  super.resize(...args);
  const scale=fitJourneyRig({width:this.w,height:this.h,original:this.scale,wide:this.wide});
  if(scale!==this.scale){this.scale=scale;this.backdropKey="";}
 }
}
