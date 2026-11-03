import {Sound} from "./audio.mjs";
import {HarborMusic} from "./music.mjs?v=fogharbor-r8";
import {World,STEP,UPGRADES} from './engine.mjs';
import {Renderer} from './render.mjs?v=fogharbor-r8';
import {readRecord,saveRecord} from './storage.mjs';
const $=id=>document.getElementById(id);
try{
 const sound=new Sound(),music=new HarborMusic();
 function unlockAudio(){sound.unlock();music.attach(sound.ctx);}
 function refreshMusicControls(){for(const b of document.querySelectorAll("[data-music-toggle]")){b.textContent=music.enabled?"配乐：开":"配乐：关";b.setAttribute("aria-pressed",String(music.enabled));}for(const v of document.querySelectorAll("[data-music-volume]"))v.value=String(Math.round(music.volume*100));}
 for(const b of document.querySelectorAll("[data-music-toggle]"))b.onclick=()=>{unlockAudio();music.setEnabled(!music.enabled);refreshMusicControls();};
 for(const v of document.querySelectorAll("[data-music-volume]"))v.oninput=()=>{unlockAudio();music.setVolume(Number(v.value)/100);refreshMusicControls();};
 refreshMusicControls();
 const renderer=new Renderer($('game'));let world=new World(),screen='menu',last=0,acc=0,record=readRecord({getItem:k=>localStorage.getItem(k)}),saved=false,lastStatus='',run=0;
 const artStatus=$('art-status');
 if(renderer.status==='loading'){
  $('start').disabled=true;artStatus.textContent='正在载入原创战场素材…';
  renderer.ready.then(ok=>{
   $('start').disabled=false;
   artStatus.textContent=ok?'原创战场画面 r8 · 完整实玩验收待完成':'战场素材未载入：'+renderer.error+'。可使用基础场景回退，不代表新美术加载成功。';
   if(!ok)$('start').firstChild.textContent='基础场景试玩 ';
  });
 }
 const keys=new Set();let stick={x:0,y:0},dash=false,stickId=null;
 function clearInput(){keys.clear();stick={x:0,y:0};dash=false;stickId=null;$('joystick').firstElementChild.style.transform='';}
 function show(s){screen=s;if(s!=='playing')music.stop();for(const id of ['menu','upgrade','paused','result'])$(id).hidden=id!==s;$('hud').hidden=s==='menu';}
 function recordText(){ $('record').textContent=`守港成功 ${record.wins} 次 · 最多击退 ${record.bestKills} 敌`; }
 function start(){if(renderer.status==='loading')return;unlockAudio();music.reset();clearInput();world=new World(817+run++*7919);saved=false;acc=0;last=0;lastStatus='';show('playing');}
 function pause(){if(world.status==='playing'&&screen!=='menu'){world.pause();clearInput();acc=0;sync();}}
 function resume(){if(document.hidden)return;unlockAudio();world.resume();clearInput();acc=0;last=0;sync();}
 function choose(id){unlockAudio();if(world.choose(id)){sound.play("upgrade");clearInput();acc=0;last=0;lastStatus='';sync();}}
 function sync(){if(screen==='menu')return;if(world.status===lastStatus)return;lastStatus=world.status;
 if(world.status==='upgrade'){clearInput();show('upgrade');$('upgrade-note').textContent=`等级 ${world.level} · 决策期间潮汐暂停 · 当前铜灯弹估算DPS ${world.dps}`;$('cards').replaceChildren(...world.choices.map((u,i)=>{let b=document.createElement('button');b.className='card';let count=world.upgrades[u.id]||0;b.innerHTML=`<span class="num">${i+1}</span><small>${u.tag} · ${count?'等级 '+(count+1):'新改装'}</small><span class="icon">${({split:'⋔',orbit:'◉',pierce:'➶',power:'✦',haste:'ϟ',stride:'»',magnet:'⌁',hull:'⬡'})[u.id]}</span><h3>${u.name}</h3><p>${u.note}</p>`;b.onclick=()=>choose(u.id);return b;}));}
 else if(world.status==='paused'){show('paused');$('stats').replaceChildren();const lines=[`铜灯弹 Lv.${1+(world.upgrades.power||0)+(world.upgrades.haste||0)+(world.upgrades.split||0)+(world.upgrades.pierce||0)} · 估算DPS ${world.dps}`,`弹数 ${world.player.shots} / 贯穿 ${world.player.pierce} / 灯刃 ${world.player.orbit}`,`生命 ${Math.ceil(world.player.hp)}/${world.player.maxHp} · 港灯 ${world.lit}/3`,...Object.entries(world.upgrades).map(([id,n])=>UPGRADES.find(u=>u.id===id).name+' ×'+n)];for(const text of lines){let p=document.createElement('div');p.textContent=text;$('stats').appendChild(p);}}
 else if(world.status==='won'||world.status==='lost'){clearInput();show('result');let saveOK=true;if(!saved){const result=saveRecord({setItem:(k,v)=>localStorage.setItem(k,v)},record,world);record=result.record;saveOK=result.saved;saved=true;recordText();}$('result-tag').textContent=world.status==='won'?'HARBOR SECURED':'THE TIDE RETURNS';$('result-title').textContent=world.reason;$('result-stats').textContent=`坚持 ${Math.floor(world.time)} 秒 · 击退 ${world.kills} · 港灯 ${world.lit}/3 · 构筑等级 ${world.level}${saveOK?'':' · 本地存档不可用，成绩仅本次保留'}`;}
 else show('playing'); }
 function hud(){const p=world.player,left=Math.max(0,Math.ceil(180-world.time));$('clock').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');$('hpbar').style.width=(p.hp/p.maxHp*100)+'%';$('hp').textContent=`生命 ${Math.ceil(p.hp)} / ${p.maxHp}`;$('mission').textContent=`港灯 ${world.lit}/3 · ${world.bossKilled?'潮王已退':world.time>=140?'击退潮王！':'潮王 '+Math.ceil(140-world.time)+'秒后抵港'}`;$('xpbar').style.width=Math.min(100,world.xp/world.need*100)+'%';$('level').textContent=`Lv.${world.level} · 余烬 ${world.xp}/${world.need}`;$('build').textContent=`铜灯弹 DPS≈${world.dps} · ${p.shots}弹 / 穿透${p.pierce} / 灯刃${p.orbit} · 击退 ${world.kills}`;$('dash').firstChild.textContent=p.dashCD>0?p.dashCD.toFixed(1)+'秒':'冲刺 ';$('dash').style.opacity=p.dashCD>0?.55:1;const msg=world.messages.filter(m=>m.until>world.time).at(-1);$('toast').textContent=msg?.text||'';const boss=world.enemies.items.find(e=>e.active&&e.kind==='boss');$('boss').hidden=!boss;if(boss)$('bossbar').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';}
 function frame(now){let dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(world.status==='playing'&&screen==='playing'&&!document.hidden){acc+=dt;let steps=0;while(acc>=STEP&&steps<5&&world.status==='playing'){let x=stick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=stick.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const oldKills=world.kills,oldHP=world.player.hp,oldLit=world.lit,oldDash=world.player.dash;world.step({x,y,dash});if(world.player.hp<oldHP)sound.play("hurt");else if(world.lit>oldLit)sound.play("lamp");else if(world.player.dash>oldDash)sound.play("dash");else if(world.kills>oldKills)sound.play("hit");dash=false;acc-=STEP;steps++;}if(steps===5)acc=0;}else acc=0;sync();music.update({playing:screen==='playing'&&world.status==='playing'&&!document.hidden,time:world.time,bossKilled:world.bossKilled});renderer.render(world,world.status==='playing'?acc/STEP:1);if(screen!=='menu')hud();requestAnimationFrame(frame);}
 window.addEventListener('keydown',e=>{if(e.target?.matches?.('[data-music-volume],[data-music-toggle]'))return;let k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;if(screen==='upgrade'&&['1','2','3'].includes(k)){let u=world.choices[Number(k)-1];if(u)choose(u.id);return;}if(k==='p'||k==='escape'){if(world.status==='paused')resume();else pause();return;}if(screen!=='playing')return;keys.add(k);if(k===' ')dash=true;});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
 window.addEventListener('pagehide',()=>music.stop());
 window.addEventListener('blur',()=>{music.stop();clearInput();pause();});document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden){music.stop();pause();}});
 const joy=$('joystick');function move(e){if(e.pointerId!==stickId)return;let r=joy.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/40,y=(e.clientY-r.top-r.height/2)/40,d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}stick={x,y};joy.firstElementChild.style.transform=`translate(${x*28}px,${y*28}px)`;}
 joy.addEventListener('pointerdown',e=>{if(screen!=='playing')return;stickId=e.pointerId;joy.setPointerCapture(e.pointerId);move(e);});joy.addEventListener('pointermove',move);for(const name of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(name,e=>{if(e.pointerId===stickId){stickId=null;stick={x:0,y:0};joy.firstElementChild.style.transform='';}});
 $('dash').addEventListener('pointerdown',e=>{e.preventDefault();if(screen==='playing')dash=true;});$('mute').onclick=()=>{sound.unlock();sound.muted=!sound.muted;$('mute').textContent=sound.muted?'静':'声';$('mute').setAttribute('aria-label',sound.muted?'开启音效':'关闭音效');};$('pause').onclick=pause;$('resume').onclick=resume;for(const id of ['start','restart','restart-pause'])$(id).onclick=start;$('home').onclick=()=>{clearInput();world.pause();show('menu');recordText();};new ResizeObserver(()=>renderer.resize()).observe($('stage'));recordText();requestAnimationFrame(frame);
}catch(error){$('error').hidden=false;$('error').textContent='试玩暂时无法启动，请刷新或换用支持 Canvas2D 的浏览器。\n'+String(error.message||error);}
