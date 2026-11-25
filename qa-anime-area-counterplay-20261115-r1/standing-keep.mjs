// The tower is one rigid object until it falls. Its two falling pieces use
// ranges of the same GPU buffers, each with its own transform and material.
export function joinStandingKeep(T, parent, wall, roof, art) {
  const a=wall.geometry,b=roof.geometry,combined=new T.BufferGeometry();
  const firstCount=a.index.count;
  for(const [name,one] of Object.entries(a.attributes)){
    const two=b.getAttribute(name);
    const array=new one.array.constructor(one.array.length+two.array.length);
    array.set(one.array);
    array.set(two.array,one.array.length);
    if(name==="keepMaterial"){
      for(let i=one.array.length;i<array.length;i++)array[i]+=16;
    }
    combined.setAttribute(name,new T.BufferAttribute(array,one.itemSize,one.normalized));
  }
  const firstVertices=a.getAttribute("position").count;
  const Index=combined.getAttribute("position").count<=65535?Uint16Array:Uint32Array;
  const index=new Index(firstCount+b.index.count);
  index.set(a.index.array);
  for(let i=0;i<b.index.count;i++)index[firstCount+i]=b.index.array[i]+firstVertices;
  combined.setIndex(new T.BufferAttribute(index,1));
  combined.computeBoundingSphere();
  const fullMaterial=art.bind(wall.material.clone());
  fullMaterial.onBeforeCompile=wall.material.onBeforeCompile;
  fullMaterial.customProgramCacheKey=wall.material.customProgramCacheKey;
  const full=new T.Mesh(combined,fullMaterial);
  full.name="完整守塔";
  full.castShadow=full.receiveShadow=true;
  parent.add(full);
  function useRange(mesh,start,count) {
    const view=new T.BufferGeometry();
    for(const [name,attr] of Object.entries(combined.attributes))view.setAttribute(name,attr);
    view.setIndex(combined.index);
    view.setDrawRange(start,count);
    view.boundingSphere=combined.boundingSphere;
    mesh.geometry.dispose();
    mesh.geometry=view;
    mesh.visible=false;
  }
  useRange(wall,0,firstCount);
  useRange(roof,firstCount,index.length-firstCount);
  return {mesh:full,disposeViews(){
    // Their parent owns the underlying attributes and index, including during restart.
    for(const mesh of [wall,roof]){
      mesh.geometry.setIndex(null);
      for(const name of Object.keys(mesh.geometry.attributes))mesh.geometry.deleteAttribute(name);
    }
  }};
}
