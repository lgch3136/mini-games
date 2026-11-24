// Static terrain keeps one material and one draw. Only visible cells enter the index buffer.
export function fieldVisibility(T,geometry){
  const points=geometry.attributes.position,original=geometry.index?.array;
  const count=original?.length??points.count,byCell=new Map(),scratch=new T.Vector3();
  const id=i=>original?original[i]:i;
  for(let i=0;i<count;i+=3){
    const a=id(i),b=id(i+1),c=id(i+2);
    const cx=(points.getX(a)+points.getX(b)+points.getX(c))/3,cz=(points.getZ(a)+points.getZ(b)+points.getZ(c))/3;
    const key=Math.floor((cx+48)/7.5)*32+Math.floor((cz+48)/7.5);
    let cell=byCell.get(key);if(!cell){cell={box:new T.Box3(),indices:[],seen:true};byCell.set(key,cell);}
    cell.indices.push(a,b,c);for(const v of [a,b,c])cell.box.expandByPoint(scratch.fromBufferAttribute(points,v));
  }
  const Index=points.count>65535?Uint32Array:Uint16Array,cells=[...byCell.values()],target=new Index(count);
  let size=0;for(const cell of cells){cell.indices=new Index(cell.indices);target.set(cell.indices,size);size+=cell.indices.length;}
  const attr=new T.BufferAttribute(target,1).setUsage(T.DynamicDrawUsage);geometry.setIndex(attr);geometry.setDrawRange(0,size);
  return frustum=>{
    let changed=false;for(const cell of cells){const inside=frustum.intersectsBox(cell.box);if(inside!==cell.seen){cell.seen=inside;changed=true;}}
    if(!changed)return;
    let n=0;for(const cell of cells)if(cell.seen){target.set(cell.indices,n);n+=cell.indices.length;}
    geometry.setDrawRange(0,n);if(n){attr.clearUpdateRanges();attr.addUpdateRange(0,n);attr.needsUpdate=true;}
  };
}
