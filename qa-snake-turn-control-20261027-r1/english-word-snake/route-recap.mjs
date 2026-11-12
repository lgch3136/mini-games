// Session-only observation of reached cell centres; never generates or drives a route.
export const ROUTE_POINT_CAP = 256;
export class CoilRoute {
  constructor(head, body) {
    this.points = [{x: head.x, y: head.y, step: 0, stage: 0}];
    this.body = body.slice(0, 9).map(({x, y}) => ({x, y}));
    this.pickups = [];
    this.truncated = false;
  }
  reached(head, step, stage) {
    if (this.points.length < ROUTE_POINT_CAP)
      this.points.push({x: head.x, y: head.y, step, stage});
    else this.truncated = true;
  }
  collected(event, step) {
    if (this.pickups.length < 3)
      this.pickups.push({label: event.label.toUpperCase(), x: event.x, y: event.y, step});
  }
  summary(game) {
    return {won: game.won, steps: game.steps, hits: game.hits,
      letters: this.pickups.length, pickups: this.pickups.map(p => ({...p}))};
  }
}
const colors = ['#38764a', '#a25d16', '#596b9e'];
const arrows = ['→', '↓', '←', '↑'];
const direction = (a, b) => b.x > a.x ? 0 : b.y > a.y ? 1 : b.x < a.x ? 2 : 3;
const comparable = (current, previous) => current.won && previous?.won && current.letters === 3 && previous.letters === 3;
const delta = (value, noun) => value === 0 ? (noun === '步' ? '步数相同' : '碰撞次数相同') : `${value < 0 ? '少' : '多'} ${Math.abs(value)} ${noun}`;
export function comparisonText(current, previous) {
  if (!previous) return '本轮首局；连续点“同图再试”可比较上一局。返回选单或刷新会清空。';
  const prior = `上局（仅本页）：${previous.letters}/3 字母 · ${previous.steps} 步 · 碰撞 ${previous.hits} 次。`;
  if (!comparable(current, previous))
    return `${prior}未同为完成 3/3，不比较总步数优劣。`;
  return `${prior}两局均完成：本次${delta(current.steps - previous.steps, '步')}，${delta(current.hits - previous.hits, '次碰撞')}；不代表最佳路线。`;
}
export function routeAdvice(route) {
  const a = route.points[0], b = route.points[1];
  if (!b) return '尚未到达下一格；同图再试时，先观察身体与当前 A 的位置。';
  const opening = arrows[direction(a, b)];
  return `本次第一格向${opening}。同图再试可换一个开局方向，观察身体让路后怎样接近 A；仍须按 A→R→C 取字。`;
}
export function renderRouteRecap(container, route, current, previous, doc = document) {
  container.replaceChildren();
  const text = (tag, value, cls = '') => {
    const node = doc.createElement(tag); node.textContent = value;
    if (cls) node.className = cls;
    container.append(node); return node;
  };
  text('h3', '刚才怎样取到字母');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  const add = (tag, attrs, value) => {
    const el = doc.createElementNS(ns, tag);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, String(val));
    if (value !== undefined) el.textContent = value;
    svg.append(el); return el;
  };
  svg.setAttribute('viewBox', '0 0 320 240');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `本次实际路线${route.truncated ? '前255步' : ''}，起点和已取字母标记；取字步数见下方文字。`);
  svg.classList.add('coil-route-map');
  add('rect', {x:1,y:1,width:318,height:238,rx:8,fill:'#f5f8ee',stroke:'#b2c4a4'});
  for(let x=1;x<16;x++) add('path',{d:`M${x*20} 1V239`,stroke:'#dce5d2','stroke-width':0.5});
  for(let y=1;y<12;y++) add('path',{d:`M1 ${y*20}H319`,stroke:'#dce5d2','stroke-width':0.5});
  const pos = p => `${p.x*20+10},${p.y*20+10}`;
  add('polyline',{points:route.body.map(pos).join(' '),fill:'none',stroke:'#a3b394','stroke-width':8,'stroke-dasharray':'5 4','stroke-linejoin':'round','stroke-linecap':'round'});
  for(let i=1;i<route.points.length;i++) {
    const a=route.points[i-1], b=route.points[i], color=colors[Math.min(2,b.stage)];
    add('path',{d:`M${pos(a)}L${pos(b)}`,fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round'});
    const x=(a.x+b.x)*10+10, y=(a.y+b.y)*10+10;
    add('path',{d:'M-2.5 -2.5L1 0L-2.5 2.5',fill:'none',stroke:color,'stroke-width':1.5,
      transform:`translate(${x} ${y}) rotate(${direction(a,b)*90})`});
  }
  const start=route.points[0];
  add('circle',{cx:start.x*20+10,cy:start.y*20+10,r:5,fill:'white',stroke:'#314d38','stroke-width':2});
  for(const pickup of route.pickups) {
    // Pickups beyond the retained prefix stay in text only, never joined across missing history.
    if(pickup.step > route.points.at(-1).step) continue;
    add('circle',{cx:pickup.x*20+10,cy:pickup.y*20+10,r:8,fill:'#fffdf5',stroke:colors[route.pickups.indexOf(pickup)],'stroke-width':2});
    add('text',{x:pickup.x*20+10,y:pickup.y*20+10,'text-anchor':'middle','dominant-baseline':'central',fill:'#263f2c','font-size':15,'font-weight':700},pickup.label);
  }
  const end=route.points.at(-1);
  if(!route.truncated && !route.pickups.some(p => p.step === end.step))
    add('rect',{x:end.x*20+6,y:end.y*20+6,width:8,height:8,fill:'#314d38',stroke:'white','stroke-width':1});
  container.append(svg);
  text('p', route.truncated
    ? `仅画前 ${ROUTE_POINT_CAP - 1} 步，之后未画；下方取字步数仍为实际记录。`
    : '线与箭头是本次实际走向；虚线是初始身体，不是结束时的身体。', 'route-key');
  text('p', '○ 起点 · 绿线去 A / 棕线去 R / 蓝线去 C · ■ 停下位置（未取字时）', 'route-key');
  const list=doc.createElement('ol'); list.className='route-pickups';
  let last=0;
  for(let i=0;i<3;i++) {
    const item=doc.createElement('li'), p=route.pickups[i];
    item.textContent=p ? `${p.label}：第 ${p.step} 步取到（距${i ? route.pickups[i-1].label : '起点'} ${p.step-last} 步）` : `${'ARC'[i]}：未取到`;
    if (p && comparable(current, previous) && previous.pickups[i]?.label === p.label)
      item.textContent += ` · 上局第 ${previous.pickups[i].step} 步`;
    if(p) last=p.step;
    list.append(item);
  }
  container.append(list);
  text('p', comparisonText(current, previous), 'route-comparison');
  text('p', routeAdvice(route), 'route-key');
}
