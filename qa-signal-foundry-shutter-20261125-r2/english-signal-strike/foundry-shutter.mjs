// The two shutters occupy optional inner lanes beyond the existing first isolators.
// One source of truth for real collision, visible leaf and spent/open status.
export function foundryShutter(world,node){
 if(world.map.id!=="foundry"||node.kind!=="isolator"||node.zone!==0||![-1,1].includes(node.side))return null;
 return {x:node.side*5.9,y:1.26,z:-33.1,hx:.98,hy:1.26,hz:.18,kind:"foundry-shutter",operation:node.id};
}
