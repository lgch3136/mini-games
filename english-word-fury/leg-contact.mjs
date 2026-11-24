// Three points along each kicking limb, measured in the active cel's source pixels.
// High roundhouses make contact with the painted boot. Close opponents can overlap the shin.
const linFront = [[91,104],[169,84],[208,69]];
const linHigh = [[222,41],[229,39],[236,37]];
const linSweep = [[111,118],[219,130],[262,137]];
const linAir = [[101,118],[212,97],[265,96]];
const meiFront = [[82,117],[157,99],[194,90]];
const meiHigh = [[194,51],[201,48],[208,44]];
const meiSweep = [[119,164],[220,182],[265,192]];
const meiAir = [[99,138],[218,112],[265,108]];
const knee = [[100,112],[135,83],[159,78]];
const stockHigh = [[126,103],[205,53],[277,25]];
const stockLow = [[115,159],[171,148],[234,166]];
const stockSweep = [[120,164],[183,155],[245,175]];
const normal = {
  lin:{kick:linFront,highKick:linHigh,lowKick:linSweep,sweep:linSweep,airKick:linAir},
  mei:{kick:meiFront,highKick:meiHigh,lowKick:meiSweep,sweep:meiSweep,airKick:meiAir},
  shan:{kick:knee,highKick:stockHigh,lowKick:stockLow,sweep:stockSweep,airKick:stockHigh}
};
const iron = {
  highKick:[[78,65],[121,57],[164,48]],
  lowKick:[[77,104],[113,117],[146,122]],
  sweep:[[102,110],[142,119],[183,130]]
};

export function legContactLine(fighter,move,useIron){
  return (fighter==="shan"&&useIron&&iron[move])||normal[fighter]?.[move];
}

export function contactOnLeg(line,cell,size,facing,anchorX,anchorY,opponentX){
  const [, , width,height,dx,dy,drawWidth=width,drawHeight=height]=cell;
  const scaleX=size*drawWidth/(2*width);
  const scaleY=size*drawHeight/(2*height);
  const originX=Math.round(anchorX)+facing*dx*size;
  const originY=Math.round(anchorY)+dy*size;
  const xOnCel=facing*(opponentX-originX)/scaleX;
  const start=xOnCel<=line[1][0]?line[0]:line[1];
  const end=xOnCel<=line[1][0]?line[1]:line[2];
  const x=Math.max(start[0],Math.min(end[0],xOnCel));
  const u=(x-start[0])/(end[0]-start[0]);
  const y=start[1]+(end[1]-start[1])*u;
  return [originX+facing*x*scaleX,originY+y*scaleY];
}
