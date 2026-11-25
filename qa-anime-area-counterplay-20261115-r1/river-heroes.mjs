// Nameplates are display-space lettering. The player's own level and health
// share that resolution; other units retain the depth-tested bar in the world.
export function heroTag(layer,name,team,player){
  const append=(parent,tag,style)=>{
    const node=document.createElement(tag);node.className=style;parent.appendChild(node);return node;
  };
  const label=append(layer,"span","world-name "+(player?"self":team===1?"foe":"ally"));
  label.textContent=name;label.hidden=true;
  let plate,digit,track,trail,shield,life;
  if(player){
    plate=append(layer,"span","self-vitals");plate.hidden=true;
    digit=append(plate,"b","vitals-level");track=append(plate,"span","vitals-track");
    trail=append(track,"i","vitals-trail");shield=append(track,"i","vitals-shield");life=append(track,"i","vitals-life");
  }
  let namePlaced=false,barPlaced=false;
  function place(node,x,y,density){
    const px=Math.round(x*density)/density,py=Math.round(y*density)/density;
    if(node.screenX===px&&node.screenY===py)return;
    node.screenX=px;node.screenY=py;node.style.transform="translate("+px+"px,"+py+"px)";
  }
  function dimension(node,property,value){
    const px=Math.round(value*100)/100+"px";
    if(node.style[property]!==px)node.style[property]=px;
  }
  function amount(node,fraction){
    const value=Math.round(Math.min(1,Math.max(0,fraction))*10000)/10000;
    if(node.fraction!==value){node.fraction=value;node.style.transform="scaleX("+value+")";}
  }
  // Reserve the native 9 px lettering, the team mark and its stroke at map zoom.
  const minWidth=Math.ceil(9*(Array.from(name).length+.86)+3);
  return {wanted:false,minWidth,
    placeName(box,density){
      namePlaced=true;place(label,box.left,box.top,density);
      const height=box.bottom-box.top;
      dimension(label,"width",box.right-box.left);dimension(label,"height",height);
      dimension(label,"fontSize",Math.min(14,Math.max(9,height*.69)));
    },
    placeVitals(box,w,h,rank,hp,after,guard,flash,density){
      if(!plate)return;
      barPlaced=true;place(plate,box.left,box.top,density);
      const badge=box.bottom-box.top;
      dimension(digit,"width",badge);dimension(digit,"height",badge);
      dimension(digit,"fontSize",Math.max(9,badge*.69));dimension(track,"width",w);dimension(track,"height",h);
      const text=String(rank);if(digit.textContent!==text)digit.textContent=text;
      amount(life,hp);amount(trail,after);amount(shield,guard);
      const lit=flash>.16;if(life.classList.contains("hit")!==lit)life.classList.toggle("hit",lit);
    },
    suppressName(){namePlaced=false;},
    paint(){
      if(label.hidden===namePlaced)label.hidden=!namePlaced;
      if(plate&&plate.hidden===barPlaced)plate.hidden=!barPlaced;
      namePlaced=barPlaced=false;
    },
    dispose(){label.remove();plate?.remove();}
  };
}
const awayPalette=[
  new Map([[15958566,0xcd543b],[15262669,0xbf573f]]),
  new Map([[3312483,0xb05164],[2696751,0x632e48]]),
  new Map([[1647160,0x472e4a]]),
  new Map([[15821593,0xcb593d],[2380435,0x59477d]]),
  new Map([[12923698,0x9c3150],[3636402,0x49476a]])
];
export function costumeColour(hero,team,colour) {
  return team===1?(awayPalette[hero]?.get(colour)??colour):colour;
}
const rests=[
  {l:[-.26,.15,-.18],r:[.38,-.12,.19],twist:.12,lean:.11,drop:.04},
  {l:[-.63,.32,-.18],r:[-.79,-.43,.25],twist:-.32,lean:.07,drop:.06},
  {l:[.11,.16,.21],r:[-.94,-.21,-.08],twist:.26,lean:-.045,drop:.025},
  {l:[-.96,.31,-.28],r:[-.84,-.42,.32],twist:.28,lean:.10,drop:.075},
  {l:[-.41,.23,-.32],r:[-.54,-.22,.44],twist:-.18,lean:.035,drop:.035}
];
export function setHeroGait(hero,t,phase,amount,hip,head,arms,legs) {
  const rest=rests[hero]||rests[0],weight=Math.max(0,Math.min(1,amount)),beat=Math.sin(phase)*weight;
  const breath=Math.sin(t*2.4+hero)*.009*(1-weight),ready=1-weight*.58;
  hip.position.y=.84-rest.drop*ready+.038*Math.abs(beat)+breath;
  hip.rotation.set(rest.lean*ready+(hero===0?.19:.075)*weight,rest.twist*ready+beat*.065,-beat*.035);
  head.rotation.y=-hip.rotation.y*.62;head.rotation.z=beat*.025;head.rotation.x=-hip.rotation.x*.36;
  legs[0].rotation.set(beat*.52+.10*ready,.05,-.055*ready);
  legs[1].rotation.set(-beat*.52-.09*ready,-.05,.055*ready);
  for(let j=0;j<2;j++){
    const base=j?rest.r:rest.l,wave=(j?1:-1)*beat;
    arms[j].rotation.set(base[0]*ready+(hero===0?.64*weight:wave*.44),base[1]*ready,base[2]*ready+wave*.08);
  }
}
