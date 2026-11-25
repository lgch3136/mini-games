// The same atlas supplies the name, contrast plate, team shape and player mark in one draw.
const atlases=new WeakMap();
function nameAtlas(T,names) {
  if(atlases.has(T))return atlases.get(T);
  const width=192,height=52,canvas=document.createElement("canvas");
  canvas.width=width*5;canvas.height=height*3;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("无法生成角色名牌");
  for(let row=0;row<3;row++)for(let hero=0;hero<5;hero++){
    const x=hero*width,y=row*height,enemy=row===1,self=row===2;
    ctx.save();ctx.translate(x,y);ctx.lineJoin="round";ctx.textAlign="center";ctx.textBaseline="middle";
    const name=names[hero];
    ctx.font='600 34px "Noto Sans CJK SC","PingFang SC",sans-serif';
    const nameWidth=Math.min(147,ctx.measureText(name).width);
    const markerX=(width-nameWidth-17)/2;
    ctx.strokeStyle="rgba(25,34,36,.94)";ctx.lineWidth=5;
    ctx.fillStyle=enemy?"#ffc0ac":self?"#ffde83":"#9fe9ef";ctx.beginPath();
    if(self){ctx.moveTo(markerX+6,16);ctx.lineTo(markerX+13,25);ctx.lineTo(markerX+6,34);ctx.lineTo(markerX-1,25);}
    else if(enemy){ctx.moveTo(markerX,18);ctx.lineTo(markerX+13,18);ctx.lineTo(markerX+6.5,32);}
    else ctx.arc(markerX+6,25,5.6,0,Math.PI*2);
    ctx.closePath();ctx.stroke();ctx.fill();
    const nameX=markerX+18+nameWidth/2;
    ctx.lineWidth=5.5;ctx.strokeText(name,nameX,27,nameWidth);
    ctx.fillStyle=enemy?"#ffe6da":"#fff5d6";ctx.fillText(name,nameX,27,nameWidth);ctx.restore();
  }
  const map=new T.CanvasTexture(canvas);
  map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=T.LinearFilter;map.magFilter=T.LinearFilter;
  atlases.set(T,map);return map;
}
export function heroTag(T,names,hero,team,player) {
  const column=Math.max(0,Math.min(4,hero|0)),row=player?2:team===1?1:0;
  const group=new T.Group(),geometry=new T.PlaneGeometry(2.28,.62),uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(column+uv.getX(i))/5,(2-row+uv.getY(i))/3);
  const material=new T.MeshBasicMaterial({map:nameAtlas(T,names),transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
  const mesh=new T.Mesh(geometry,material);mesh.renderOrder=31;group.add(mesh);
  return {group,faceCamera(camera){group.quaternion.copy(camera.quaternion);},
    dispose(){group.removeFromParent();geometry.dispose();material.dispose();}};
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
export function teamCloth(T,hero,team,hip,arms,attach,cylinder) {
  const dye=team===1?0xda697b:0x48b7c0,edge=team===1?0xf4b38b:0xaddfd6;
  const side=team===1?-1:1;
  // Broad seams wrap across front, outer shoulder, and back; they stay visible while turning.
  const path=[[-.18*side,.13,.24],[.12*side,.47,.24],[.28*side,.70,.17],[.31*side,.74,-.04],
    [.24*side,.66,-.20],[.03*side,.40,-.25],[-.18*side,.14,-.22]];
  function strip(thickness,offset,colour){
    const pos=[],index=[];
    for(const [x,y,z] of path)pos.push(x-thickness+offset,y,z,x+thickness+offset,y,z);
    for(let i=0;i+1<path.length;i++){const j=i*2;index.push(j,j+1,j+2,j+1,j+3,j+2);}
    const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(pos,3));
    geo.setIndex(index);geo.computeVertexNormals();
    attach(hip,geo,colour);
  }
  strip(.036,0,dye);strip(.009,.043*side,edge);
  const arm=arms[team===1?0:1],rad=hero===3?.155:hero===4?.119:.142;
  cylinder(arm,dye,0,-.205,0,rad,rad*.92,.11);
  cylinder(arm,edge,0,-.27,0,rad*.93,rad*.91,.021);
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
