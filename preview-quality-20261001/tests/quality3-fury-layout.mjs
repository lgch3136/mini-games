import { LESSONS } from '../english-word-fury/dojo.mjs';
const $ = id => document.getElementById(id), results = [];
const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const assert = (ok, message) => { if (!ok) throw Error(message); };
const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
const overlap = (a,b) => a.x < b.right-.5 && a.right > b.x+.5 && a.y < b.bottom-.5 && a.bottom > b.y+.5;
let frame;
async function load(width, height, sample = 'arcade', coarse = false) {
  const url = new URL('../english-word-fury/index.html', location.href);
  const source = await fetch(url).then(r => r.text()), page = new DOMParser().parseFromString(source, 'text/html');
  page.querySelectorAll('script').forEach(s => s.remove());
  const base = page.createElement('base'); base.href = url.href; page.head.prepend(base);
  frame?.remove(); frame = document.createElement('iframe'); frame.width = width; frame.height = height; frame.title = 'Fury production DOM/CSS sample, no renderer';
  const ready = new Promise(resolve => frame.onload = resolve);
  frame.srcdoc = '<!doctype html>' + page.documentElement.outerHTML; $('stage').replaceChildren(frame); await ready;
  const doc = frame.contentDocument, get = id => doc.getElementById(id);
  // Resolve the actual production media rules for this explicit pointer sample.
  // No screenshot or geometry from this fixture is gameplay/touch evidence.
  for (const sheet of doc.styleSheets) for (const rule of sheet.cssRules) {
    if (rule instanceof frame.contentWindow.CSSMediaRule && /\(pointer:\s*coarse\)/.test(rule.conditionText))
      rule.media.mediaText = rule.conditionText.replace(/\(pointer:\s*coarse\)/g, coarse ? '(min-width: 0px)' : '(min-width: 99999px)');
  }
  const playing = sample !== 'menu', training = ['coach','training','coach-pause'].includes(sample);
  doc.body.classList.toggle('playing', playing); doc.body.classList.toggle('training', training);
  get('loading').hidden = true; get('menu').hidden = playing; get('hud').hidden = !playing;
  get('pause-btn').hidden = get('exit-btn').hidden = !playing;
  get('touch').hidden = !playing || !coarse; get('practice').hidden = !training;
  get('dojo-coach').hidden = !['coach','coach-pause'].includes(sample); get('pause').hidden = !['pause','coach-pause'].includes(sample);
  get('start-btn').disabled = false; get('start-btn').textContent = '进入擂台 →';
  get('round-label').textContent = training ? 'PRACTICE' : 'ROUND 03'; get('timer').textContent = training ? '∞' : '15';
  get('hp-0').style.transform = 'scaleX(.62)'; get('guard-0').style.transform = 'scaleX(.38)';
  get('hp-1').style.transform = 'scaleX(.44)'; get('meter-0').style.transform = 'scaleX(.74)';
  get('stocks-0').textContent = '2'; get('max-0').textContent = 'MAX 6.9s';
  get('meaning').textContent = '专注'; get('letters').innerHTML = '<span class="done">F</span><span class="done">O</span><span>C</span><span>U</span><span>S</span>';
  get('dojo-title').textContent = `${LESSONS[2].title} · ${LESSONS[2].goal} 0/1`;
  get('dojo-tip').textContent = LESSONS[2].tip + '\n挡住了：对手还会收招 18f。防守硬直结束点 B 前蹴（6f 起手）';
  get('frame-data').textContent = '前蹴 · 5f / 起手 6 · 有效 3 · 收招 13';
  get('status').textContent = '截风拳 · ' + (training ? '练习道场' : '第 2 场挑战');
  get('hint').textContent = coarse ? '横屏更舒适 · 左手移动，右手出招' : 'J K U I 拳脚 · 空格 气波 · P 暂停';
  await tick(); return { doc, width, height, sample, coarse };
}
function check(ctx) {
  const {doc, width, height, sample, coarse} = ctx, get = id => doc.getElementById(id), box = id => rect(get(id));
  const arena = box('arena'), topbar = rect(doc.querySelector('.topbar'));
  const entry = { width, height, sample, coarse, arena, topbar, status:box('statusbar'), touch:box('touch'), practice:box('practice'), coach:box('dojo-coach') };
  results.push(entry); $('report').textContent = JSON.stringify(results, null, 2);
  assert(doc.documentElement.scrollWidth <= width, 'Horizontal overflow');
  assert(Math.abs(arena.width / arena.height - 16 / 9) < .005, 'Arena must preserve 16:9');
  for (const id of ['game','fx']) {
    const r = box(id);
    assert(Math.abs(r.x-arena.x)<.5 && Math.abs(r.y-arena.y)<.5 && Math.abs(r.width-arena.width)<.5 && Math.abs(r.height-arena.height)<.5, id+' must still map exactly to arena');
  }
  assert(frame.contentWindow.getComputedStyle(doc.querySelector('.arena-frame')).isolation === 'isolate', 'Coach and HUD must remain below menu/pause stacking layer');
  if (['menu','pause','coach-pause'].includes(sample)) {
    const overlay = rect(get(sample === 'menu' ? 'menu' : 'pause'));
    assert(overlay.x >= -.5 && overlay.right <= width+.5 && overlay.bottom <= height+.5, sample+' overlay bounds');
    return;
  }
  const within = (r, label) => assert(r.x >= -.5 && r.right <= width+.5 && r.y >= -.5 && r.bottom <= height+.5, label + ' clipped by viewport');
  within(arena, 'Arena');
  if (width <= 680 && height > width) assert(arena.y <= topbar.bottom + 65, 'Portrait arena must start below header/HUD without letterbox gap');
  if (width <= 680 && height >= 700 && height > width) {
    const readouts = ['timer','word-line','dojo-coach','statusbar','practice','touch'].filter(id => !get(id).hidden);
    for (const id of readouts) { within(box(id), id); assert(!overlap(arena, box(id)), id + ' must be outside combat canvas'); }
    for (const name of ['.fighter-hud.p1','.fighter-hud.p2','.power-left','.power-right']) {
      const r = rect(doc.querySelector(name)); within(r,name); assert(!overlap(arena,r), name+' must be outside combat canvas');
    }
    for (const id of ['statusbar','practice','touch'].filter(id => !get(id).hidden))
      if (!get('dojo-coach').hidden) assert(!overlap(box('dojo-coach'),box(id)), 'Coach overlaps '+id);
  }
  if (coarse) for (const button of doc.querySelectorAll('#touch button')) {
    const r = rect(button); within(r, 'Touch '+button.dataset.key);
    assert(r.width >= 43.9 && r.height >= 43.9, 'Touch targets must remain 44px');
  }
}
$('preview').onclick = async () => {
  const [w,h] = $('viewport').value.split('×').map(Number);
  try { const ctx = await load(w,h,$('sample').value,$('coarse').checked); check(ctx); $('status').textContent = 'PASS · Explicit layout sample'; }
  catch(error) { $('status').textContent = 'FAIL · ' + error.message; }
};
$('run').onclick = async () => {
  $('run').disabled = true; results.length = 0; $('status').textContent = 'Running';
  try {
    for (const [w,h] of [[390,844],[430,932],[320,568],[844,390],[1280,720]])
      for (const coarse of [false,true]) for (const sample of ['arcade','coach','training']) check(await load(w,h,sample,coarse));
    for (const sample of ['menu','pause','coach-pause']) check(await load(390,844,sample));
    // Media-query transitions on the same DOM, with the live coach still open.
    for (const coarse of [false,true]) {
      const ctx = await load(390,844,'coach',coarse);
      for (const [w,h] of [[844,390],[390,844]]) {
        frame.width = w; frame.height = h; ctx.width = w; ctx.height = h; await tick(); check(ctx);
      }
    }
    $('status').textContent = 'PASS · ' + results.length + ' production layout samples';
  } catch(error) { $('status').textContent = 'FAIL · ' + error.message; }
  finally { $('run').disabled = false; }
};
