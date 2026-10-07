// Shared-geometry near-plane guard. Bounds are cached per instance, triangle AABBs
// per template geometry; streaming does not retain an ever-growing mesh registry.
export function createNearPlaneGuard({T,quality,meshes}){
 const worldCache=new WeakMap(),geometryCache=new Map(),limit=quality==='low'?50000:100000;
 const localPoint=new T.Vector3(),closest=new T.Vector3(),triangle=new T.Triangle();
 let storedTriangles=0;const stats={queries:0,meshBounds:0,triangleBounds:0,triangleTests:0,cacheBuilds:0,cacheBytes:0,cachedTriangles:0,evictions:0};
 function world(mesh){let c=worldCache.get(mesh);if(c&&c.matrix.equals(mesh.matrixWorld)&&c.geometry===mesh.geometry)return c;
  const g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();const e=mesh.matrixWorld.elements;
  const scale=Math.max(1e-5,Math.min(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10])));
  c={geometry:g,matrix:mesh.matrixWorld.clone(),inverse:mesh.matrixWorld.clone().invert(),bounds:g.boundingBox.clone().applyMatrix4(mesh.matrixWorld),scale};worldCache.set(mesh,c);return c;
 }
 function geometry(g){if(geometryCache.has(g)){const c=geometryCache.get(g);geometryCache.delete(g);geometryCache.set(g,c);return c;}
  const a=g.attributes.position,index=g.index,count=Math.floor((index?.count??a.count)/3),data=new Float32Array(count*6);
  for(let i=0;i<count;i++){const k=i*3;triangle.a.fromBufferAttribute(a,index?index.getX(k):k);triangle.b.fromBufferAttribute(a,index?index.getX(k+1):k+1);triangle.c.fromBufferAttribute(a,index?index.getX(k+2):k+2);
   data.set([Math.min(triangle.a.x,triangle.b.x,triangle.c.x),Math.min(triangle.a.y,triangle.b.y,triangle.c.y),Math.min(triangle.a.z,triangle.b.z,triangle.c.z),Math.max(triangle.a.x,triangle.b.x,triangle.c.x),Math.max(triangle.a.y,triangle.b.y,triangle.c.y),Math.max(triangle.a.z,triangle.b.z,triangle.c.z)],i*6);}
  while(geometryCache.size&&storedTriangles+count>limit){const key=geometryCache.keys().next().value;storedTriangles-=geometryCache.get(key).count;geometryCache.delete(key);stats.evictions++;}
  const c={a,index,count,data};geometryCache.set(g,c);storedTriangles+=count;stats.cacheBuilds++;stats.cacheBytes=storedTriangles*24;stats.cachedTriangles=storedTriangles;return c;
 }
 function touches(position,radius){stats.queries++;
  for(const mesh of meshes){const w=world(mesh);stats.meshBounds++;if(w.bounds.distanceToPoint(position)>radius)continue;
   localPoint.copy(position).applyMatrix4(w.inverse);const r=radius/w.scale,r2=r*r,c=geometry(mesh.geometry),data=c.data;
   for(let i=0;i<c.count;i++){const o=i*6;stats.triangleBounds++;const dx=Math.max(data[o]-localPoint.x,0,localPoint.x-data[o+3]),dy=Math.max(data[o+1]-localPoint.y,0,localPoint.y-data[o+4]),dz=Math.max(data[o+2]-localPoint.z,0,localPoint.z-data[o+5]);if(dx*dx+dy*dy+dz*dz>=r2)continue;
    const k=i*3;stats.triangleTests++;triangle.a.fromBufferAttribute(c.a,c.index?c.index.getX(k):k);triangle.b.fromBufferAttribute(c.a,c.index?c.index.getX(k+1):k+1);triangle.c.fromBufferAttribute(c.a,c.index?c.index.getX(k+2):k+2);triangle.closestPointToPoint(localPoint,closest);if(closest.distanceToSquared(localPoint)<r2)return true;}
  }return false;
 }
 function resetFrame(){for(const key of ['queries','meshBounds','triangleBounds','triangleTests'])stats[key]=0;}
 return{touches,resetFrame,stats,get limits(){return{maxCachedTriangles:limit,maxCacheBytes:limit*24,cacheGeometryCount:geometryCache.size,nearPlaneMeshes:meshes.length,perInstanceTriangleCopies:false};}};
}
