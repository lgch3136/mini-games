import {projectBox,overlaps} from "./scenery-occlusion.mjs?v=canyon-eave-batch1";
// Bit 0 belongs to the visible opaque fighter sample written by scenery-occlusion.
// Bit 1 records that the nearest tower surface actually lies in front of that sample.
const fighterBit = 1;
const towerBit = 2;
const coveredFighter = fighterBit | towerBit;

function blendOver(T, material) {
  material.blending = T.CustomBlending;
  material.blendSrc = T.SrcAlphaFactor;
  material.blendDst = T.OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = T.ZeroFactor;
  material.blendDstAlpha = T.OneFactor;
}

function matchProjection(material) {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = "invariant gl_Position;\n" + shader.vertexShader;
  };
  material.customProgramCacheKey = () => key + "-keep-depth-v1";
}

// WebGL contexts which decline the requested stencil can still show a partly
// covered fighter. Keep a continuous roof surface across the entire soft region.
function softSight(T, material) {
  const limit = 3;
  const count = {value: 0};
  const bounds = Array.from({length: limit}, () => new T.Vector4());
  const farDepth = new Float32Array(limit);
  const point = new T.Vector3();
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    compile.call(this, shader, renderer);
    Object.assign(shader.uniforms, {keepCount: count, keepBounds: {value: bounds}, keepFar: {value: farDepth}});
    shader.fragmentShader = `uniform int keepCount;
      uniform vec4 keepBounds[3]; uniform float keepFar[3];\n` + shader.fragmentShader.replace(
      "#include <alphamap_fragment>", `#include <alphamap_fragment>
      float coverage=0.;
      for(int i=0;i<3;i++){
        if(i>=keepCount)break;
        vec2 d=(gl_FragCoord.xy-keepBounds[i].xy)*keepBounds[i].zw;
        float front=smoothstep(0.,.00009,keepFar[i]-gl_FragCoord.z);
        coverage=max(coverage,(1.-smoothstep(.16,1.,dot(d,d)))*front);
      }
      diffuseColor.a*=1.-.46*coverage;`);
  };
  material.customProgramCacheKey = () => key + "-soft-eave-v1";
  blendOver(T,material);
  return {
    clear(){ count.value=0; },
    add(actor, ground, camera, canvas){
      if(count.value===limit || !canvas.width || !canvas.height)return;
      const small=actor.kind==="minion", height=small?1.70:actor.hero===1?2.40:2.80;
      const w=canvas.width*.5,h=canvas.height*.5;
      point.set(actor.x,ground-.1,actor.z).project(camera);
      const footX=point.x,footY=point.y,footZ=point.z;
      point.set(actor.x,ground+height,actor.z).project(camera);
      const x=(point.x+footX)*.5,y=(point.y+footY)*.5,topZ=point.z;
      const ry=Math.max(2,Math.abs(point.y-footY)*.56*h);
      point.set(actor.x+(small?.57:.70),ground+height*.5,actor.z).project(camera);
      const rx=Math.max(2,Math.abs(point.x-x)*w);
      const slot=count.value++;
      bounds[slot].set((x+1)*w,(y+1)*h,1/rx,1/ry);
      farDepth[slot]=.5+.5*Math.max(footZ,topZ)+.00004;
    }
  };
}

// Both auxiliary passes borrow the lit tower vertices. Only ranges in front
// of a visible fighter get an index in the second pass.
function foregroundFaces(T, source) {
  const m=new T.Matrix4(), absolute=new Float32Array(16);
  const subjects=[], screen={};
  const vertices=source.attributes.position.array, full=source.index.array;
  const blockSize=36; // Twelve adjacent triangles normally describe one beam or roof strip.
  let used=0, ranges=null, choice=null, geometry=null;
  function begin(){ used=0; }
  function add(actor,ground,camera){
    if(!used){
      m.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      for(let k=0;k<16;k++)absolute[k]=Math.abs(m.elements[k]);
    }
    const hero=actor.kind==="hero",small=actor.kind==="minion";
    const stretch=hero&&actor.hero===4&&actor.action?.kind==="skill";
    const radius=stretch?6.5:hero?1.65:small&&actor.formation!=="siege"?1.03:1.9;
    const height=hero?3.6:small?2.05:3.15;
    const box=subjects[used]||(subjects[used]={});
    if(projectBox(m.elements,absolute,actor.x,ground+height*.47,actor.z,
      radius,height*.55,radius,box))used++;
  }
  function hits(box){
    for(let i=0;i<used;i++)if(overlaps(box,subjects[i]))return true;
    return false;
  }
  function build(){
    const count=Math.ceil(full.length/blockSize);
    ranges=new Float32Array(count*6);
    choice=new Uint8Array(count);
    geometry=new T.BufferGeometry();
    for(const [name,attr] of Object.entries(source.attributes))geometry.setAttribute(name,attr);
    geometry.setIndex(new T.BufferAttribute(new full.constructor(full.length),1).setUsage(T.DynamicDrawUsage));
    geometry.setDrawRange(0,0);
    geometry.boundingSphere=source.boundingSphere;
    for(let block=0;block<count;block++){
      let xmin=Infinity,ymin=Infinity,zmin=Infinity,xmax=-Infinity,ymax=-Infinity,zmax=-Infinity;
      const end=Math.min(full.length,(block+1)*blockSize);
      for(let i=block*blockSize;i<end;i++){
        const j=full[i]*3,x=vertices[j],y=vertices[j+1],z=vertices[j+2];
        xmin=Math.min(xmin,x);ymin=Math.min(ymin,y);zmin=Math.min(zmin,z);
        xmax=Math.max(xmax,x);ymax=Math.max(ymax,y);zmax=Math.max(zmax,z);
      }
      ranges.set([(xmax+xmin)*.5,(ymax+ymin)*.5,(zmax+zmin)*.5,
        (xmax-xmin)*.5+.025,(ymax-ymin)*.5+.025,(zmax-zmin)*.5+.025],block*6);
    }
  }
  function select(unit,ground,scale){
    if(!used)return false;
    const sphere=source.boundingSphere, r=sphere.radius*scale, c=sphere.center;
    if(!projectBox(m.elements,absolute,unit.x+c.x*scale,ground+c.y*scale,unit.z+c.z*scale,r,r,r,screen)||!hits(screen))return false;
    if(!geometry)build();
    let changed=false,total=0;
    for(let block=0;block<choice.length;block++){
      const j=block*6;
      const visible=Number(projectBox(m.elements,absolute,unit.x+ranges[j]*scale,ground+ranges[j+1]*scale,
        unit.z+ranges[j+2]*scale,ranges[j+3]*scale,ranges[j+4]*scale,ranges[j+5]*scale,screen)&&hits(screen));
      if(visible!==choice[block]){choice[block]=visible;changed=true;}
      if(visible)total+=Math.min(blockSize,full.length-block*blockSize);
    }
    if(changed){
      const selected=geometry.index;
      let cursor=0;
      for(let i=0;i<choice.length;){
        if(!choice[i]){i++;continue;}
        const start=i++*blockSize;
        while(i<choice.length&&choice[i])i++;
        const end=Math.min(i*blockSize,full.length);
        selected.array.set(full.subarray(start,end),cursor);
        cursor+=end-start;
      }
      geometry.setDrawRange(0,total);
      if(total){
        selected.clearUpdateRanges();
        selected.addUpdateRange(0,total);
        selected.needsUpdate=true;
      }
    }
    return total>0;
  }
  function dispose(){
    if(!geometry)return;
    for(const name of Object.keys(geometry.attributes))geometry.deleteAttribute(name);
    geometry.dispose();
  }
  return {begin,add,select,dispose,get geometry(){return geometry;}};
}

export function towerSight(T, node, stencil) {
  const material = node.material;
  const originalOrder = node.renderOrder;
  matchProjection(material);
  const soft = stencil ? null : softSight(T,material);
  if(stencil){
    material.stencilFunc=T.NotEqualStencilFunc;
    material.stencilRef=fighterBit;
    material.stencilFuncMask=fighterBit;
    material.stencilWriteMask=0;
  }
  const faces=stencil?foregroundFaces(T,node.geometry):null;
  let nearest=null, coating=null, active=false;
  function borrowedMesh(name, mat, order) {
    const mesh=new T.Mesh(faces?faces.geometry:node.geometry,mat);
    mesh.name=name;
    mesh.renderOrder=order;
    mesh.matrixAutoUpdate=false;
    node.add(mesh);
    return mesh;
  }
  function prepare() {
    const depth=new T.MeshBasicMaterial({colorWrite:false,side:material.side,fog:false,toneMapped:false});
    matchProjection(depth);
    nearest=borrowedMesh("塔体遮挡深度",depth,2.46);
    if(!stencil)return;
    depth.stencilWrite=true;
    depth.stencilFunc=T.EqualStencilFunc;
    depth.stencilRef=coveredFighter;
    depth.stencilFuncMask=fighterBit;
    depth.stencilWriteMask=towerBit;
    depth.stencilZPass=T.ReplaceStencilOp;

    const veil=material.clone();
    const lit=material.onBeforeCompile;
    veil.onBeforeCompile=function(shader,renderer){
      lit.call(this,shader,renderer);
      shader.vertexShader="varying float layerCoverage;\n"+shader.vertexShader.replace(
        "#include <begin_vertex>", "#include <begin_vertex>\nlayerCoverage=keepMaterial>=16.?.42:.36;");
      shader.fragmentShader="varying float layerCoverage;\n"+shader.fragmentShader.replace(
        "#include <alphamap_fragment>", "#include <alphamap_fragment>\ndiffuseColor.a*=layerCoverage;");
    };
    veil.customProgramCacheKey=()=>material.customProgramCacheKey()+"-joined-coating";
    blendOver(T,veil);
    veil.depthFunc=T.EqualDepth;
    veil.depthWrite=false;
    veil.stencilWrite=true;
    veil.stencilFunc=T.EqualStencilFunc;
    veil.stencilRef=coveredFighter;
    veil.stencilFuncMask=coveredFighter;
    veil.stencilWriteMask=towerBit;
    veil.stencilZPass=T.ZeroStencilOp;
    coating=borrowedMesh("人物轮廓上的塔面",veil,2.52);
    coating.receiveShadow=node.receiveShadow;
  }
  return {
    clear(){ faces?.begin();soft?.clear(); },
    add(actor,ground,camera,canvas){ if(faces)faces.add(actor,ground,camera);else soft.add(actor,ground,camera,canvas); },
    set(needed,unit,ground,scale){
      if(needed&&faces)needed=faces.select(unit,ground,scale);
      if(needed && !nearest)prepare();
      if(needed && coating)coating.material.map=material.map;
      if(active===needed)return;
      active=needed;
      node.renderOrder=active?2.49:originalOrder;
      nearest.visible=active;
      if(stencil){
        material.stencilWrite=active;
        coating.visible=active;
      }else{
        material.depthFunc=active?T.EqualDepth:T.LessEqualDepth;
      }
    },
    dispose(){
      for(const mesh of [nearest,coating]){
        if(!mesh)continue;
        mesh.removeFromParent();
        mesh.material.dispose();
      }
      faces?.dispose();
    }
  };
}
