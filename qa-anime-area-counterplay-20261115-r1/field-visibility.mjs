// Static terrain keeps one material and one draw. Only visible cells enter the index buffer.
export function fieldVisibility(T,geometry,detailSize=0,motionPad=0){
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
  if(detailSize){
    // Preserve the authored triangle order, including in the non-stencil foliage
    // pass. Subviews share each coarse cell's immutable index storage.
    for(const cell of cells){
      const indices=cell.indices,bins=new Map(),runs=[];
      let previous=null,start=0;
      for(let i=0;i<indices.length;i+=3){
        const a=indices[i],b=indices[i+1],c=indices[i+2];
        const x=(points.getX(a)+points.getX(b)+points.getX(c))/3;
        const z=(points.getZ(a)+points.getZ(b)+points.getZ(c))/3;
        const k=Math.floor((x+48)/detailSize)*4096+Math.floor((z+48)/detailSize);
        let bin=bins.get(k);
        if(!bin){bin={box:new T.Box3(),seen:true};bins.set(k,bin);}
        for(let j=i;j<i+3;j++)bin.box.expandByPoint(scratch.fromBufferAttribute(points,indices[j]));
        if(bin!==previous){
          if(previous)runs.push({bin:previous,indices:indices.subarray(start,i)});
          start=i;previous=bin;
        }
      }
      if(previous)runs.push({bin:previous,indices:indices.subarray(start)});
      cell.bins=[...bins.values()];cell.runs=runs;cell.full=true;
      cell.box.expandByScalar(motionPad);
      for(const bin of cell.bins)bin.box.expandByScalar(motionPad);
    }
  }
  return frustum=>{
    let changed=false;
    for(const cell of cells){
      const inside=frustum.intersectsBox(cell.box);
      if(inside!==cell.seen){cell.seen=inside;changed=true;}
      if(!inside||!cell.bins)continue;
      cell.full=true;
      for(const bin of cell.bins){
        const visible=frustum.intersectsBox(bin.box);
        if(visible!==bin.seen){bin.seen=visible;changed=true;}
        if(!visible)cell.full=false;
      }
    }
    if(!changed)return;
    let n=0;
    for(const cell of cells){
      if(!cell.seen)continue;
      if(!cell.bins||cell.full){target.set(cell.indices,n);n+=cell.indices.length;continue;}
      for(const run of cell.runs)if(run.bin.seen){target.set(run.indices,n);n+=run.indices.length;}
    }
    geometry.setDrawRange(0,n);if(n){attr.clearUpdateRanges();attr.addUpdateRange(0,n);attr.needsUpdate=true;}
  };
}
