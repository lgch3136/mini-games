import {actorStrides,footTrack,bendLeg} from "./river-roles.mjs?v=canyon-march1";
import {bindImpact} from "./surface-impact.mjs?v=canyon-thicket2";
import {paintedCheeks} from "./river-tailoring.mjs?v=canyon-carving2";
import {skullBand} from "./character-plates.mjs?v=canyon-carving2";
const bound = value => Math.max(0, Math.min(1, value));
const ease = value => { const x = bound(value); return x * x * (3 - 2 * x); };

function shape(T, points, indices) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(points,3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// The jaw, cheeks and brow share a sculpted surface. Cheek detail follows the same curve.
export function sculptHead(T, hero, head, add, skin, sheet) {
  const levels = [
    [-.112,.058,.069,.065],[-.065,.153,.133,.055],[.012,.204,.169,.036],
    [.125,.232,.203,.020],[.247,.231,.207,.008],[.337,.199,.179,-.008],[.401,.108,.115,-.022]
  ];
  const points=[], indices=[], segments=16;
  for (let j=0;j<levels.length;j++){
    const [y,rx,rz,forward]=skullBand(hero,...levels[j]);
    for(let n=0;n<segments;n++){
      const a=n*Math.PI*2/segments;
      points.push(rx*Math.sin(a),y,forward+rz*Math.cos(a));
      if(j){const low=(j-1)*segments+n,next=(j-1)*segments+(n+1)%segments;
        indices.push(low,next,low+segments,next,next+segments,low+segments);}
    }
  }
  for(let n=1;n+1<segments;n++)indices.push(0,n+1,n);
  add(head,shape(T,points,indices),skin);
  if(sheet){
    paintedCheeks(T,hero,head,add);
    // The nose retains a bridge and a near-side wing when the cheek turns out of view.
    const tip=hero===3?.265:hero===4?.253:.246;
    const profile=[[-.018,.151,.229],[.018,.151,.229],[-.032,.052,.228],[.032,.052,.228],
      [0,.069,tip],[-.027,.042,.228],[.027,.042,.228],[0,.037,.238]];
    const nose=shape(T,profile.flat(),[0,4,1,0,2,4,1,4,3,2,5,4,4,5,7,4,7,6,3,4,6]);
    nose.userData.fieldGloss=.20;add(head,nose,hero===3?0xe3ad83:0xefc19b);
    head.scale.set(hero===3?.985:hero===4?.955:.94,hero===2?1.02:.98,.96);return;
  }
  function patch(vertices, hue) {
    const ix=[];
    const winding=vertices.reduce((sum,p,j)=>{const q=vertices[(j+1)%vertices.length];return sum+p[0]*q[1]-p[1]*q[0];},0);
    for(let j=1;j+1<vertices.length;j++)ix.push(0,winding>0?j:j+1,winding>0?j+1:j);
    add(head,shape(T,vertices.flat(),ix),hue);
  }
  function front(x,y){const z=y<.10?.206:.223;return z-.36*x*x/.23;}
  function facePatch(poly, side, depth, hue) {
    patch(poly.map(([x,y])=>[side*x,y,front(x,y)+depth]),hue);
  }
  if(hero!==2)for(const side of [-1,1]){
    facePatch([[.034,.180],[.087,.204],[.166,.203],[.123,.164],[.056,.163]],side,.009,0xf3dfc5);
    facePatch([[.070,.190],[.103,.195],[.108,.178],[.091,.161],[.072,.169]],side,.014,
      hero===0?0x355c67:hero===1?0x623b47:0x443431);
    facePatch([[.033,.183],[.081,.209],[.170,.211],[.158,.197],[.087,.197]],side,.017,0x362c32);
    facePatch([[.041,.224],[.088,.250],[.163,.253],[.137,.238]],side,.008,hero===0?0x8a663a:0x49373a);
  }
  patch([[-.028,.152,.215],[.006,.141,.223],[.030,.080,.229],[.007,.071,.249],[-.028,.086,.231]],0xd89b7a);
  patch([[-.059,.013,.211],[-.005,.020,.222],[.052,.019,.212],[.018,.009,.224],[-.026,.009,.221]],0x935f5b);
  head.scale.set(.88,.95,.92);
}

export function hairLock(T, radius, height) {
  const r=radius,h=height;
  return shape(T,[-r,-.43*h,0, -.19*r,-.47*h,r*.85, .89*r,-.42*h,.11*r,
    .23*r,-.45*h,-.87*r, -.08*r,.10*h,.19*r, .31*r,.61*h,-.31*r],
    [0,1,4,1,2,4,2,3,4,3,0,4,0,4,5,4,2,5,2,3,5,3,0,5,0,3,2,0,2,1]);
}

// A dash can spawn two images in each team at once. Four slots share one posed silhouette.
export function runnerTraces(T) {
  const p=[],colors=[],indices=[];
  function taper(a,b,r1,r2,tint,n=6) {
    const start=new T.Vector3(...a),end=new T.Vector3(...b),axis=end.clone().sub(start).normalize();
    const up=Math.abs(axis.y)>.86?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
    const u=up.cross(axis).normalize(),v=axis.clone().cross(u),first=p.length/3,c=new T.Color(tint);
    for(const [centre,radius] of [[start,r1],[end,r2]])for(let j=0;j<n;j++){
      const theta=j*2*Math.PI/n,cos=Math.cos(theta),sin=Math.sin(theta);
      const point=centre.clone().addScaledVector(u,cos*radius).addScaledVector(v,sin*radius);
      p.push(point.x,point.y,point.z);const light=.83+.15*cos;colors.push(c.r*light,c.g*light,c.b*light);
    }
    for(let j=0;j<n;j++){const a=first+j,b=first+(j+1)%n;indices.push(a,b,a+n,b,b+n,a+n);}
    for(let j=1;j<n-1;j++)indices.push(first+n,first+n+j,first+n+j+1);
  }
  taper([0,.86,0],[0,1.48,.28],.21,.28,"#e59a51",8);
  taper([0,1.49,.28],[0,1.77,.33],.14,.19,"#ead4a3",8);
  taper([0,1.76,.33],[0,1.87,.30],.19,.16,"#394658",8);
  for(let j=0;j<6;j++){
    const a=j*Math.PI/3,x=.13*Math.sin(a),z=.30+.13*Math.cos(a);
    taper([x,1.83,z],[x*1.49,2.08+(j%2)*.05,z-.12],.095,.012,"#f5ce63",4);
  }
  for(const side of [-1,1]){
    const knee=[side*.18,.48,side*.30],foot=[side*.20,.14,side*.26-.21];
    taper([side*.12,.89,0],knee,.14,.10,"#e78b44");taper(knee,foot,.10,.069,"#374557");
    taper(foot,[foot[0],foot[1]-.04,foot[2]+.16],.086,.055,"#475461");
    const elbow=[side*.34,1.23,.15-side*.26],hand=[side*.39,1.14,.31-side*.39];
    taper([side*.21,1.46,.23],elbow,.12,.078,"#e99551");taper(elbow,hand,.077,.052,"#e9c191");
  }
  const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(p,3));
  geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeBoundingSphere();
  const slots=Array.from({length:4},()=>{
    const material=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide});
    material.userData.alpha=.42;return new T.Mesh(geo,material);
  });
  return {
    mount(group,face,team){
      const lease=[];
      for(const side of [-1,1]){
        const mesh=slots.find(node=>!node.parent);if(!mesh)continue;
        mesh.material.color.set(team===1?"#f1b0b6":"#e3f5dc");mesh.material.opacity=.42;
        mesh.rotation.y=face;mesh.position.set(side*Math.cos(face)*.9,0,-side*Math.sin(face)*.9);
        group.add(mesh);lease.push(mesh);
      }
      group.userData.traces=lease;
    },
    release(group){for(const mesh of group.userData.traces||[])mesh.removeFromParent();},
    dispose(){for(const mesh of slots){mesh.removeFromParent();mesh.material.dispose();}geo.dispose();}
  };
}

// Merge opaque geometry into a skin. The elbow and knee smoothly share vertices across each joint.
export function articulate(T, model, hero, exclusions, panels, sheet, bladeMount) {
  const {root,body,hip,head,arms,legs}=model;
  root.updateWorldMatrix(true,true);
  const roots=[body,hip,head,...arms,...legs];
  const bones=roots.map(group=>{const b=new T.Bone();group.add(b);return b;});
  const joints=[], anchor=new Map(roots.map((group,i)=>[group,i]));
  const inverseLimb=[], elbowY=[-.33,-.33,-.33,-.35,-.34][hero], kneeY=hero===4?-.36:-.37;
  for(const [i,limb] of [...arms,...legs].entries()){
    const joint=new T.Bone();joint.position.y=i<2?elbowY:kneeY;limb.add(joint);
    bones.push(joint);joints.push(joint);
    inverseLimb.push(new T.Matrix4().copy(limb.matrixWorld).invert());
  }
  if(bladeMount){
    joints[1].attach(bladeMount);
    const wrist=new T.Bone();bladeMount.add(wrist);
    anchor.set(bladeMount,bones.length);bones.push(wrist);
  }
  for(const panel of panels){
    const bone=new T.Bone();panel.add(bone);anchor.set(panel,bones.length);bones.push(bone);
  }
  root.updateWorldMatrix(true,true);
  const skeleton=new T.Skeleton(bones);
  // Finger signs stay switchable, with their root attached to the moving forearm.
  for(const node of exclusions){
    if(!node?.isGroup || !arms.includes(node.parent))continue;
    const arm=arms.indexOf(node.parent);joints[arm].attach(node);
  }
  const out={p:[],n:[],c:[],idx:[],uv:[],gloss:[],weight:[],bone:[]},retired=[],heldIndices=[];
  const point=new T.Vector3(),local=new T.Vector3(),normal=new T.Vector3(),normals=new T.Matrix3();
  root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.material?.isMeshStandardMaterial||mesh.material.transparent)return;
    let parent=mesh,bind=-1;
    while(parent&&bind===-1){if(exclusions.has(parent))return;bind=anchor.get(parent)??-1;parent=parent.parent;}
    if(bind<0)return;
    const geom=mesh.geometry,attr=geom.attributes,base=out.p.length/3,mat=mesh.material;
    normals.getNormalMatrix(mesh.matrixWorld);
    for(let j=0;j<attr.position.count;j++){
      point.fromBufferAttribute(attr.position,j).applyMatrix4(mesh.matrixWorld);out.p.push(point.x,point.y,point.z);
      normal.fromBufferAttribute(attr.normal,j).applyNormalMatrix(normals);out.n.push(normal.x,normal.y,normal.z);
      if(sheet){
        if(geom.userData.robotFaceUV)out.uv.push(attr.uv.getX(j),.0625+.9375*attr.uv.getY(j));
        else if(hero===1)out.uv.push(.5,.018);
        else if(geom.userData.uniformUV)out.uv.push(attr.uv.getX(j),attr.uv.getY(j));
        else if(geom.userData.faceUV)out.uv.push(attr.uv.getX(j),.5+.5*attr.uv.getY(j));
        else out.uv.push(5/6,.625);
      }
      const col=attr.color;
      out.gloss.push(geom.userData.fieldGloss ?? (geom.userData.faceUV ? .25 : geom.userData.uniformUV ? .11 : hero===1 ? .56 : .15));
      out.c.push(mat.color.r*(col?col.getX(j):1),mat.color.g*(col?col.getY(j):1),mat.color.b*(col?col.getZ(j):1));
      const limb=bind-3;
      let second=bind,w=0;
      if(limb>=0 && limb<4){
        local.copy(point).applyMatrix4(inverseLimb[limb]);
        const pivot=limb<2?elbowY:kneeY;
        w=ease((pivot+.064-local.y)/.128);
        second=7+limb;
      }
      if(w>=.99999){out.bone.push(second,second,0,0);out.weight.push(1,0,0,0);}
      else{out.bone.push(bind,second,0,0);out.weight.push(1-w,w,0,0);}
    }
    const ix=geom.index;
    const indices=geom.userData.pocketProp?heldIndices:out.idx;
    for(let j=0;j<(ix?ix.count:attr.position.count);j++)indices.push(base+(ix?ix.getX(j):j));
    retired.push(mesh);
  });
  for(const mesh of retired){mesh.removeFromParent();mesh.geometry.dispose();}
  const g=new T.BufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(out.p,3));g.setAttribute("normal",new T.Float32BufferAttribute(out.n,3));
  g.setAttribute("color",new T.Float32BufferAttribute(out.c,3));
  g.setAttribute("fieldGloss",new T.Float32BufferAttribute(out.gloss,1));g.setAttribute("skinIndex",new T.Uint16BufferAttribute(out.bone,4));
  g.setAttribute("skinWeight",new T.Float32BufferAttribute(out.weight,4));const bodyIndices=out.idx.length;
  if(heldIndices.length){
    out.idx.push(...heldIndices);
    const allIndices=out.idx.length;
    g.userData.setPocketProp=shown=>g.setDrawRange(0,shown?allIndices:bodyIndices);
  }
  g.setIndex(out.idx);g.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.025,side:T.FrontSide});
  if(sheet){g.setAttribute("uv",new T.Float32BufferAttribute(out.uv,2));material.map=sheet;}
  material.userData.robotFaceSheet=hero===1&&Boolean(sheet);material.userData.riverFigure=true;material.userData.impactUniform={value:0};material.userData.fieldContact={value:new T.Vector3(0,.5,1)};
  material.onBeforeCompile=shader=>bindImpact(shader,material);material.customProgramCacheKey=()=>"field-sculpted-finish-v1";
  const skin=new T.SkinnedMesh(g,material);skin.name="骨架角色";skin.castShadow=true;skin.receiveShadow=true;
  root.add(skin);skin.bind(skeleton);
  skin.boundingSphere=g.boundingSphere.clone();skin.boundingSphere.radius+=2.2;
  const ready=[[-.62,-.80],[-.68,-.87],[-.40,-1.02],[-.95,-.93],[-.60,-.69]][hero];
  const travelFeet=[{},{}];
  function pose(phase,weight,action){
    const beat=Math.sin(phase),w=bound(weight||0);
    let coil=0,release=0,left=0,right=0,stance=0;
    if(action&&Number.isFinite(action.elapsed)){
      const wind=Math.max(.001,action.windup),duration=Math.max(wind+.001,action.duration);
      const at=action.elapsed/wind;
      const fade=action.elapsed<=wind?1:1-ease((action.elapsed-wind)/(duration-wind));
      coil=ease(at/.57)*(1-ease((at-.68)/.32))*fade;
      release=ease((at-.66)/.34)*fade;
      right=action.kind==="attack"||action.skillIndex===0?1:.74;
      left=hero===1||hero===3&&action.skillIndex===2?.78:.35;
      stance=fade;
    }
    joints[0].rotation.set(ready[0]+beat*w*.17-coil*left*.72+release*left*.56,0,-.08);
    joints[1].rotation.set(ready[1]-beat*w*.17-coil*right*.78+release*right*.73,0,.08);
    for(let side=0;side<2;side++){
      const hinge=joints[side+2], leg=legs[side];
      const restKnee=.09+(side?.17:.13)*stance;
      hinge.rotation.set(restKnee,0,0);
      if(hero===1 || !w)continue;
      const track=footTrack(travelFeet[side],phase/(Math.PI*2)+side*.5,actorStrides[hero],.52,.225);
      const mix=w*(1-stance*.83);
      const upper=-kneeY,lower=.39;
      bendLeg(track,.68-track.lift,track.z*.87,upper,lower);
      leg.rotation.x+=(track.hip-leg.rotation.x)*mix;
      hinge.rotation.x+=(track.knee-restKnee)*mix;
    }
  }
  return {pose,joints,skin,dispose(){skeleton.dispose();}};
}
