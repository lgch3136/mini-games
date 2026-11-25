// Offline portrait studio. It photographs the five actual battle rigs with a small
// software rasterizer. Node, @napi-rs/canvas, and the game's pinned Three build are the inputs.
const {readFileSync,writeFileSync,existsSync}=require("node:fs");
const {resolve,join}=require("node:path");
const {pathToFileURL}=require("node:url");
const {createCanvas,Path2D}=require("@napi-rs/canvas");
global.Path2D=Path2D;
global.document={createElement:()=>createCanvas(1,1)};
const here=__dirname,dir=pathToFileURL(here+"/");
const W=320,H=400,texels=new WeakMap();
function tex(map){
  if(!map)return null;
  if(!texels.has(map)){const c=map.image;texels.set(map,c.getContext("2d").getImageData(0,0,c.width,c.height));}
  return texels.get(map);
}
const gamma=n=>n<=.00313?12.92*n:1.055*Math.pow(n,1/2.4)-.055;
function photograph(T,model,hero,full=false){
  model.teamRing.visible=false;
  model.animate(.64,false,0,0,null,0,0);
  if(full){
    const skill=[0,0,1,2,0][hero],action={kind:"skill",skillIndex:skill,face:0,windup:.5,recover:.38,duration:.88,elapsed:0};
    const hold=[.29,.41,.26,.30,.23][hero];
    for(let tick=0;tick<=Math.round(hold*60);tick++){
      action.elapsed=tick/60;model.animate(1+action.elapsed,false,0,0,action,0,0);
    }
  }
  if(hero!==1){
    model.head.rotation.y+=[-.07,0,.09,-.19,-.09][hero];
    model.arms[hero===4?0:1].rotation.x-=hero===2?.12:.22;
    model.arms[0].rotation.z+=.05;model.arms[1].rotation.z-=.07;
  }
  model.g.updateMatrixWorld(true);
  const cam=new T.OrthographicCamera(-1,1,1,-1,.1,30);
  const look=new T.Vector3(0,hero===1?1.42:1.74,.02);
  const span=full?3.2:[1.37,1.79,1.40,1.54,1.42][hero],yaw=(full?[.37,-.37,-.39,.52,-.52]:[.22,-.18,-.18,.35,-.24])[hero];
  cam.left=-span*W/H/2;cam.right=-cam.left;cam.top=span/2;cam.bottom=-cam.top;
  cam.position.set(look.x+Math.sin(yaw)*7,look.y+.50,look.z+Math.cos(yaw)*7);cam.lookAt(look);
  cam.updateProjectionMatrix();cam.updateMatrixWorld();
  const corner=new T.Vector3();let top=-Infinity,bottom=Infinity,left=Infinity,right=-Infinity;
  model.g.traverseVisible(node=>{
    if(!node.isMesh||node.material.transparent)return;
    for(let i=0;i<node.geometry.attributes.position.count;i++){
      node.getVertexPosition(i,corner).applyMatrix4(node.matrixWorld).project(cam);
      top=Math.max(top,corner.y);bottom=Math.min(bottom,corner.y);left=Math.min(left,corner.x);right=Math.max(right,corner.x);
    }
  });
  let rise=(top-.875)*span/2;
  const shift=new T.Vector3();
  if(full){
    const fitted=span*Math.max((top-bottom)/1.70,(right-left)/1.76);
    cam.top=fitted/2;cam.bottom=-cam.top;cam.right=cam.top*W/H;cam.left=-cam.right;cam.updateProjectionMatrix();
    rise=(top+bottom)*span/4-.035*fitted/2;
    shift.set(1,0,0).applyQuaternion(cam.quaternion).multiplyScalar((right+left)*span*W/H/4);
  }
  const frameUp=new T.Vector3(0,1,0).applyQuaternion(cam.quaternion).multiplyScalar(rise).add(shift);
  cam.position.add(frameUp);look.add(frameUp);cam.lookAt(look);cam.updateMatrixWorld();
  const canvas=createCanvas(W,H),ctx=canvas.getContext("2d");
  const colors=[["#364d55","#80684b"],["#264856","#568e98"],["#363d54","#5b6b81"],["#394759","#926c52"],["#38505b","#8c7060"]][hero];
  if(full){
    ctx.save();ctx.translate(W*.5,H*.912);ctx.scale(1,.16);
    const contact=ctx.createRadialGradient(0,0,0,0,0,W*.39);
    contact.addColorStop(0,"#101e22b5");contact.addColorStop(.6,"#12282e73");contact.addColorStop(1,"#12282e00");
    ctx.fillStyle=contact;ctx.fillRect(-W*.4,-W*.4,W*.8,W*.8);ctx.restore();
  }else{
  const bg=ctx.createLinearGradient(0,H,W,0);bg.addColorStop(0,"#202f38");bg.addColorStop(.6,colors[0]);bg.addColorStop(1,colors[1]);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  const halo=ctx.createRadialGradient(W*.47,H*.38,0,W*.47,H*.38,W*.7);halo.addColorStop(0,"#f4deb633");halo.addColorStop(1,"#f4deb600");ctx.fillStyle=halo;ctx.fillRect(0,0,W,H);
  }
  const photo=ctx.getImageData(0,0,W,H),pixels=photo.data,depth=new Float32Array(W*H).fill(Infinity);
  const worldPoint=new T.Vector3(),screen=new T.Vector3(),normal=new T.Vector3(),part=new T.Vector3(),rawNormal=new T.Vector3();
  const key=new T.Vector3(-.49,.78,.51).normalize(),eye=cam.position.clone().sub(look).normalize(),half=eye.clone().add(key).normalize();
  model.g.traverseVisible(mesh=>{
    if(!mesh.isMesh||!mesh.material||mesh.material.transparent||!mesh.geometry.attributes.normal)return;
    const material=mesh.material,g=mesh.geometry,attr=g.attributes,count=attr.position.count;
    const pix=new Float32Array(count*8),mt=material.color,sheet=tex(material.map);
    const nWorld=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const skin=mesh.isSkinnedMesh?mesh.skeleton.bones.map((b,i)=>{
      const m=mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(b.matrixWorld)
        .multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix);
      return new T.Matrix3().getNormalMatrix(m);
    }):null;
    for(let i=0;i<count;i++){
      mesh.getVertexPosition(i,worldPoint).applyMatrix4(mesh.matrixWorld);screen.copy(worldPoint).project(cam);
      rawNormal.fromBufferAttribute(attr.normal,i);
      if(skin){
        normal.set(0,0,0);
        for(let j=0;j<4;j++){const w=attr.skinWeight.getComponent(i,j);if(w<=0)continue;
          normal.addScaledVector(part.copy(rawNormal).applyMatrix3(skin[attr.skinIndex.getComponent(i,j)]),w);}
        normal.normalize();
      }else normal.copy(rawNormal).applyNormalMatrix(nWorld);
      const lit=normal.dot(key),rim=(1-Math.max(0,normal.dot(eye)))**2.2;
      const gloss=attr.fieldGloss?.getX(i)??.25;
      const shade=.65+.345*Math.max(0,lit)+.065*Math.max(0,normal.y);
      const shine=Math.max(0,normal.dot(half))**(11+26*gloss)*(.035+.20*gloss);
      const edged=rim*(.045+.07*gloss)*Math.max(.2,.57+.43*lit),k=i*8;
      pix[k]=(screen.x*.5+.5)*W;pix[k+1]=(.5-.5*screen.y)*H;pix[k+2]=screen.z;
      const col=attr.color;
      pix[k+3]=Math.max(0,gamma(mt.r*(col?col.getX(i):1))*shade+shine+edged);
      pix[k+4]=Math.max(0,gamma(mt.g*(col?col.getY(i):1))*(shade+.01)+shine*.92+edged*.82);
      pix[k+5]=Math.max(0,gamma(mt.b*(col?col.getZ(i):1))*(shade+.035*(1-Math.max(0,lit)))+shine*.79+edged*.67);
      if(attr.uv){pix[k+6]=attr.uv.getX(i);pix[k+7]=attr.uv.getY(i);}
    }
    const indices=g.index,d=g.drawRange,end=Math.min(d.start+d.count,indices?.count??count);
    for(let f=d.start;f<end;f+=3){
      const a=(indices?indices.getX(f):f)*8,b=(indices?indices.getX(f+1):f+1)*8,c=(indices?indices.getX(f+2):f+2)*8;
      const ax=pix[a],ay=pix[a+1],abx=pix[b]-ax,aby=pix[b+1]-ay,acx=pix[c]-ax,acy=pix[c+1]-ay;
      const det=abx*acy-aby*acx;if(Math.abs(det)<.004||material.side===T.FrontSide&&det>=0)continue;
      const x0=Math.max(0,Math.floor(Math.min(ax,pix[b],pix[c]))),x1=Math.min(W-1,Math.ceil(Math.max(ax,pix[b],pix[c])));
      const y0=Math.max(0,Math.floor(Math.min(ay,pix[b+1],pix[c+1]))),y1=Math.min(H-1,Math.ceil(Math.max(ay,pix[b+1],pix[c+1])));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const dx=x+.5-ax,dy=y+.5-ay,v=(dx*acy-dy*acx)/det,w=(abx*dy-aby*dx)/det,u=1-v-w;
        if(v<0||w<0||u<0)continue;
        const pos=y*W+x,z=u*pix[a+2]+v*pix[b+2]+w*pix[c+2];if(z>=depth[pos])continue;
        let ti=0;
        if(sheet){const su=u*pix[a+6]+v*pix[b+6]+w*pix[c+6],sv=u*pix[a+7]+v*pix[b+7]+w*pix[c+7];
          ti=4*(Math.min(sheet.height-1,Math.max(0,(1-sv)*sheet.height|0))*sheet.width+Math.min(sheet.width-1,Math.max(0,su*sheet.width|0)));}
        depth[pos]=z;pixels[pos*4+3]=255;
        for(let k=0;k<3;k++)pixels[pos*4+k]=(u*pix[a+3+k]+v*pix[b+3+k]+w*pix[c+3+k])*(sheet?sheet.data[ti+k]:255);
      }
    }
  });
  const gather=[[-4,-7],[-1,-10],[4,-6],[-8,0],[4,2],[-2,5]];
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    const i=y*W+x,z=depth[i];if(!Number.isFinite(z))continue;
    let contact=0;
    for(const [dx,dy] of gather){
      const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
      const distance=z-depth[yy*W+xx];
      if(distance>.0012&&distance<.032)contact+=Math.min(1,(distance-.0012)*240)*(1-distance/.04);
    }
    const occlusion=1-contact*.052;
    for(let j=0;j<3;j++)pixels[i*4+j]*=occlusion;
    const edge=Math.max(depth[i-1]-z,depth[i+1]-z,depth[i-W]-z,depth[i+W]-z);
    if(edge>.009)for(let j=0;j<3;j++)pixels[4*i+j]*=edge>.05?.80:.90;
  }
  ctx.putImageData(photo,0,0);return canvas;
}
function drawAbility(ctx,i,cell){
  const colors=["#cfac79","#65cdda","#99b9ba","#5ac8b4","#83d6e8","#a3ca75","#e698a9","#7fbce4","#93cde1","#b496ed","#e8c86a","#e8aa5d","#69cee6","#e2a775","#d1766b","#efbd81","#81c9df"];
  const c=colors[i];ctx.save();ctx.scale(cell/100,cell/100);const wash=ctx.createRadialGradient(53,44,1,50,50,64);
  wash.addColorStop(0,c);wash.addColorStop(.43,"#39565a");wash.addColorStop(1,"#152c3b");ctx.fillStyle=wash;ctx.fillRect(0,0,100,100);
  ctx.lineCap="round";ctx.lineJoin="round";
  function mark(d,fill,stroke,w=2){const p=new Path2D(d);if(fill){ctx.fillStyle=fill;ctx.fill(p);}if(stroke){ctx.lineWidth=w;ctx.strokeStyle=stroke;ctx.stroke(p);}}
  if([1,3,7,9,10,16].includes(i)){
    const r=i===16?16:19;const g=ctx.createRadialGradient(46,40,1,51,49,r);g.addColorStop(0,"#fff7cf");g.addColorStop(.31,"#dfedcc");g.addColorStop(.76,c);g.addColorStop(1,"#384f66");
    ctx.beginPath();ctx.arc(51,49,r,0,2*Math.PI);ctx.fillStyle=g;ctx.fill();
    for(let j=0;j<(i===16?2:3);j++){ctx.save();ctx.translate(50,49);ctx.rotate(-.7+j*1.18);
      ctx.beginPath();ctx.ellipse(0,0,29-j*2,9+j,0,.18,5.70);ctx.lineWidth=2.4;ctx.strokeStyle=j===0?"#fff3bf":c;ctx.stroke();ctx.restore();}
    if(i===16)mark("M13 76 Q25 61 51 53 M21 78 L36 66",null,"#c1eada",2.4);
  }else if(i===4){
    mark("M22 69 L31 44 L65 28 L78 39 L65 56 L43 61 L38 72Z","#476372","#e8dec3",3);
    mark("M39 47 L61 36 M32 73 L40 57 M64 35 Q71 34 68 46",null,c,4);
    mark("M80 24 L87 18 M82 32 L91 29",null,"#f5ebc6",2.6);
  }else if(i===5){
    mark("M48 69 L49 48 M24 50 Q33 43 51 45 Q75 27 79 37 Q74 46 51 48 Q35 57 21 55Z","#add28e","#edf6c3",2.6);
    mark("M40 72 Q50 64 59 69 L51 73Z","#edc97b","#7a7457",2);
  }else if(i===6){
    mark("M29 78 L30 25 L66 18 L72 75Z","#cc8097","#f2c4bf",2.8);mark("M35 74 L36 31 L62 26 L62 71Z","#664663","#efaca9",2.1);
    mark("M63 25 L76 38 L76 78 L63 70Z","#985f7b","#f1c4b1",2);mark("M67 51 l3 1",null,"#ebcd8a",3);
  }else if(i===8){mark("M50 20 Q63 30 77 30 L73 54 Q70 68 50 80 Q30 69 26 54 L23 30 Q38 29 50 20Z","#408198","#c6ebdf",3);mark("M35 38 L50 31 L65 38 M50 36 L50 66",null,c,3);}
  else if([0,2,11,12].includes(i)){
    mark("M17 78 Q43 48 72 23 L64 45 L83 32 Q60 58 33 72 L50 53Z",c,"#f7e6b2",2.2);
    mark("M16 63 L36 47 M26 40 L42 29 M53 75 L70 61",null,c,2.2);
  }else{
    mark("M24 70 L36 54 L33 44 Q32 36 39 36 L43 42 L45 32 Q47 27 52 32 L54 39 L57 28 Q62 25 65 31 L65 40 Q73 32 76 39 L72 53 Q69 62 59 65 L45 76Z","#d5a77d","#f5ddad",3);
    mark("M40 53 L54 55 M45 45 L51 49 L54 43 M54 49 L61 46",null,"#975c4b",2);
    if(i===15)mark("M14 53 L26 45 M12 65 L24 57 M22 79 L33 69",null,c,2.7);
  }
  ctx.restore();
}
(async()=>{
  const threeFile=process.argv[2]||join(here,"vendor/three.module.min.js");
  const T=await import(pathToFileURL(resolve(threeFile)));
  const s=readFileSync(join(here,"game.min.js"),"utf8"),deps={};
  for(const m of s.slice(0,s.indexOf("var kt=")).matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)){
    const lib=await import(new URL(m[2],dir));for(const n of m[1].split(",").map(k=>k.trim()))deps[n]=lib[n];
  }
  const sheet=await deps.readFaceSheet(T),build=new Function("sharedFaceSheet",...Object.keys(deps),s.slice(s.indexOf("function Fe("),s.indexOf("function rt("))+";return Fe;")(sheet,...Object.values(deps));
  const strip=createCanvas(5*224,560),paint=strip.getContext("2d");paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality="high";
  for(let i=0;i<5;i++){
    const rig=build(T,i,0);paint.drawImage(photograph(T,rig,i),224*i,0,224,280);
    paint.drawImage(photograph(T,rig,i,true),224*i,280,224,280);rig.disposeSkin?.();
  }
  writeFileSync(join(here,"assets/canyon-rig-portraits.webp"),strip.encodeSync("webp",94));
  const icons=createCanvas(512,512),ctx=icons.getContext("2d");
  for(let i=0;i<16;i++){ctx.save();ctx.translate(i%4*128,Math.floor(i/4)*128);drawAbility(ctx,i,128);ctx.restore();}
  writeFileSync(join(here,"assets/canyon-glyphs.webp"),icons.encodeSync("webp",94));
  const basic=createCanvas(128,128);drawAbility(basic.getContext("2d"),16,128);writeFileSync(join(here,"assets/canyon-pellet.webp"),basic.encodeSync("webp",94));
})().catch(e=>{console.error(e);process.exitCode=1;});
