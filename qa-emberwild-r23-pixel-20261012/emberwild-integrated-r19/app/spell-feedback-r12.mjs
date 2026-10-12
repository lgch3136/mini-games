import {spellDefinition} from './spell-definitions-r12.mjs';
// Read-only cast progress and a one-per-boot introduction for existing journeys.
export function createSpellFeedback({document=globalThis.document,openCatalog=()=>{},clearInput=()=>{},restoreFocus=()=>{}}={}){
 const root=document.createElement('div');root.className='spell-cast-feedback-r12';root.hidden=true;root.setAttribute('role','status');
 const label=document.createElement('span');label.className='spell-cast-name-r12';const time=document.createElement('span');time.className='spell-cast-time-r12';
 const bar=document.createElement('progress');bar.max=1;bar.value=0;bar.setAttribute('aria-label','施法进度');const hint=document.createElement('small');hint.textContent='移动、跳跃或闪避可取消';root.append(label,time,bar,hint);document.body.append(root);
 const intro=document.createElement('aside');intro.className='spell-intro-r12';intro.hidden=true;intro.setAttribute('aria-label','新法术已可用');
 const description=document.createElement('p');description.textContent='新法术已可用：焰矢、霜棘、星坠。你的原有技能栏已保留，可在编排技能中选择空槽。';
 const open=document.createElement('button');open.textContent='编排技能';open.dataset.action='openSpellCatalog';
 const dismiss=document.createElement('button');dismiss.textContent='知道了';dismiss.dataset.action='dismissSpellIntro';
 function showIntro(visible){intro.hidden=!visible;document.body.classList.toggle('spell-intro-visible-r12',visible);}
 open.addEventListener('click',()=>{clearInput();showIntro(false);openCatalog();});dismiss.addEventListener('click',()=>{clearInput();showIntro(false);restoreFocus();});intro.append(description,open,dismiss);document.body.append(intro);
 let introduced=false;
 function showIntroduction(){if(introduced)return;introduced=true;showIntro(true);}
 function update(snapshot,{playing=true,paused=false,dead=false,hidden=false}={}){
  const cast=snapshot?.casting,visible=!!cast&&playing&&!paused&&!dead&&!hidden;root.hidden=!visible;
  if(visible){const spell=spellDefinition(cast.spellId);label.textContent=spell?.name??'施法';const progress=Math.min(1,Math.max(0,cast.age/cast.duration));bar.value=progress;bar.setAttribute('aria-valuetext',`完成 ${Math.round(progress*100)}%`);bar.setAttribute('aria-label',(spell?.name??'法术')+'施法进度');time.textContent=Math.max(0,cast.duration-cast.age).toFixed(1)+' 秒';}
  if(dead||!playing)showIntro(false);
 }
 return {update,showIntroduction,diagnostics:()=>({castingVisible:!root.hidden,introductionVisible:!intro.hidden,introduced,progress:bar.value,name:label.textContent}),dispose(){showIntro(false);root.remove();intro.remove();}};
}
