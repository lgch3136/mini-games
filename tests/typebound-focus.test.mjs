import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceMetrics,KeyLight} from '../english-typebound/focus-render.mjs';
test('average WPM counts committed text only, with the opening guard',()=>{
  const g={time:60,accuracy:97.5,stats:{committed:250,words:42}};
  assert.deepEqual(practiceMetrics(g),{seconds:60,wpm:50,accuracy:97.5,words:42});
  g.cursor=12; assert.equal(practiceMetrics(g).wpm,50);
  g.time=2.99; assert.equal(practiceMetrics(g).wpm,null);
});
test('only accepted fresh input creates a bounded light pulse',()=>{
  const f=new KeyLight(),g={word:{en:'apple'}};
  f.event({type:'letter',cursor:1,fresh:false},g); assert.equal(f.pulses.length,0);
  f.event({type:'letter',cursor:1,fresh:true},g); assert.equal(f.target,.2);
  f.step(1/60,.2); assert.ok(f.position>0 && f.position<.2);
  for(let i=0;i<1000;i++) f.event({type:'letter',cursor:3,fresh:true},g);
  assert.equal(f.pulses.length,24);
  for(let i=0;i<300;i++)f.step(1/120,.6);
  assert.equal(f.pulses.length,0);assert.ok(f.energy<.001);
});
test('completion and error have distinct responses; clear releases state',()=>{
  const f=new KeyLight();f.event({type:'word',clean:true},{});
  assert.equal(f.release,1);assert.equal(f.target,1);
  f.event({type:'wrong'},{});assert.equal(f.error,1);
  f.clear();assert.equal(f.energy+f.release+f.error+f.position+f.pulses.length,0);
});
test('spring response is continuous at 30 Hz and 144 Hz',()=>{
  const a=new KeyLight(),b=new KeyLight();
  for(let i=0;i<30;i++)a.step(1/30,.8);
  for(let i=0;i<144;i++)b.step(1/144,.8);
  assert.ok(Math.abs(a.position-b.position)<1e-9);
});
test('an invalid or stalled frame cannot poison the input light',()=>{
  const f=new KeyLight();
  for(const dt of [NaN,Infinity,-1,0])f.step(dt,.8);
  assert.equal(f.position,0);assert.equal(f.velocity,0);
  f.step(600,.8);assert.ok(Number.isFinite(f.position) && f.position>0 && f.position<.8);
});
