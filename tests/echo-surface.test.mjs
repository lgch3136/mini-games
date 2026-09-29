import test from 'node:test';
import assert from 'node:assert/strict';
import { MembraneSurface } from '../english-echo-ring/surface.mjs';
import { FlowField } from '../english-echo-ring/field.mjs';

function environment(gl) {
  const previous=globalThis.document, listeners=new Map();
  const canvas={width:0,height:0,getContext:()=>gl,
    addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  globalThis.document={createElement:()=>canvas};
  return {canvas,listeners,restore:()=>{if(previous)globalThis.document=previous;else delete globalThis.document;}};
}
function gpu() {
  const counts={textures:0,buffers:0,programs:0,shaders:0,lost:0,draws:0};
  const gl={
    createTexture:()=>{counts.textures++;return {};},deleteTexture:()=>counts.textures--,
    createBuffer:()=>{counts.buffers++;return {};},deleteBuffer:()=>counts.buffers--,
    createProgram:()=>{counts.programs++;return {};},deleteProgram:()=>counts.programs--,
    createShader:()=>{counts.shaders++;return {};},deleteShader:()=>counts.shaders--,
    getShaderParameter:()=>true,getProgramParameter:()=>true,
    getAttribLocation:()=>0,getUniformLocation:()=>({}),
    getExtension:()=>({loseContext:()=>counts.lost++}),
    drawArrays:()=>counts.draws++,
  };
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','useProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','bindTexture','texParameteri','texImage2D','uniform1i','uniform1f','activeTexture','disable','viewport','texSubImage2D'])gl[name]=()=>{};
  return {gl,counts};
}
test('unavailable material is an optional effect, not a startup failure',()=>{
  const env=environment(null);
  try {
    const surface=new MembraneSurface();surface.resize(500);
    assert.equal(surface.diagnostics().mode,'canvas2d');
    assert.equal(surface.diagnostics().reason,'webgl-unavailable');
    assert.equal(surface.render(null,null),false);
    surface.dispose();surface.dispose();
    assert.equal(surface.diagnostics().textureBytes,0);
    assert.equal(env.listeners.size,0);
  } finally {env.restore();}
});
test('single-pass material has fixed GPU storage and idempotent disposal',()=>{
  const {gl,counts}=gpu(), env=environment(gl);
  try {
    const surface=new MembraneSurface(), f=new FlowField(), edge=new Float32Array(192).fill(280);
    surface.resize(9999);assert.equal(surface.pixels,512);
    f.sample();const bytes=surface.bytes,boundary=surface.boundaryBytes;
    for(let i=0;i<300;i++)assert.equal(surface.render(f,edge),true);
    assert.equal(surface.bytes,bytes);assert.equal(surface.boundaryBytes,boundary);
    assert.equal(surface.diagnostics().textureBytes,5380);
    assert.deepEqual(counts,{textures:2,buffers:1,programs:1,shaders:0,lost:0,draws:300});
    let prevented=false;env.listeners.get('webglcontextlost')({preventDefault:()=>{prevented=true;}});
    assert.ok(prevented);assert.equal(surface.render(f,edge),false);
    assert.equal(surface.diagnostics().mode,'canvas2d');
    surface.dispose();surface.dispose();
    assert.deepEqual(counts,{textures:0,buffers:0,programs:0,shaders:0,lost:1,draws:300});
    assert.equal(surface.diagnostics().drawCalls,0);assert.equal(env.listeners.size,0);
  } finally {env.restore();}
});
