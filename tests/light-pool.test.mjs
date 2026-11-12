import test from 'node:test';
import assert from 'node:assert/strict';
import {T} from '../shared/first-person/scene.mjs?v=20260918-play-r1';
import {LightPool} from '../shared/light/pool.mjs';
function fixture(cap=32){
  const kit={scene:new T.Scene(),geometries:new Set(),materials:new Map()};
  const pool=new LightPool(kit,new T.Texture(),cap),camera=new T.PerspectiveCamera();
  return {kit,pool,camera};
}
test('light pass is depth tested, non-shadowing and bounded to one mesh',()=>{
  const {kit,pool,camera}=fixture();pool.begin(1/60,camera);
  for(let i=0;i<300;i++)pool.add(i,1,2,3,0xafffee,.4);
  pool.end();assert.equal(pool.mesh.count,32);assert.equal(kit.scene.children.length,1);
  assert.equal(pool.material.depthTest,true);assert.equal(pool.material.depthWrite,false);
  assert.equal(pool.material.forceSinglePass,true);
  assert.equal(pool.mesh.castShadow,false);assert.equal(pool.mesh.receiveShadow,false);
  assert.ok([...pool.mesh.instanceMatrix.array].every(Number.isFinite));
});
test('burst slots are reused and decay completely without geometry growth',()=>{
  const {kit,pool,camera}=fixture();const buffer=pool.mesh.instanceMatrix.array;
  for(let i=0;i<10000;i++)pool.emit(1,2,3,0xffffff,2,.4);
  assert.equal(pool.active,24);assert.equal(pool.flares.length,24);
  for(let i=0;i<100;i++){pool.begin(1/60,camera);pool.end();}
  assert.equal(pool.active,0);assert.equal(pool.mesh.count,0);
  assert.equal(pool.mesh.instanceMatrix.array,buffer);assert.equal(kit.geometries.size,1);
  assert.equal(kit.materials.size,1);
});
test('reduced motion lowers light energy; menu and disposal release instances',()=>{
  const {kit,pool,camera}=fixture();pool.emit(1,2,3,0xffffff);
  pool.begin(0,camera,false);pool.end();const normal=pool.mesh.instanceColor.array[0];
  pool.begin(0,camera,true);pool.end();assert.ok(pool.mesh.instanceColor.array[0]<normal*.5);
  pool.clear();assert.equal(pool.mesh.count,0);assert.equal(pool.active,0);
  let disposed=false;pool.mesh.addEventListener('dispose',()=>{disposed=true;});
  pool.dispose();assert.equal(disposed,true);assert.equal(kit.scene.children.length,0);
});
test('optional light switch removes the pass without changing pool bounds',()=>{
  const {pool,camera}=fixture();pool.enabled=false;pool.emit(1,2,3);
  pool.begin(1/60,camera);pool.add(1,2,3,2,0xffffff);pool.end();
  assert.equal(pool.mesh.count,0);assert.equal(pool.capacity,32);
  pool.enabled=true;pool.begin(1/60,camera);pool.end();assert.equal(pool.mesh.count,1);
});
