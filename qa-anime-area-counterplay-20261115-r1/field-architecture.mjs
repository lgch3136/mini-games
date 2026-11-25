// One sheet supplies sunlit limestone, jade tile, lacquer, paving and the red team's tile dye.
export const stone=0,jadeTile=1,timber=2,paving=3,plain=4,clayTile=5,slate=6,flagFace=7;
export function addUv(array,cell,u,v){
  const margin=.009;
  u=Math.max(0,Math.min(1,u));v=Math.max(0,Math.min(1,v));
  array.push((cell%2+margin+u*(1-2*margin))/2,1-(Math.floor(cell/2)+margin+v*(1-2*margin))/4);
}

// Each bevel or flag is built face by face. Neighboring triangles can share a corner
// only if its position, normal, baked tint and atlas coordinates all match.
export function indexStoneFaces(T,geometry){
  const fields=Object.values(geometry.attributes);
  const pos=geometry.attributes.position.array,total=geometry.attributes.position.count;
  const Index=total<=65535?Uint16Array:Uint32Array,indices=new Index(total);
  let count=0;
  for(let src=0;src<total;src++){
    let corner=-1;
    search:for(let j=count-1;j>=Math.max(0,count-10);j--){
      if(pos[3*src]!==pos[3*j]||pos[3*src+1]!==pos[3*j+1]||pos[3*src+2]!==pos[3*j+2])continue;
      for(const {array,itemSize} of fields){
        for(let k=0;k<itemSize;k++)if(array[src*itemSize+k]!==array[j*itemSize+k])continue search;
      }
      corner=j;break;
    }
    if(corner<0){
      corner=count++;
      if(corner!==src)for(const {array,itemSize} of fields){
        for(let k=0;k<itemSize;k++)array[corner*itemSize+k]=array[src*itemSize+k];
      }
    }
    indices[src]=corner;
  }
  for(const [name,field] of Object.entries(geometry.attributes)){
    geometry.setAttribute(name,new T.BufferAttribute(field.array.slice(0,count*field.itemSize),field.itemSize,field.normalized));
  }
  geometry.setIndex(new T.BufferAttribute(indices,1));
}
export function architectureArt(T){
  const blank=new T.DataTexture(new Uint8Array([228,228,216,255]),1,1);
  blank.colorSpace=T.SRGBColorSpace;blank.needsUpdate=true;
  const pending=new Set();
  let loading=null,closed=false,sheet=null;
  function bind(material){
    material.map=sheet||blank;
    if(!sheet&&!closed)pending.add(material);
    return material;
  }
  return {bind,start(){
    if(!loading&&!closed)loading=new T.TextureLoader().loadAsync(new URL("./assets/estuary-architecture-scout.webp",import.meta.url).href).then(atlas=>{
      if(closed){atlas.dispose();return;}
      atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=1;sheet=atlas;
      for(const material of pending)material.map=atlas;
      pending.clear();blank.dispose();
    }).catch(()=>{});
    return loading;
  },dispose(){closed=true;pending.clear();if(sheet)sheet.dispose();else blank.dispose();}};
}
