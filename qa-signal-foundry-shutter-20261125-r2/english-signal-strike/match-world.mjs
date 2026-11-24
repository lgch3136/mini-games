import { Strike } from "../../qa-signal-aim-charge-20261116-r1/english-signal-strike/world.mjs?v=20260918-play-r1&quality2=20261001-action-r1&mobile=20261002-quality4-r1";
import {foundryShutter} from "./foundry-shutter.mjs";
export class FoundryStrike extends Strike{
 blockers(){
  const stock=super.blockers();
  for(const node of this.objectives??[]){
   if(node.done)continue;
   const shutter=foundryShutter(this,node);
   if(shutter)stock.push(shutter);
  }
  return stock;
 }
 activateOperation(node,cause){
  const already=node.done;
  super.activateOperation(node,cause);
  if(!already&&node.done&&foundryShutter(this,node)){
   const op=this.events.findLast(e=>e.type==="operation"&&e.id===node.id);
   if(op)op.effect+=" · 同侧门升起";
  }
 }
}
