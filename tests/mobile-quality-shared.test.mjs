import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GAME_GUIDE,matchesGame,normalizeQuery,readRecent,saveRecent} from '../shared/arcade-catalog.mjs';
test('catalog describes all 15 production game directories',()=>{
 assert.equal(Object.keys(GAME_GUIDE).length,15);
 for(const id of Object.keys(GAME_GUIDE))assert.ok(fs.existsSync(new URL(`../${id}/index.html`,import.meta.url)));
});
test('query matches normalized full-width text and every token',()=>{
 assert.equal(normalizeQuery(' ＡＰＥＸ  '),'apex');
 const game={category:'racing',session:'immersive',text:'团团卡丁 APEX DRIVE 横屏漂移'};
 assert.ok(matchesGame(game,{filter:'racing',pace:'immersive',query:'ＡＰＥＸ 漂移'}));
 assert.ok(!matchesGame(game,{filter:'action'}));
 assert.ok(!matchesGame(game,{pace:'quick'}));
 assert.ok(!matchesGame(game,{query:'APEX 不存在'}));
});
test('recent entry accepts only actual games and finite time, survives blocked/corrupt storage',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(readRecent(storage),null);
 assert.equal(saveRecent(storage,'javascript:alert(1)'),false);
 assert.equal(saveRecent(storage,'english-echo-ring',NaN),false);
 assert.equal(saveRecent(storage,'english-echo-ring',120),true);
 assert.deepEqual(readRecent(storage),{id:'english-echo-ring',at:120});
 data.set('arcade.recent.v1','{"id":"__proto__","at":1}');assert.equal(readRecent(storage),null);
 data.set('arcade.recent.v1','bad');assert.equal(readRecent(storage),null);
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 assert.equal(readRecent(denied),null);assert.equal(saveRecent(denied,'english-echo-ring'),false);
 assert.equal(readRecent(undefined),null);assert.equal(saveRecent(undefined,'english-echo-ring'),false);
});
test('Godot-authored reward curve is finite, bounded, settles exactly and remains lightweight',()=>{
 const motion=JSON.parse(fs.readFileSync(new URL('../shared/mobile-art/reward-motion.json',import.meta.url)));
 assert.equal(motion.engine,'Godot 4.6');assert.equal(motion.samples.length,21);
 assert.equal(motion.samples[0].scale,.66);assert.equal(motion.samples.at(-1).scale,1);assert.equal(motion.samples.at(-1).y,0);
 for(const s of motion.samples){assert.ok(Number.isFinite(s.scale)&&s.scale>=.66&&s.scale<1.05);assert.ok(s.y>=0&&s.y<=12);}
 for(const rank of ['bronze','silver','gold','prism']){
  const bytes=fs.readFileSync(new URL(`../shared/mobile-art/medal-${rank}.webp`,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.ok(bytes.length<16000);
 }
});
import { Shell } from '../shared/first-person/shell.mjs';
test('Apex/Strike BFCache pagehide preserves explicit pause instead of a frozen playing state',()=>{
 const calls=[], shell={mode:'playing',pause(){this.mode='paused';calls.push('pause')},stop(){calls.push('stop')},dispose(){calls.push('dispose')}};
 Shell.prototype.pageHide.call(shell,{persisted:true});assert.equal(shell.mode,'paused');assert.deepEqual(calls,['pause']);
 Shell.prototype.pageHide.call(shell,{persisted:true});assert.deepEqual(calls,['pause','stop']);
 Shell.prototype.pageHide.call(shell,{persisted:false});assert.deepEqual(calls,['pause','stop','stop','dispose']);
});
test('BFCache restore clears stale input and redraws without automatically advancing or sounding',()=>{
 const calls=[],shell={mode:'paused',destroyed:false,world:{},view:{ready:true,resize(){calls.push('resize')},render(){calls.push('render')}},controls:{clear(){calls.push('clear')}},applyMode(){calls.push('mode')},pause(){calls.push('pause');this.mode='paused'}};
 Shell.prototype.pageShow.call(shell,{persisted:false});assert.deepEqual(calls,[]);
 Shell.prototype.pageShow.call(shell,{persisted:true});assert.deepEqual(calls,['clear','resize','render','mode']);assert.equal(shell.mode,'paused');
 shell.destroyed=true;Shell.prototype.pageShow.call(shell,{persisted:true});assert.equal(calls.length,4);
});
test('returning during asset preparation does not render an uninitialized world',()=>{
 let calls=0;const shell={world:null,destroyed:false,view:{ready:true,resize(){calls++},render(){calls++}}};
 Shell.prototype.pageShow.call(shell,{persisted:true});assert.equal(calls,0);
});
