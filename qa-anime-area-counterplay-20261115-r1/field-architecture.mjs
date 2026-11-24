// One sheet supplies sunlit limestone, jade tile, lacquer, paving and the red team's tile dye.
export const stone=0,jadeTile=1,timber=2,paving=3,plain=4,clayTile=5;
export function addUv(array,cell,u,v){
  const margin=.009;
  u=Math.max(0,Math.min(1,u));v=Math.max(0,Math.min(1,v));
  array.push((cell%2+margin+u*(1-2*margin))/2,1-(Math.floor(cell/2)+margin+v*(1-2*margin))/3);
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
    if(!loading&&!closed)loading=new T.TextureLoader().loadAsync(new URL("./assets/river-masonry.webp",import.meta.url).href).then(atlas=>{
      if(closed){atlas.dispose();return;}
      atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=1;sheet=atlas;
      for(const material of pending)material.map=atlas;
      pending.clear();blank.dispose();
    }).catch(()=>{});
    return loading;
  },dispose(){closed=true;pending.clear();if(sheet)sheet.dispose();else blank.dispose();}};
}
