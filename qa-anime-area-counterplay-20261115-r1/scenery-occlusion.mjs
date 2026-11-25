// Clip a world-space box to a conservative screen rectangle. Clip w is the
// positive view depth for the battle's perspective camera, in world units.
function projectBox(m, abs, x, y, z, rx, ry, rz, out) {
  const w = m[3]*x + m[7]*y + m[11]*z + m[15];
  const dw = abs[3]*rx + abs[7]*ry + abs[11]*rz;
  if (w + dw <= .1) return false;
  const near = 1 / Math.max(.1, w - dw), far = 1 / (w + dw);
  const u = m[0]*x + m[4]*y + m[8]*z + m[12];
  const v = m[1]*x + m[5]*y + m[9]*z + m[13];
  const du = abs[0]*rx + abs[4]*ry + abs[8]*rz;
  const dv = abs[1]*rx + abs[5]*ry + abs[9]*rz;
  out.left = (u-du) * (u < du ? near : far);
  out.right = (u+du) * (u > -du ? near : far);
  out.bottom = (v-dv) * (v < dv ? near : far);
  out.top = (v+dv) * (v > -dv ? near : far);
  out.near = w-dw;
  out.far = w+dw;
  return out.left <= 1 && out.right >= -1 && out.bottom <= 1 && out.top >= -1;
}

function overlaps(stand, actor) {
  return stand.near <= actor.far && stand.right >= actor.left && stand.left <= actor.right &&
    stand.top >= actor.bottom && stand.bottom <= actor.top;
}

// Branches and ground plants are emitted in spatial order. Restrict the
// second pass to short contiguous runs while sharing the original vertices.
function foregroundRanges(stands, source, positions) {
  const length=48*3;
  const count=stands.reduce((n,s)=>n+Math.ceil(s.count/length),0);
  const bounds=new Float32Array(count*6), offsets=new Uint32Array(count+1);
  const selected=new Uint8Array(count);
  let piece=0;
  for(const stand of stands) {
    stand.firstPiece=piece;
    const end=stand.start+stand.count;
    for(let first=stand.start;first<end;first+=length) {
      const stop=Math.min(end,first+length);
      let xl=Infinity,yl=Infinity,zl=Infinity,xh=-Infinity,yh=-Infinity,zh=-Infinity;
      for(let i=first;i<stop;i++) {
        const j=source[i]*3,x=positions[j],y=positions[j+1],z=positions[j+2];
        xl=Math.min(xl,x);xh=Math.max(xh,x);
        yl=Math.min(yl,y);yh=Math.max(yh,y);
        zl=Math.min(zl,z);zh=Math.max(zh,z);
      }
      offsets[piece]=first;
      const k=piece*6;
      bounds[k]=(xl+xh)*.5; bounds[k+1]=(yl+yh)*.5; bounds[k+2]=(zl+zh)*.5;
      bounds[k+3]=(xh-xl)*.5+.04; bounds[k+4]=(yh-yl)*.5+.04; bounds[k+5]=(zh-zl)*.5+.04;
      piece++;
    }
    stand.pastPiece=piece;
  }
  offsets[count]=source.length;
  return {bounds,offsets,selected};
}

// Solid fighters have already painted their normal colours and depths. The
// stencil bit is set only on samples where that actual mesh passed the depth
// test. Forest geometry behind a fighter still fails the usual depth test.
export function sceneryOcclusion(T, forest, stands, original, floor, hasStencil) {
  const matrix = new T.Matrix4(), abs = new Float32Array(16);
  const subjects = [], projected = {};
  const material = forest.material;
  forest.renderOrder = 2.6;

  // Without a stencil attachment, use continuous coverage around the three
  // focus subjects. Drawing after opaque figures makes their colour available.
  function blendOver(mat) {
    mat.blending = T.CustomBlending;
    mat.blendSrc = T.SrcAlphaFactor;
    mat.blendDst = T.OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha = T.ZeroFactor;
    mat.blendDstAlpha = T.OneFactor;
  }
  if (!hasStencil) {
    blendOver(material);
    const p = new T.Vector3();
    function focus(slot, actor, camera) {
      const bounds = material.uniforms.softBounds.value[slot];
      if (!actor || actor.dead || actor.hp <= 0) {
        bounds.set(-8,-8,1,1);
        return;
      }
      const y = floor(actor.x,actor.z), small = actor.kind === "minion";
      p.set(actor.x,y-.14,actor.z+.13).project(camera);
      const footY = p.y, footX = p.x;
      const height = small ? 1.72 : actor.hero === 1 ? 2.40 : 2.83;
      p.set(actor.x,y+height,actor.z).project(camera);
      const topY = p.y, x = (p.x+footX)*.5;
      p.set(actor.x+(small?.62:.82),y+height*.5,actor.z).project(camera);
      bounds.set(x,(topY+footY)*.5,1/Math.max(.001,Math.abs(p.x-x)),1/Math.max(.001,(topY-footY)*.57));
      p.set(actor.x,y+height*.45,actor.z).applyMatrix4(camera.matrixWorldInverse);
      material.uniforms.softDepth.value[slot] = -p.z+.28;
    }
    return {
      mark(){},
      update(units,camera,canvas,hero,target,companion) {
        material.uniforms.screenScale.value.set(2/Math.max(1,canvas.width),2/Math.max(1,canvas.height));
        focus(0,hero,camera); focus(1,target,camera); focus(2,companion,camera);
      },
      dispose(){}
    };
  }

  // The opaque pass paints everywhere except on the visible figure samples.
  material.stencilWrite = true;
  material.stencilWriteMask = 0;
  material.stencilFuncMask = 1;
  material.stencilRef = 1;
  material.stencilFunc = T.NotEqualStencilFunc;
  const veilMaterial = new T.RawShaderMaterial({
    glslVersion: material.glslVersion, side: material.side, toneMapped: material.toneMapped,
    vertexShader: material.vertexShader, fragmentShader: material.fragmentShader,
    uniforms: {...material.uniforms, veil: {value:1}},
    stencilWrite: true, stencilFunc: T.EqualStencilFunc, stencilFuncMask: 1,
    stencilRef: 1, stencilWriteMask: 1, stencilZPass: T.ZeroStencilOp
  });
  blendOver(veilMaterial);
  const ranges=foregroundRanges(stands,original,forest.geometry.attributes.position.array);
  const veil = new T.Mesh(new T.BufferGeometry(),veilMaterial);
  veil.name = "英雄身前的枝叶";
  veil.renderOrder = 2.7;
  veil.frustumCulled = false;
  veil.visible = false;
  forest.add(veil);

  function mark(root) {
    root.traverse(mesh => {
      const mat = mesh.material;
      if (!mesh.isMesh || !mat || mat.transparent || !mat.depthTest || !mat.depthWrite) return;
      // Ground and ordinary opaque scenery are complete by this point. An
      // opaque object between the camera and a fighter prevents that mark.
      mesh.renderOrder = 2.4;
      mat.stencilWrite = true;
      mat.stencilWriteMask = mat.stencilFuncMask = 1;
      mat.stencilRef = 1;
      mat.stencilFunc = T.AlwaysStencilFunc;
      mat.stencilZPass = T.ReplaceStencilOp;
    });
  }

  function releaseIndex() {
    // The other forest mesh owns the shared vertices, normals and UVs.
    const geometry = veil.geometry;
    for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
    geometry.dispose();
  }
  function indexBuffer(size) {
    if (veil.geometry.index?.count >= size) return veil.geometry.index;
    releaseIndex();
    const geometry = new T.BufferGeometry();
    for (const [key,attr] of Object.entries(forest.geometry.attributes)) geometry.setAttribute(key,attr);
    const capacity = Math.min(original.length,2**Math.ceil(Math.log2(size)));
    const index = new T.BufferAttribute(new original.constructor(capacity),1).setUsage(T.DynamicDrawUsage);
    geometry.setIndex(index);
    veil.geometry = geometry;
    return index;
  }
  function update(units,camera) {
    const m = matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
    for (let i=0;i<16;i++) abs[i]=Math.abs(m[i]);
    let count=0;
    for (const unit of units) {
      if (unit.dead || unit.hp<=0) continue;
      if (unit.kind!=="hero" && unit.kind!=="minion" && unit.kind!=="keeper" && unit.kind!=="camp") continue;
      const hero = unit.kind==="hero", cart = unit.formation==="siege";
      const radius = hero ? 1.72 : cart || unit.kind!=="minion" ? 1.46 : .94;
      const height = hero ? 3.10 : unit.kind==="minion" ? 1.82 : 2.45;
      const box = subjects[count] || (subjects[count]={});
      if (projectBox(m,abs,unit.x,floor(unit.x,unit.z)+height*.49,unit.z,radius,height*.56,radius,box)) count++;
    }
    let total=0, changed=false;
    const {bounds,offsets,selected}=ranges;
    function touchesFighter() {
      for(let i=0;i<count;i++) if(overlaps(projected,subjects[i]))return true;
      return false;
    }
    for (const stand of stands) {
      const near=count>0 && projectBox(m,abs,stand.x,stand.y,stand.z,stand.rx,stand.ry,stand.rz,projected) && touchesFighter();
      if(!near && !stand.selected)continue;
      stand.selected=near;
      for(let i=stand.firstPiece;i<stand.pastPiece;i++) {
        const k=i*6;
        const active=Number(near && projectBox(m,abs,bounds[k],bounds[k+1],bounds[k+2],
          bounds[k+3],bounds[k+4],bounds[k+5],projected) && touchesFighter());
        if(active!==selected[i]) {selected[i]=active;changed=true;}
        if(active)total+=offsets[i+1]-offsets[i];
      }
    }
    veil.visible = total>0;
    material.stencilWrite = veil.visible;
    if (!changed || !total) return;
    const index = indexBuffer(total);
    let at=0;
    for(let i=0;i<selected.length;) {
      if(!selected[i]){i++;continue;}
      const first=offsets[i++];
      while(i<selected.length && selected[i])i++;
      const end=offsets[i];
      index.array.set(original.subarray(first,end),at);
      at+=end-first;
    }
    veil.geometry.setDrawRange(0,at);
    index.clearUpdateRanges();
    index.addUpdateRange(0,at);
    index.needsUpdate=true;
  }
  return {mark,update,dispose(){veil.removeFromParent();releaseIndex();veilMaterial.dispose();}};
}
