// Test-only production DOM/CSS fixture. Sample states do not run or validate gameplay.
const $ = id => document.getElementById(id);
const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const assert = (value, message) => { if (!value) throw Error(message); };
const box = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
const overlaps = (a, b) => a.x < b.right - .5 && a.right > b.x + .5 && a.y < b.bottom - .5 && a.bottom > b.y + .5;
const sizes = [[1280,720],[1024,768],[390,844],[844,390],[568,320],[320,568],[320,240],[1280,720]];
const samples = {
  pause: ['TAKE A BREATH', '月夜稍歇', '计时、敌人和音画都已暂停。', '继续行动'],
  dead: ['RISE AGAIN', '重整刀锋', '从本章第 3 个检查点再来。没有次数限制。\n留意敌人红色起手；疾步穿过攻击，等收招再斩', '检查点重试'],
  results: ['CHAPTER COMPLETE', '这一程，已过', '得分 12345 · 击倒 18 · 本章重试 0 次\n✓ 抵达本章终点\n✓ 截弹后完成反击\n✓ 不重试且受伤不超过 3 点\n刀刃截弹后有 2.4 秒月息；下一次有效刀击伤害 +1\n本章勋章已升级', '进入下一章'],
};
let frame, results = [];
async function load() {
  const url = new URL('../english-moonblade/index.html', location.href);
  url.searchParams.set('build',new URL(location.href).searchParams.get('build')||'20261001-quality3-r8');
  const response = await fetch(url,{cache:'no-store'});
  assert(response.ok, `Production page fetch failed: ${response.status}`);
  const page = new DOMParser().parseFromString(await response.text(), 'text/html');
  page.querySelectorAll('script').forEach(script => script.remove());
  const base = page.createElement('base'); base.href = url.href; page.head.prepend(base);
  frame?.remove(); frame = document.createElement('iframe'); frame.title = 'Moonblade production DOM/CSS sample, no renderer';
  const loaded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Layout fixture load timed out')), 15000);
    frame.onload = () => { clearTimeout(timer); resolve(); };
  });
  frame.srcdoc = '<!doctype html>' + page.documentElement.outerHTML;
  $('stage').replaceChildren(frame); await loaded;
  const d = frame.contentDocument;
  d.body.classList.add('playing');
  for (const id of ['menu','loading']) d.getElementById(id).hidden = true;
  for (const id of ['hud','pause-btn','exit-btn']) d.getElementById(id).hidden = false;
  d.getElementById('touch').hidden = !frame.contentWindow.matchMedia('(pointer: coarse)').matches;
  const text = {chapter:'壹 · 雨城屋脊',energy:'◆◆◆◆◆◆◆◆◆◆',score:'12345','moon-mastery':'截弹 12 · 反击 10 · 本章受伤 8','dash-state':'疾步就绪',toast:'越过长夜，追寻失落的月印',hint:'截弹后趁月息反击 · 留意敌人起手，疾步穿过攻击'};
  for (const [id,value] of Object.entries(text)) d.getElementById(id).textContent = value;
  return d;
}
async function resize(width, height) {
  frame.width = width; frame.height = height; await tick();
  assert(frame.contentWindow.innerWidth === width && frame.contentWindow.innerHeight === height, 'Fixture viewport mismatch');
}
async function show(state) {
  const d = frame.contentDocument, panel = d.getElementById('panel');
  const menu = state === 'menu';
  d.body.classList.toggle('playing', !menu);d.getElementById('menu').hidden=!menu;d.getElementById('hud').hidden=menu;
  d.getElementById('start-btn').disabled=false;d.getElementById('start-btn').textContent='踏入月夜';
  panel.hidden = state === 'hud' || menu;
  if (state !== 'hud' && !menu) {
    ['panel-kicker','panel-title','panel-text','primary-action'].forEach((id,i) => { d.getElementById(id).textContent = samples[state][i]; });
    const medal = d.getElementById('chapter-medal');
    medal.hidden = state !== 'results'; medal.src = '../shared/mobile-art/medal-gold.webp';
    d.querySelector('.panel-copy').scrollTop = 0;
  }
  await tick();
}
function visibleWithin(rect, outer, label) {
  assert(rect.width > 0 && rect.height > 0 && rect.x >= outer.x - .5 && rect.y >= outer.y - .5 && rect.right <= outer.right + .5 && rect.bottom <= outer.bottom + .5, `Clipped ${label}`);
}
function inspect(state) {
  const d = frame.contentDocument, w = frame.contentWindow;
  const viewport = {x:0,y:0,right:w.innerWidth,bottom:w.innerHeight};
  const record = {state,width:w.innerWidth,height:w.innerHeight,pointer:w.matchMedia('(pointer: coarse)').matches?'coarse':'fine',boxes:{}};
  const read = selector => record.boxes[selector] = box(d.querySelector(selector));
  assert(d.documentElement.scrollWidth <= w.innerWidth + 1, `${state}: page horizontal overflow`);
  assert(d.documentElement.scrollHeight <= w.innerHeight + 1, `${state}: page vertical overflow`);
  if(state === 'menu') {
    assert(!d.getElementById('menu').closest('#arena'),'Menu must use the viewport, not the short portrait arena');
    const action=d.getElementById('start-btn'),r=read('#start-btn');visibleWithin(r,viewport,'initial Start');
    assert(r.height>=44&&action.textContent.trim(),'Initial Start must be labelled and44px');
    assert(d.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#start-btn')===action,'Initial Start is obscured');
    record.menuScroll=d.getElementById('menu').scrollTop;assert(record.menuScroll===0,'Start must be visible before menu scrolling');
  } else if (state === 'hud') {
    const energy = read('.energy'), mastery = read('#moon-mastery');
    assert(!overlaps(energy, mastery) && mastery.y >= energy.bottom, 'Combat metrics overlap the ninpo/resource row');
    for (const selector of ['.chapter','.hp','.energy','#moon-mastery']) visibleWithin(read(selector), read('#arena'), selector);
    for (const selector of ['.energy span:first-child','#energy']) visibleWithin(read(selector), energy, selector);
    assert(d.getElementById('moon-mastery').closest('.vitals'), 'Combat metrics must share resource layout ownership');
    if(w.innerWidth<=700&&w.innerHeight>w.innerWidth) {
      const toast=read('#toast'),arena=read('#arena');visibleWithin(toast,viewport,'story toast');
      assert(!overlaps(toast,energy)&&toast.bottom<=arena.y,'Story/retry toast must remain above portrait resources');
      assert(arena.y<=d.querySelector('.topbar').getBoundingClientRect().bottom+57,'Portrait stage must not be vertically letterboxed');
    }
  } else {
    const panel = d.getElementById('panel'), copy = d.querySelector('.panel-copy');
    const panelBox = read('#panel'), copyBox = read('.panel-copy'), actionsBox = read('.panel-actions');
    assert(!panel.closest('#arena'), 'The viewport overlay must be outside the clipped arena');
    assert(Math.abs(panelBox.width - w.innerWidth) < 1 && Math.abs(panelBox.height - w.innerHeight) < 1, 'Overlay does not cover the resized viewport');
    assert(panel.scrollHeight <= panel.clientHeight + 1, 'Overlay creates a second scroll region');
    assert(!overlaps(copyBox, actionsBox), 'Scrollable copy overlaps panel actions');
    visibleWithin(copyBox, viewport, 'panel copy');
    for (const selector of ['#primary-action','#menu-action']) {
      const el = d.querySelector(selector), rect = read(selector);
      visibleWithin(rect, viewport, selector);
      assert(rect.height >= 44 && el.textContent.trim(), `${selector}: collapsed or blank action`);
      const range = d.createRange(); range.selectNodeContents(el);
      visibleWithin(box(range), rect, selector + ' label');
      for (const [x,y] of [[rect.x+2,rect.y+2],[rect.right-2,rect.y+2],[rect.x+rect.width/2,rect.y+rect.height/2],[rect.right-2,rect.bottom-2]]) {
        const target = d.elementFromPoint(x,y);
        assert(target === el || el.contains(target), selector + ': obscured action hit target');
      }
    }
    assert(!overlaps(record.boxes['#primary-action'],record.boxes['#menu-action']), 'Primary and return actions overlap');
    const oldScroll = copy.scrollTop;
    copy.scrollTop = copy.scrollHeight;
    record.copy = {clientHeight:copy.clientHeight,scrollHeight:copy.scrollHeight,maxScroll:copy.scrollTop};
    if (copy.scrollHeight > copy.clientHeight + 1) {
      assert(copy.scrollTop > 0, 'Overflowing result copy is not scrollable');
      assert(copy.getBoundingClientRect().bottom >= d.getElementById('panel-text').getBoundingClientRect().bottom - 1, 'Last result line cannot be reached');
    }
    copy.scrollTop = oldScroll;
  }
  results.push(record);
  $('report').textContent = JSON.stringify({kind:'production DOM/CSS sample states; renderer omitted',results},null,2);
}
$('run').addEventListener('click', async () => {
  $('run').disabled = $('preview').disabled = true; results = []; $('status').textContent = 'Running';
  try {
    await load();
    // Keep each panel open while rotating/resizing the same document, including
    // the reported desktop -> portrait -> landscape interruption sequence.
    for (const state of ['hud','pause','dead','results']) {
      await show(state);
      for (const [width,height] of sizes) { await resize(width,height); inspect(state); }
    }
    await show('menu');
    for(const [width,height] of [[1280,720],[390,844],[320,568],[568,320],[844,390]]) {await resize(width,height);inspect('menu');}
    $('status').textContent = `PASS · ${results.length} production DOM/CSS states`;
  } catch (error) { $('status').textContent = 'FAIL · ' + error.message; }
  finally { $('run').disabled = $('preview').disabled = false; }
});
$('preview').addEventListener('click', async () => {
  try {
    await load(); await resize(...$('viewport').value.split('×').map(Number)); await show($('sample').value); inspect($('sample').value);
    $('status').textContent = 'Sample layout verified · ' + $('sample').value + ' ' + $('viewport').value;
  } catch (error) { $('status').textContent = 'FAIL · ' + error.message; }
});
