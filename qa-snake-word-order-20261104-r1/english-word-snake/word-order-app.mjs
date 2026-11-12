import { STEP } from './engine.mjs?v=20261102-grammar-context-r1';
import { createWordOrderGame, WORDS } from './word-order.mjs?v=qa-snake-word-order-20261104-r1-new';
import { WordOrderInput } from './word-order-input.mjs?v=qa-snake-word-order-20261104-r1-new';
import { WordOrderRenderer } from './word-order-render.mjs?v=qa-snake-word-order-20261104-r1-new';

// This module deliberately imports no ordinary app, audio, vocabulary or storage.
export function mountWordOrder({ document:doc, window:win,
  rendererFactory=canvas=>new WordOrderRenderer(canvas) } = { document, window }) {
  const $=id=>doc.getElementById(id), canvas=$('game'), renderer=rendererFactory(canvas);
  let game=createWordOrderGame(), raf=0, previous=null, accumulator=0, eventId=0;
  let disposed=false, note='已暂停 · 先看图', lastTarget='';
  const events=new AbortController(), options={signal:events.signal};
  const focusBoard=()=>canvas.focus({preventScroll:true});
  const input=new WordOrderInput({document:doc,canvas,
    playing:()=>!disposed && game.phase==='playing',
    turn:direction=>game.input(direction),
    boost:held=>{game.boostHeld=game.phase==='playing' && held;},
    pause:()=>game.phase==='paused' ? resume() : pause(),
  });
  function stop() {
    if(raf) win.cancelAnimationFrame(raf);
    raf=0; previous=null; accumulator=0;
    game.clearInput(); game.boosting=false; input.release();
  }
  function hud() {
    $('phase-label').textContent=game.phase==='playing' ? '游动中' : game.phase==='over' ? '本次已结束' : note;
    $('stats').textContent=`${game.completed}/2 词 · ${game.letters}/6 字母 · ${game.steps} 步`;
    $('hearts').textContent='♥ '.repeat(Math.max(0,game.hp))+'♡ '.repeat(3-Math.max(0,game.hp));
    $('hearts').setAttribute('aria-label',`${game.hp} 点生命`);
    $('energy-note').textContent=`能量 ${Math.floor(game.energy)}%`;
    $('boost').classList.toggle('held',game.boosting);
    $('boost').disabled=game.phase!=='playing';
    for(const button of doc.querySelectorAll('[data-dir]')) button.disabled=game.phase!=='playing';
    $('pause').disabled=game.phase==='over';
    $('pause').textContent=game.phase==='playing' ? '暂停看图' : game.steps ? '继续游动' : '开始游动';
    const target=game.phase==='over' ? game.won ? 'CAT 与 DOG，取齐了！' : '路线在这里停下'
      : game.activeGroup ? `${game.word.en.toUpperCase()} · 下一口 ${game.target()?.label.toUpperCase() || ''}` : '任选 C 或 D';
    if(target!==lastTarget){$('target-note').textContent=target; lastTarget=target;}
    $('lock-note').textContent=game.phase==='over' ? '可以同图重试，重新选择首字。'
      : !game.activeGroup ? '先取到的首字会锁定整词。另一组留在图上，可穿过，不会吃掉。'
      : game.completed===0 ? `已锁定 ${game.word.en.toUpperCase()}。先按顺序取完整词，另一组暂时只是预览。`
      : `先完成了 ${game.completedOrder[0].toUpperCase()}，现在取 ${game.word.en.toUpperCase()}。走进下一字所在格才会采集。`;
    for(const group of Object.keys(WORDS)) {
      const done=game.completedOrder.includes(group), active=game.activeGroup===group;
      $(`${group}-state`).textContent=done ? '已完成 ✓' : !game.activeGroup ? '可先选' : active ? '正在采集' : '待下一词';
      $(`${group}-letters`).textContent=[...WORDS[group].en].map((letter,i)=>
        `${group==='cat'?'C':'D'}${i+1} · ${letter.toUpperCase()}${done||(active&&i<game.cursor)?' ✓':''}`).join(' → ');
    }
    $('result').hidden=game.phase!=='over';
    if(game.phase==='over'){
      $('result-title').textContent=game.won ? '两词完成！' : '换条路线再试试';
      $('result-detail').textContent=`${game.completedOrder.map(g=>g.toUpperCase()).join(' → ') || '还未完成整词'} · ${game.steps} 步 · 碰撞 ${game.hits} 次 · ${game.letters}/6 字母`;
    }
  }
  function render(){renderer.draw(game,game.phase==='playing'?accumulator:0);}
  function resize(){const box=canvas.getBoundingClientRect();renderer.resize(box.width,box.height,win.devicePixelRatio||1);render();}
  function pause(reason='已暂停 · 看好下一步再继续') {
    if(disposed) return;
    if(game.phase==='playing') game.setPaused(true);
    stop(); if(game.phase==='paused') note=reason; hud();render();
  }
  function resume() {
    if(disposed || game.phase!=='paused' || doc.hidden) return;
    stop(); game.setPaused(false); focusBoard(); hud();
    raf=win.requestAnimationFrame(loop);
  }
  function finish(){stop();hud();render();$('result-title').focus({preventScroll:true});}
  function loop(now) {
    raf=0;
    if(disposed || game.phase!=='playing') return;
    const dt=Math.min(.05,previous===null ? 0 : Math.max(0,(now-previous)/1000));
    previous=now; accumulator+=dt;
    while(accumulator>=STEP && game.phase==='playing'){game.update(STEP);accumulator-=STEP;}
    renderer.update(dt,game);
    for(const event of game.events)if(event.id>eventId){eventId=event.id;renderer.event(event);}
    hud();render();
    if(game.phase==='over') finish();
    else raf=win.requestAnimationFrame(loop);
  }
  function retry(){if(disposed)return;stop();game=createWordOrderGame();eventId=0;lastTarget='';note='已暂停 · 重新选择首字';renderer.clear();renderer.displayLength=game.length;hud();resize();$('pause').focus({preventScroll:true});}
  $('pause').addEventListener('click',()=>game.phase==='paused'?resume():pause(),options);
  $('retry').addEventListener('click',retry,options);
  $('menu-link').addEventListener('click',()=>pause('已暂停 · 返回后可继续'),options);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)pause('已暂停 · 页面进入后台');},options);
  win.addEventListener('blur',()=>pause('已暂停 · 窗口失去焦点'),options);
  win.addEventListener('pagehide',()=>pause('已暂停 · 页面已离开'),options);
  win.addEventListener('pageshow',()=>{if(!disposed){hud();resize();}},options);
  const observer=new win.ResizeObserver(resize);observer.observe(canvas);
  function destroy(){if(disposed)return;pause();disposed=true;observer.disconnect();input.destroy();events.abort();}
  win.addEventListener('beforeunload',destroy,{...options,once:true});
  renderer.displayLength=game.length;hud();resize();
  return {get game(){return game;},pause,resume,retry,resize,destroy};
}
if(typeof document!=='undefined' && document.getElementById('game')) mountWordOrder();
