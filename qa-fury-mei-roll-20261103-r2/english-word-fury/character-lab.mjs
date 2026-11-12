import {ArenaView} from './view.mjs?v=qa-fury-mei-roll-20261103-r2';
import {fighter,moveFor,total} from './combat.mjs';
const $=id=>document.getElementById(id),status=$('status');
let view,playing=true,angled=false,time=0,tick=0;
try {
 view=new ArenaView($('scene'),$('overlay'));await view.preload();view.backdrop.visible=false;
 view.camera.left=-2.8;view.camera.right=2.8;view.camera.top=2.25;view.camera.bottom=-2.25;
 const camera=()=>{view.camera.position.set(angled?7:0,angled?2.2:1.8,angled?9:15);view.camera.lookAt(0,1.8,.7);view.camera.updateProjectionMatrix();};camera();
 let f;
 const select=()=>{time=0;$('frame').max=moveFor(f,$('move').value)?total(moveFor(f,$('move').value)):60;};$('move').onchange=select;
 const selectCharacter=()=>{f=fighter(Number($('fighter-select').value),0);f.x=f.px=0;view.select([f.id]);select();};$('fighter-select').onchange=selectCharacter;selectCharacter();
 $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暂停':'播放';};
 $('frame').oninput=()=>{playing=false;$('play').textContent='播放';time=+$('frame').value;};
 $('angle').onclick=()=>{angled=!angled;camera();};
 let last=performance.now();function draw(now){const dt=Math.min((now-last)/1000,.05);last=now;const kind=$('move').value,spec=moveFor(f,kind),duration=spec?total(spec):60;
 if(playing)time=(time+dt*30)%(duration+12);const frame=Math.min(Math.floor(time),duration);$('frame').value=frame;
 f.action=spec&&time<=duration?{spec,frame}:null;f.state=spec?'idle':kind;f.stateFrame=frame;f.walkPhase=time*Math.PI/15;f.vx=kind==='walk'?.03:0;
 view.resize();view.camera.left=-2.25*view.w/view.h;view.camera.right=2.25*view.w/view.h;view.camera.updateProjectionMatrix();view.actor(view.models[0],f,null,0,tick++);view.renderer.render(view.scene,view.camera);
 const phase=!spec?'':kind==='highKick'&&f.id===0?(frame<spec.startup*.6?'提膝':frame<spec.startup?'转髋出腿':frame<spec.startup+spec.active?'有效判定':frame<spec.startup+spec.active+spec.recovery*.38?'收膝':'落脚回防'):(frame<spec.startup?'蓄力':frame<spec.startup+spec.active?'有效判定':'收招');$('readout').textContent=`${frame} ${phase}`;requestAnimationFrame(draw);
 }status.textContent='样板以半速播放；不代表已通过真实对战验收。';requestAnimationFrame(draw);
}catch(error){status.textContent='WebGL 或模型加载失败：'+error.message;console.error(error);}
