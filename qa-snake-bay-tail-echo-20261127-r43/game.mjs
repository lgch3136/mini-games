// One-cell inspection only. These are the same retained-tail and turn tests
// as the current classic ARC engine, never a route solver or state write.
function inspectPracticeStep(game, direction) {
  if (direction === (game.direction + 2) % 4) return {kind:'reverse', text:'不能直接掉头'};
  const move = C[direction], next = {x:game.head.x + move.x,y:game.head.y + move.y};
  const outside = (x,y)=>x < 0 || y < 0 || x >= game.cols || y >= game.rows;
  if (game.arena === 'classic' && outside(next.x,next.y)) {
    return {kind:'wall', text:'下一格是护栏'};
  }
  const tile = game.tiles.find(item=>game.same(item,next));
  const picks = tile && tile.correct && (game.mode === 'choose' || tile.id === game.cursor);
  const grows = picks && game.length < I;
  const end = game.length - (grows ? 0 : 1);
  if (game.trail.slice(1,end).some(point=>game.same(point,next))) {
    return {kind:'body', text:'下一格撞身'};
  }
  // The classic tick tests the same outward heading again after advancing.
  // An in-bounds outermost tile can still end this practice step at the rail.
  if (game.arena === 'classic' && outside(next.x + move.x,next.y + move.y)) {
    return {kind:'wall', text:'走到边缘会撞护栏'};
  }
  const oldTail = game.trail[game.length-1];
  if (!grows && oldTail && game.same(oldTail,next)) return {kind:'tail',text:'下一格是旧尾，移动时腾开'};
  if (picks) return {kind:'letter', text:`下一格可取 ${numberedLabel(game,tile)}`};
  if (tile) return {kind:'open', text:`可走；尚不能取 ${numberedLabel(game,tile)}`};
  return {kind:'open', text:'下一格可走'};
}
function syncStepInspector() {
  const panel = a('step-inspector');
  const shown = !!h && h.state === 'running' && !h.paused;
  panel.hidden = !shown;
  if (!h) panel.open = false;
  if (!shown) return;
  for (let d = 0; d < C.length; d++) {
    const row = a(`step-inspect-${d}`);
    const result = inspectPracticeStep(h.game,d);
    const text = `${nt[d]} ${result.text}`;
    if (row.textContent !== text) row.textContent = text;
    row.dataset.kind = result.kind;
  }
}

// Optimistic geometric lower bound only. We never forecast a legal route or mutate the game.
function routeStepFloor(game) {
  let x = game.head.x, y = game.head.y, total = 0;
  for (let id = game.cursor; id < 3; id++) {
    const tile = game.tiles.find(item => item.id === id);
    if (!tile) return null;
    total += Math.abs(tile.x - x) + Math.abs(tile.y - y);
    x = tile.x;
    y = tile.y;
  }
  return total;
}

function syncRouteBudget() {
  const panel = a('route-budget');
  const shown = !h && m.tight && (m.state === 'ready' || m.state === 'running');
  const minimum = shown ? routeStepFloor(m.game) : null;
  panel.hidden = minimum === null;
  if (minimum === null) return;
  const remaining = Math.max(0, m.stageLimit - m.game.steps);
  const slack = remaining - minimum;
  panel.dataset.slack = slack < 0 ? 'short' : slack === 0 ? 'exact' : 'positive';
  const conclusion = slack < 0 ? `至少差 ${-slack} 步` : slack === 0 ? '没有绕路余量' : `理论余量 ${slack} 步`;
  const receipt = `余 ${remaining} 步 · 至少 ${minimum} 步 · ${conclusion}`;
  const value = a('route-budget-value');
  if (value.textContent !== receipt) value.textContent = receipt;
}

function makeRouteRecord() {
  const best = new Map();
  let recorded = false;
  return {
    reset() { recorded = false; },
    finish({finished, tight, fork, cat, steps, results}) {
      if (recorded || !finished || !Number.isSafeInteger(steps) || steps < 1) return;
      // Baseline must be one prior complete run, not an aggregate of fast legs.
      if (!Array.isArray(results) || results.length!==3 ||
          results.some((leg,i)=>leg.stage!==i||!Number.isSafeInteger(leg.steps)||leg.steps<1) ||
          results.reduce((sum,leg)=>sum+leg.steps,0)!==steps) return;
      recorded = true;
      const legs = results.map(leg=>leg.steps);
      const mode = (newPack ? "water:" : cat ? 'cat:' : 'arc:') + (fork ? 'fork:' : 'base:') + (tight ? 'tight' : 'relay');
      const previous = best.get(mode);
      const difference=previous===undefined?null:steps-previous.steps;
      const record=difference===null||difference<0?steps:previous.steps;
      if(difference===null||difference<0)best.set(mode,{steps,legs});
      // Comparing this run to the old best even on a new record prevents
      // benchmarking current performance against itself.
      return {record,difference,splits:previous===undefined?null:legs.map((x,i)=>x-previous.legs[i])};
    }
  };
}
const room = makeRouteRecord();
let reviewTarget = -1;
let reviewReturn = null;

function beginReviewPractice() {
  if (document.hidden || h || m.state !== 'won' || reviewTarget < 0) return;
  const options = a('session-options');
  reviewReturn = { optionsOpen: options.open, x: window.scrollX, y: window.scrollY };
  h = new R(reviewTarget);
  a('record').hidden = true;
  options.open = true;
  k.clear();
  y();
  S();
}

function returnFromPractice() {
  if (document.hidden || !h) return;
  const visit = reviewReturn;
  reviewReturn = null;
  h = null;
  k.clear();
  if (visit) {
    a('session-options').open = visit.optionsOpen;
    a('record').hidden = false;
  }
  y();
  // Return to the actual launcher, not the hidden loss-only practice button.
  a(visit ? 'record-practice' : 'drill-start').focus({preventScroll:true});
  if (visit) window.scrollTo({left:visit.x, top:visit.y, behavior:'instant'});
}

function syncReviewPracticeButton() {
  const button = a('record-practice');
  button.hidden = !!h || m.state !== 'won' || reviewTarget < 0;
  if (!button.hidden) button.textContent = `只练第${reviewTarget+1}图 · ${roomName(reviewTarget)}`;
}
function clearRouteReceipt() {
  room.reset();
  reviewTarget = -1;
  document.getElementById('record').hidden = true;
}
function updateRouteRecord(result) {
  const receipt = room.finish(result);
  if (!receipt) return;
  const { steps } = result;
  const { record, difference } = receipt;
  document.getElementById('record-text').textContent = difference === null ? `首个无伤成绩：${steps}步。重开试试能否少走一步！` :
    difference < 0 ? `新纪录：${steps}步，比此前少走${-difference}步！` :
    difference === 0 ? `追平本页纪录：${steps}步。` :
    `本轮${steps}步，距本页纪录还差${difference}步（纪录${record}步）。`;
  const splitNode=document.getElementById('record-splits');
  const splits=receipt.splits;
  reviewTarget=-1;
  splitNode.hidden=!splits;
  if(splits){
    const show=(delta,i)=>`第${i+1}图${delta===0?'持平':delta>0?'多走'+delta+'步':'少走'+(-delta)+'步'}`;
    const highest=Math.max(...splits);
    const focus=highest>0?splits.flatMap((delta,i)=>delta===highest?[i+1]:[]):[];
    // Existing recap describes all ties, one action defaults to the first tied map.
    if(focus.length)reviewTarget=focus[0]-1;
    splitNode.textContent=`与此前整局最佳分段相比：${splits.map(show).join('，')}。${focus.length?'想再提速，先看第'+focus.join('、')+'图。':''}`;
  } else splitNode.textContent='';
  document.getElementById('record').hidden = false;
}

var A="paced-five",J=Object.freeze([3,4,5,6,7]),ot=Object.freeze({[A]:{goal:5,label:"\u6E10\u8FDB\u4E94\u8BCD",detail:"\u521D\u7EA7\u4E32\u8BCD \xB7 3\u21924\u21925\u21926\u21927 \u5B57\u6BCD \xB7 \u72EC\u7ACB\u8BB0\u5F55"},basket:{goal:5,label:"\u4E94\u8BCD\u5C0F\u82B1\u56ED",detail:"\u5B8C\u6210 5 \u8BCD \xB7 \u4E00\u6B21\u5B8C\u6574\u7684\u5C0F\u5192\u9669"},orchard:{goal:10,label:"\u5341\u8BCD\u679C\u56ED",detail:"\u5B8C\u6210 10 \u8BCD \xB7 \u6311\u6218\u65E0\u4F24\u4E30\u6536"},endless:{goal:0,label:"\u81EA\u7531\u6F2B\u6E38",detail:"\u6CA1\u6709\u7EC8\u70B9 \xB7 \u968F\u65F6\u56DE\u9009\u5355"}});var lt=1/120,F=[5,6.5,8,10,12],C=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}],I=34,x=(r,t)=>(r%t+t)%t,P=(r,t,s)=>Math.max(t,Math.min(s,r));function W(r=17){let t=r>>>0;return()=>{t+=1831565813;let s=t;return s=Math.imul(s^s>>>15,s|1),s^=s+Math.imul(s^s>>>7,s|61),((s^s>>>14)>>>0)/4294967296}}function Z(r=[]){let t=new Set;return r.filter(s=>{let e=String(s.en||"").trim().toLowerCase();return!/^[a-z]{3,12}$/.test(e)||t.has(e)?!1:(t.add(e),!0)}).map(s=>({en:s.en.trim().toLowerCase(),zh:String(s.zh||s.en)}))}function tt(r=[]){return r.map(t=>({...t,options:[...new Set(t.options)]})).filter(t=>t.options.length>=2&&t.options.includes(t.answer))}var q=[{en:"apple",zh:"\u82F9\u679C"},{en:"garden",zh:"\u82B1\u56ED"},{en:"dream",zh:"\u68A6\u60F3"}],V=[{prompt:"I ___ a student.",options:["am","is","are"],answer:"am"}],N=class{constructor({cols:t=24,rows:s=16,speed:e=2,arena:i="garden",mode:o="spell",words:d=q,questions:n=V,seed:c=Date.now(),wordGoal:l=0,challenge:f="",difficulty:p="easy"}={}){if(this.cols=P(Math.floor(t),12,40),this.rows=P(Math.floor(s),8,40),this.rng=W(c),this.words=Z(d),this.words.length||(this.words=q),this.questions=tt(n),this.questions.length||(this.questions=V),this.mode=o==="choose"?o:"spell",this.arena=i==="classic"?i:"garden",this.speedSetting=P(Math.round(Number(e)||0),0,4),this.speed=F[this.speedSetting],this.wordGoal=[5,10].includes(Number(l))?Number(l):0,f===A){let u=J.map(g=>this.words.filter(b=>b.en.length===g));if(this.mode!=="spell"||p!=="easy"||this.wordGoal!==5||u.some(g=>!g.length))throw new RangeError("\u6E10\u8FDB\u4E94\u8BCD\u9700\u8981\u521D\u7EA7\u4E32\u8BCD\u3001\u4E94\u8BCD\u76EE\u6807\u4EE5\u53CA\u5B8C\u6574\u7684 3\u20137 \u5B57\u6BCD\u8BCD\u5E93");this.challenge=A,this.pacedPools=u}this.won=!1,this.hints=0,this.time=0,this.distance=0,this.steps=0,this.phase="playing",this.direction=0,this.turns=[],this.centerTurned=!1,this.progress=0,this.length=5,this.head={x:Math.floor(this.cols*.32),y:Math.floor(this.rows/2)},this.trail=Array.from({length:I+3},(u,g)=>({x:this.head.x-g,y:this.head.y})),this.hp=3,this.shield=0,this.invincible=0,this.hits=0,this.score=0,this.combo=0,this.bestCombo=0,this.comboAge=0,this.completed=0,this.letters=0,this.perfectWords=0,this.mistakes=0,this.energy=55,this.boostHeld=!1,this.boosting=!1,this.bonus=[],this.bonusRemaining=0,this.bonusCollected=0,this.events=[],this.eventSerial=0,this.revision=0,this.bag=[],this.lastWord="",this.cursor=0,this.hintAge=0,this.nextWord()}emit(t,s={}){this.events.push({id:++this.eventSerial,type:t,time:this.time,x:x(this.head.x,this.cols),y:x(this.head.y,this.rows),...s}),this.events.length>80&&this.events.shift(),this.revision++}cell(t){return{x:x(t.x,this.cols),y:x(t.y,this.rows)}}same(t,s){return x(t.x,this.cols)===x(s.x,this.cols)&&x(t.y,this.rows)===x(s.y,this.rows)}setSpeed(t){this.speedSetting=P(Math.round(Number(t)||0),0,4),this.revision++}input(t){if(this.phase!=="playing"||!Number.isInteger(t)||t<0||t>3)return!1;let s=this.turns.at(-1)?.d??this.direction;return t===s||t===(s+2)%4?!1:this.progress<1e-7&&!this.turns.length&&!this.centerTurned?(this.direction=t,this.centerTurned=!0,!0):this.turns.length===2?!1:(this.turns.push({d:t,time:this.time}),!0)}cancelTurn(){return this.phase!=="playing"||!this.turns.length?!1:(this.turns.pop(),this.revision++,!0)}clearInput(){this.turns.length=0,this.boostHeld=!1}setPaused(t){this.phase!=="over"&&(this.phase=t?"paused":"playing",this.clearInput(),this.revision++)}pick(){if(this.challenge===A){let e=this.pacedPools[this.completed];if(!e)throw new RangeError("\u6E10\u8FDB\u4E94\u8BCD\u5DF2\u5B8C\u6210\uFF0C\u4E0D\u80FD\u518D\u751F\u6210\u7B2C\u516D\u8BCD");let i=e[Math.floor(this.rng()*e.length)];return this.lastWord=i.en,i}let t=this.mode==="spell"?this.words:this.questions;if(!this.bag.length){this.bag=t.map((e,i)=>i);for(let e=this.bag.length-1;e>0;e--){let i=Math.floor(this.rng()*(e+1));[this.bag[e],this.bag[i]]=[this.bag[i],this.bag[e]]}this.bag.length>1&&(t[this.bag.at(-1)].en||t[this.bag.at(-1)].prompt)===this.lastWord&&([this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]])}let s=t[this.bag.pop()];return this.lastWord=s.en||s.prompt,s}freeCells(t=[]){let s=new Set([...this.trail.slice(0,this.length+1),...t].map(i=>`${x(i.x,this.cols)},${x(i.y,this.rows)}`)),e=[];for(let i=1;i<this.rows-1;i++)for(let o=1;o<this.cols-1;o++)s.has(`${o},${i}`)||e.push({x:o,y:i});return e}nextWord(){this.word=this.pick(),this.cursor=0,this.wordClean=!0,this.tiles=[],this.hintAge=0;let t=this.mode==="spell"?[...this.word.en]:[...this.word.options];if(this.mode==="choose")for(let e=t.length-1;e>0;e--){let i=Math.floor(this.rng()*(e+1));[t[e],t[i]]=[t[i],t[e]]}let s=this.cell(this.head);for(let e=0;e<t.length;e++){let i=this.freeCells([...this.tiles,...this.bonus]);if(!i.length)break;let d=i.map(n=>{let c=Math.abs(n.x-s.x)+Math.abs(n.y-s.y),l=this.tiles.every(f=>Math.abs(f.x-n.x)+Math.abs(f.y-n.y)>=(this.mode==="choose"?5:3));return{p:n,cost:Math.abs(c-(this.mode==="choose"?6:4))+(l?0:30)+this.rng()*3}}).sort((n,c)=>n.cost-c.cost)[0].p;this.tiles.push({...d,id:e,label:t[e],correct:this.mode==="spell"||t[e]===this.word.answer}),s=d}this.emit("word",{word:this.word.en||this.word.prompt})}hint(){this.phase==="playing"&&(this.hints++,this.hintAge=4,this.score=Math.max(0,this.score-15),this.emit("hint"))}target(){return this.mode==="spell"?this.tiles.find(t=>t.id===this.cursor):this.tiles.find(t=>t.correct)}multiplier(){return 1+Math.min(3,Math.floor(this.combo/5))}collect(t){if(!(this.phase!=="playing"||!t)&&!(this.mode==="spell"&&t.id!==this.cursor)){if(!t.correct){this.tiles=this.tiles.filter(s=>s!==t),this.mistakes++,this.wordClean=!1,this.combo=0,this.score=Math.max(0,this.score-30),this.emit("wrong",{answer:this.word.answer,...this.mode==="choose"&&typeof this.word.explanation=="string"?{explanation:this.word.explanation}:{}});return}this.tiles=this.tiles.filter(s=>s!==t),this.cursor++,this.letters++,this.combo++,this.comboAge=0,this.bestCombo=Math.max(this.bestCombo,this.combo),this.score+=20*this.multiplier()*(this.boosting?2:1),this.energy=Math.min(100,this.energy+18),this.length=Math.min(I,this.length+1),this.emit("eat",{label:t.label,combo:this.combo,boosted:this.boosting,...(this.challenge==="eel-double-vowel"?{tileId:t.id}:{})}),(this.mode==="choose"||this.cursor===this.word.en.length)&&this.complete()}}complete(){if(this.completed++,this.wordClean&&this.perfectWords++,this.score+=100*this.multiplier(),(this.keepFinalGrowth!==true&&(this.length=Math.max(5,this.length-3))),this.perfectWords>0&&this.wordClean&&this.perfectWords%3===0&&(this.shield=1),this.emit("complete",{label:this.word.en||this.word.answer,meaning:this.word.zh||this.word.prompt,...this.mode==="choose"&&typeof this.word.explanation=="string"?{explanation:this.word.explanation}:{},clean:this.wordClean}),this.wordGoal&&this.completed>=this.wordGoal){this.won=!0,this.phase="over",this.clearInput(),this.emit("expedition",{goal:this.wordGoal});return}this.completed%3===0&&this.startBonus(),this.nextWord()}startBonus(){this.bonus=[];let t=this.freeCells(),s=this.cell(this.head);t.sort((e,i)=>Math.abs(e.x-s.x)+Math.abs(e.y-s.y)-(Math.abs(i.x-s.x)+Math.abs(i.y-s.y)));for(let e of t){if(this.bonus.length>=5)break;Math.abs(e.x-s.x)+Math.abs(e.y-s.y)>=2&&this.bonus.push({...e})}this.bonusRemaining=12,this.bonusCollected=0,this.emit("harvest")}damage(t){this.invincible>0||(this.hits++,this.combo=0,this.wordClean=!1,this.shield?this.shield=0:this.hp--,this.invincible=2,this.length=Math.max(5,this.length-5),this.emit("hurt",{reason:t,hp:this.hp}),this.hp<=0&&(this.phase="over",this.clearInput(),this.emit("over")))}advanceCell(){let t=C[this.direction],s={x:this.head.x+t.x,y:this.head.y+t.y};if(this.arena==="classic"&&(s.x<0||s.y<0||s.x>=this.cols||s.y>=this.rows)){this.damage("wall");let g=[(this.direction+1)%4,(this.direction+3)%4].filter(b=>{let T={x:this.head.x+C[b].x,y:this.head.y+C[b].y};return T.x>=0&&T.y>=0&&T.x<this.cols&&T.y<this.rows});this.direction=g.find(b=>!this.trail.slice(1,this.length-1).some(T=>this.same(T,{x:this.head.x+C[b].x,y:this.head.y+C[b].y})))??g[0],this.turns.length=0,this.centerTurned=!0,this.progress=0;return}let e=this.tiles.find(u=>this.same(u,s)),i=e&&e.correct&&(this.mode==="choose"||e.id===this.cursor)&&this.length<I,o=this.length-(i?0:1),d=this.hits,n=this.trail.slice(1,o).some(u=>this.same(u,s)),c=this.tailRuleFeedback===!0&&!i&&!n&&this.trail[this.length-1]&&this.same(this.trail[this.length-1],s);if(n&&this.damage("body"),this.head=s,this.trail.unshift({...s}),this.trail.length=Math.min(this.trail.length,I+3),this.steps++,this.phase==="over")return;let l=this.length;if(e&&this.collect(e),this.tailRuleFeedback===!0){this.tailRuleReceipt=null;let u=this.length-l,g=this.hits!==d?null:!n&&u>0?"growth":c?"tail-pass":null;g&&(this.tailRuleReceipt={type:"tail-rule",kind:g,serial:this.tailRuleSerial=(this.tailRuleSerial||0)+1,step:this.steps,growth:Math.max(0,u),x:this.head.x,y:this.head.y})}let f=this.bonus.find(u=>this.same(u,s));if(f&&(this.bonus=this.bonus.filter(u=>u!==f),this.bonusCollected++,this.score+=75*this.multiplier(),this.energy=Math.min(100,this.energy+10),this.emit("fruit",{count:this.bonusCollected}),!this.bonus.length)){this.score+=300;let u=this.hp;this.hp=Math.min(3,this.hp+1),this.emit("basket",{healed:this.hp-u})}let p=this.turns.shift();if(this.centerTurned=!!p,p&&(this.direction=p.d),Math.abs(this.head.x)>4096||Math.abs(this.head.y)>4096){let u=Math.floor(this.head.x/this.cols)*this.cols,g=Math.floor(this.head.y/this.rows)*this.rows;this.head={x:this.head.x-u,y:this.head.y-g};for(let b of this.trail)b.x-=u,b.y-=g}}update(t){if(this.phase!=="playing"||!Number.isFinite(t)||t<=0)return;t=Math.min(t,.05),this.time+=t,this.comboAge+=t,this.invincible=Math.max(0,this.invincible-t),this.hintAge=Math.max(0,this.hintAge-t),this.comboAge>9&&this.combo&&(this.combo=0,this.revision++),this.bonusRemaining>0&&(this.bonusRemaining=Math.max(0,this.bonusRemaining-t),this.bonusRemaining||(this.bonus=[],this.revision++)),this.boosting=this.boostHeld&&this.energy>(this.boosting?0:8),this.energy=P(this.energy+t*(this.boosting?-30:4),0,100);let s=F[this.speedSetting]*(this.boosting?1.55:1);if(this.speed+=(s-this.speed)*(1-Math.exp(-t*18)),this.arena==="classic"&&this.progress<1e-7){let i=C[this.direction];if((this.head.x+i.x<0||this.head.y+i.y<0||this.head.x+i.x>=this.cols||this.head.y+i.y>=this.rows)&&this.advanceCell(),this.phase!=="playing")return}let e=t*this.speed;for(this.distance+=e,this.progress+=e;this.progress>=1&&this.phase==="playing";)if(this.progress-=1,this.advanceCell(),this.arena==="classic"){let i=C[this.direction];(this.head.x+i.x<0||this.head.y+i.y<0||this.head.x+i.x>=this.cols||this.head.y+i.y>=this.rows)&&this.advanceCell()}}bodyPoints(t=0,s=this.length){let e=Math.min(.999999,this.progress+(this.phase==="playing"?t*this.speed:0)),i=C[this.direction],o=[{x:this.head.x+i.x*e,y:this.head.y+i.y*e}],d=s-1,n=o[0];for(let c of this.trail){let l=Math.abs(c.x-n.x)+Math.abs(c.y-n.y);if(l>d){o.push({x:n.x+(c.x-n.x)*d/l,y:n.y+(c.y-n.y)*d/l});break}if(l>1e-6&&o.push(c),d-=l,n=c,d<=0)break}return o}};var E=class{constructor(t,s){this.points=[{x:t.x,y:t.y,step:0,stage:0}],this.body=s.slice(0,9).map(({x:e,y:i})=>({x:e,y:i})),this.pickups=[],this.truncated=!1}reached(t,s,e){this.points.length<256?this.points.push({x:t.x,y:t.y,step:s,stage:e}):this.truncated=!0}collected(t,s){this.pickups.length<3&&this.pickups.push({label:t.label.toUpperCase(),x:t.x,y:t.y,step:s,...(Number.isInteger(t.tileId)?{tileId:t.tileId}:{})})}summary(t){return{comparisonScope:JSON.stringify(["coil-segments-v1",t.challenge,t.cols,t.rows,t.arena,t.speedSetting,t.mode,this.points[0],this.body]),won:t.won,steps:t.steps,hits:t.hits,letters:this.pickups.length,pickups:this.pickups.map(s=>({...s}))}}};var et="coil-choice-r1",_=class extends N{damage(t){let s=this.eventSerial,e={...this.head},i=this.direction,o=[[1,0],[0,1],[-1,0],[0,-1]][i];super.damage(t);let d=this.events.find(n=>n.id>s&&n.type==="hurt");d&&Object.assign(d,{from:e,direction:i,target:{x:e.x+o[0],y:e.y+o[1]}})}advanceCell(){let t=this.steps,s=this.letters,e=this.eventSerial;if(super.advanceCell(),this.route&&this.steps>t&&(this.route.reached(this.head,this.steps,s),this.letters>s))for(let i of this.events)i.id>e&&i.type==="eat"&&this.route.collected(i,this.steps)}};const CAT_PICKUPS=Object.freeze([[5,6],[4,8],[5,8]].map(Object.freeze));
const CAT=Object.freeze({en:"cat",zh:"猫"});
function wordOrder(game){return [...game.word.en].map((label,id)=>numberedLabel(game,{label,id})).join(" → ");}
function X(word={en:"arc",zh:"弧线"}){let r=new _({cols:16,rows:12,arena:"classic",speed:0,mode:"spell",words:[word],seed:17}),t=[[7,5],[6,5],[5,5],[4,5],[4,6],[4,7],[5,7],[6,7],[7,7]];for(let s=8;s<=14;s++)t.push([s,7]);for(let s=6;s>=1;s--)t.push([14,s]);for(let s=13;s>=1;s--)t.push([s,1]);return t.push([1,2],[1,3]),Object.assign(r,{challenge:et,wordGoal:1,head:{x:7,y:5},length:9,trail:t.map(([s,e])=>({x:s,y:e})),tiles:[{x:6,y:6,id:0,label:"a",correct:!0},{x:10,y:8,id:1,label:"r",correct:!0},{x:11,y:3,id:2,label:"c",correct:!0}]}),r.route=new E(r.head,r.trail.slice(0,r.length)),r.setPaused(!0),r}var B=60,w=Object.freeze(["\u7ED5\u5F00\u76D8\u8EAB","\u7A7F\u8FC7\u5C3E\u95E8","\u6CBF\u69FD\u56DE\u8F6C"]);let openingFork=false, catTail=false, newPack=false;
const waterTheme={edge:"#d9e8df",leaf:"#a6cbb8",flower:"#eccd8e",ground:"#e2efea",tile:"#eaf4ee",line:"#789a8d"};
function paintWaterBanks(ctx,x,y,cell,cols,rows){
 const w=cols*cell,h=rows*cell;
 ctx.save();ctx.translate(x,y);ctx.scale(w,h);
 // Uneven banks sweep across the continuous floor, not cell boundaries.
 ctx.fillStyle="#88c9c32b";ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(.37,0);
 ctx.bezierCurveTo(.23,.14,.26,.22,.14,.31);ctx.bezierCurveTo(.065,.37,.1,.51,0,.59);
 ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(1,.27);ctx.lineTo(1,1);ctx.lineTo(.61,1);
 ctx.bezierCurveTo(.76,.89,.72,.77,.86,.68);ctx.bezierCurveTo(.98,.57,.91,.40,1,.27);
 ctx.closePath();ctx.fill();
 ctx.strokeStyle="#548d814a";ctx.lineWidth=.003;
 for(const [u,v,wide] of [[0,.48,.12],[.08,.26,.11],[.16,.14,.13],[.76,.88,.12],[.85,.71,.1],[.91,.49,.09]]){
  ctx.beginPath();ctx.moveTo(u,v);ctx.bezierCurveTo(u+wide*.4,v+.024,u+wide*.7,v-.023,u+wide,v);ctx.stroke();
 }
 ctx.restore();
}
// Optional feedback only: never queues or replays movement, and never starts music.
const waterEarcons={
 move:[[0,.032,480,440,.021]],
 tail:[[0,.084,660,310,.039]],
 pickup:[[0,.050,620,620,.033],[.057,.065,830,830,.037]]
};
let waterAudio=null,waterAudioBus=null,waterAudioReady=false,waterAudioChoice=0;
function silenceWaterSound(){
 if(!waterAudioBus)return;
 try{waterAudioBus.disconnect()}catch{}
 waterAudioBus=null;
}
function syncWaterSound(){
 const choice=a("water-sound"),note=a("water-sound-status");
 choice.disabled=!newPack;
 note.textContent=newPack&&choice.checked?"仅在实际走格、穿尾和按序取字时发声。":"";
}
function changeWaterSound(){
 const choice=a("water-sound"),seq=++waterAudioChoice;
 silenceWaterSound();
 waterAudioReady=false;
 syncWaterSound();
 if(!choice.checked||!newPack||document.hidden)return;
 const unavailable=()=>{
  if(seq!==waterAudioChoice)return;
  choice.checked=false;
  a("water-sound-status").textContent="当前设备无法开启提示音，仍可正常游玩。";
 };
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){unavailable();return}
  waterAudio??=new Audio();
  const resume=waterAudio.state==="running"?null:waterAudio.resume();
  if(!resume)waterAudioReady=true;
  else Promise.resolve(resume).then(()=>{
   if(seq===waterAudioChoice&&choice.checked&&newPack)waterAudioReady=waterAudio.state==="running";
   if(seq===waterAudioChoice&&!waterAudioReady)unavailable();
  },unavailable);
 }catch{unavailable()}
}
function playWaterSound(kind){
 if(!newPack||!waterAudioReady||!a("water-sound").checked||document.hidden||waterAudio?.state!=="running")return;
 try{
  if(!waterAudioBus){
   waterAudioBus=waterAudio.createGain();
   waterAudioBus.connect(waterAudio.destination);
  }
  const now=waterAudio.currentTime;
  for(const [offset,duration,from,to,level] of waterEarcons[kind]){
   const t=now+.004+offset,end=t+duration;
   const voice=waterAudio.createOscillator(),amp=waterAudio.createGain(),quiet=.0001;
   voice.type="sine";
   voice.frequency.setValueAtTime(from,t);
   voice.frequency.exponentialRampToValueAtTime(to,end);
   amp.gain.setValueAtTime(quiet,t);
   amp.gain.exponentialRampToValueAtTime(level,t+.006);
   amp.gain.exponentialRampToValueAtTime(quiet,end);
   voice.connect(amp);
   amp.connect(waterAudioBus);
   voice.onended=()=>{voice.disconnect();amp.disconnect()};
   voice.start(t);
   voice.stop(end+.002);
  }
 }catch{/* An unavailable sound output must not affect the accepted step. */}
}
// Post-move only. The wake never previews a cell or affects the relay clock.
const TAIL_WAKE_MS=540;
let tailWakes=[];
function rememberTailWake(game,kind,start){
 if(kind!=="tail"||game.challenge!=="bay-tail-waterway")return;
 const {x,y}=game.head;
 tailWakes=tailWakes.filter(w=>w.game===game&&start-w.start<TAIL_WAKE_MS);
 tailWakes.push({game,x,y,start});
 if(tailWakes.length>2)tailWakes.shift();
}
function drawTailWake(ctx,game,now,reduced){
 if(game.challenge!=="bay-tail-waterway")return;
 for(const w of tailWakes){
  const age=now-w.start;
  if(w.game!==game||age<0||age>=TAIL_WAKE_MS)continue;
  const p=reduced?0:age/TAIL_WAKE_MS;
  // Mirrored brackets hug the cell edges. No letter, head, or tail marker gets covered.
  const left=w.x+.095,right=w.x+.905,top=w.y+.105,bot=w.y+.895;
  ctx.save();ctx.globalAlpha=reduced?.93:Math.min(1,1.20-p);ctx.lineCap="round";ctx.lineJoin="round";
  ctx.beginPath();
  for(const [x,dx] of [[left,1],[right,-1]]){
   ctx.moveTo(x+dx*.145,top);ctx.lineTo(x,top);ctx.lineTo(x,top+.16);
   ctx.moveTo(x,bot-.16);ctx.lineTo(x,bot);ctx.lineTo(x+dx*.145,bot);
  }
  ctx.strokeStyle="#fcfff3";ctx.lineWidth=.094;ctx.stroke();
  ctx.strokeStyle="#145b68";ctx.lineWidth=.052;ctx.stroke();
  ctx.restore();
 }
}
const tailReceiptByGame=new WeakMap();
function noteBAYTailPass(game,serialBefore,hitsBefore){
 const d=game.tailRuleReceipt;
 if(game.challenge!=="bay-tail-waterway"||game.hits!==hitsBefore||d?.kind!=="tail-pass"||d.serial<=serialBefore)return;
 let history=tailReceiptByGame.get(game);
 if(!history)tailReceiptByGame.set(game,history=[]);
 history.push(d.step);
}
function tailRouteRecap(result){
 if(!result.tailPasses)return "";
 return result.tailPasses.length?`贴尾：${result.tailPasses.map(n=>`第 ${n} 步`).join("、")}。`:"本图未贴尾。";
}
const snakeCueTtl={move:115,tail:200,pickup:255};
let snakeCue=null,snakeCueFrame=0;
function addSnakeCue(game,kind,from){
 snakeCue={game,kind,from:{...from},x:game.head.x+.5,y:game.head.y+.5,start:performance.now()};
 rememberTailWake(game,kind,snakeCue.start);
 if(!snakeCueFrame)snakeCueFrame=requestAnimationFrame(snakeCueTick);
}
function snakeCueTick(now){
 snakeCueFrame=0;
 if(!snakeCue&&!tailWakes.length)return;
 const cue=snakeCue,active=L();
 if(active.paused||document.hidden){snakeCue=null;tailWakes=[];return}
 if(cue&&(cue.game!==active.game||now-cue.start>=snakeCueTtl[cue.kind]))snakeCue=null;
 tailWakes=tailWakes.filter(w=>w.game===active.game&&now-w.start<TAIL_WAKE_MS);
 k.draw(active.game);
 if((snakeCue||tailWakes.length)&&!snakeCueFrame)snakeCueFrame=requestAnimationFrame(snakeCueTick);
}
function drawSnakeCue(ctx,game,reduced){
 if(L().paused)return;
 drawTailWake(ctx,game,performance.now(),reduced);
 const q=snakeCue;if(!q||q.game!==game)return;
 const p=reduced?.35:Math.max(0,Math.min(1,(performance.now()-q.start)/snakeCueTtl[q.kind]));
 const {x,y}=q;
 ctx.save();ctx.globalAlpha=reduced?.85:1-p*.8;ctx.lineCap="round";
 if(q.kind==="move"){
  const mx=x-q.from.x-.5,my=y-q.from.y-.5,lag=.22+p*.24;
  ctx.strokeStyle="#1d724d";ctx.lineWidth=.05;ctx.beginPath();
  ctx.arc(x-mx*lag,y-my*lag,.45,Math.atan2(my,mx)+1.03,Math.atan2(my,mx)+5.25);ctx.stroke();
 }else if(q.kind==="tail"){
  ctx.strokeStyle="#176e73";ctx.lineWidth=.062;ctx.setLineDash([.1,.055]);ctx.beginPath();ctx.arc(x,y,.44+p*.11,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);ctx.strokeStyle="#f5fffa";ctx.lineWidth=.035;ctx.beginPath();ctx.arc(x,y,.37+p*.08,0,Math.PI*2);ctx.stroke();
 }else{
  ctx.strokeStyle="#a66622";ctx.lineWidth=.061;
  for(let j=0;j<4;j++){const a=(j+.5)*Math.PI/2,h=.43+p*.11;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*h,y+Math.sin(a)*h);ctx.lineTo(x+Math.cos(a)*(h+.14),y+Math.sin(a)*(h+.14));ctx.stroke();}
  ctx.strokeStyle="#fff1a6";ctx.lineWidth=.044;ctx.beginPath();ctx.arc(x,y,.39+p*.12,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}

const NEW_ROOMS=Object.freeze([{"id":"bay-tail-waterway","title":"贴尾过湾","word":"bay","meaning":"海湾","direction":0,"trail":[[7,5],[6,5],[5,5],[5,6],[5,7],[6,7],[7,7],[7,6]],"letters":[[6,8],[9,7],[10,4]]},{"id":"eel-double-vowel","title":"双 E 回游","word":"eel","meaning":"鳗鱼","direction":0,"trail":[[7,5],[6,5],[6,6],[6,7],[7,7],[8,7],[9,7],[9,8],[8,8],[7,8]],"letters":[[10,5],[8,5],[7,9]]}]);
const PACK_LIMITS=Object.freeze([16,14,18]);
function limits(){return newPack?PACK_LIMITS:Y}
function roomName(index){return newPack&&index>0?NEW_ROOMS[index-1].title:w[index]}
function numberedLabel(game,tile){
 return pickupLabel(game.word.en==='eel'?{label:tile.label,tileId:tile.id}:{label:tile.label});
}
function pickupLabel(receipt){
 return receipt.label.toUpperCase()+(receipt.tileId===0?"①":receipt.tileId===1?"②":"");
}
function newRoom(room){
 let t=X({en:room.word,zh:room.meaning});
 t.trail=room.trail.map(([x,y])=>({x,y}));t.head={...t.trail[0]};
 t.length=t.trail.length;t.direction=room.direction;t.tailRuleFeedback=true;t.challenge=room.id;t.keepFinalGrowth=true;
 t.tiles=room.letters.map(([x,y],id)=>({x,y,id,label:room.word[id],correct:true}));
 t.route=new E(t.head,t.trail.slice(0,t.length));
 return t;
}
function paintOrdinal(ctx,tile,active){
 const x=tile.x+.5,y=tile.y+.5;
 ctx.save();
 $(ctx,x+.29,y-.29,.19,active?"#50331f":"#213928");
 ctx.strokeStyle="#fff5db";ctx.lineWidth=.025;ctx.beginPath();ctx.arc(x+.29,y-.29,.19,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle="#fffaf0";ctx.font="800 .29px system-ui, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.fillText(["①","②"][tile.id],x+.29,y-.29);ctx.restore();
}
function M(r){if(!Number.isInteger(r)||r<0||r>=w.length)throw new RangeError("Unknown relay stage");if(newPack&&r>0)return newRoom(NEW_ROOMS[r-1]);const cat=r===1&&catTail;let t=X(cat?CAT:undefined);if(t.tailRuleFeedback=!0,r===0&&openingFork){const trail=[[7,6],[6,6],[5,6],[5,5],[5,4],[6,4],[7,4],[8,4],[8,5],[9,5],[10,5]];t.trail=trail.map(([x,y])=>({x,y}));t.head={...t.trail[0]};t.length=t.trail.length;t.direction=0;t.tiles=[[7,8],[10,6],[12,7]].map(([x,y],id)=>({x,y,id,label:'arc'[id],correct:true}));}else if(r>0){let e=[null,{trail:[[6,5],[5,5],[4,5],[4,6],[4,7],[5,7],[6,7],[7,7],[8,7]],tiles:[[7,6],[8,8],[5,8]],direction:0},{trail:[[8,4],[8,5],[8,6],[7,6],[6,6],[5,6],[5,5],[5,4],[5,3],[6,3],[7,3]],tiles:[[7,4],[6,5],[9,7]],direction:3}][r];t.trail=e.trail.map(([i,o])=>({x:i,y:o})),t.head={...t.trail[0]},t.length=e.trail.length,t.direction=e.direction,t.tiles=(cat?CAT_PICKUPS:e.tiles).map(([i,o],d)=>({x:i,y:o,id:d,label:t.word.en[d],correct:!0}))}return t.challenge=cat?'tail-gate-cat-20261123-r2':r===0&&openingFork?'opening-fork-20261123-r1':`distinct-routes-20261114-r1-${r}`,t.route=new E(t.head,t.trail.slice(0,t.length)),t}var O=class{constructor(){this.reset()}reset(){this.stage=0,this.totalSteps=0,this.results=[],this.state="ready",this.paused=!1,this.game=M(0),this.reason="",this.message="\u4E09\u5F20\u56FE\u517160\u6B65\uFF0C\u78B0\u649E\u5373\u7ED3\u675F\u3002\u6309\u201C\u5F00\u59CB\u63A5\u529B\u201D\u540E\u518D\u9009\u65B9\u5411\u3002"}get remaining(){return Math.max(0,B-this.totalSteps)}start(){return this.state!=="ready"?!1:(this.state="running",this.message="\u7B2C\u4E00\u56FE\uFF1A\u6309 A \u2192 R \u2192 C \u53D6\u5B57\uFF0C\u6CE8\u610F\u76D8\u8EAB\u8BA9\u8DEF\u3002",!0)}pause(){return this.state!=="running"||this.paused?!1:(this.paused=!0,this.message="\u5DF2\u6682\u505C\u3002\u70B9\u51FB\u7EE7\u7EED\u540E\uFF0C\u4ECD\u9700\u6BCF\u6B21\u6309\u952E\u624D\u8D70\u4E00\u683C\u3002",!0)}resume(){return this.state!=="running"||!this.paused?!1:(this.paused=!1,this.message=`\u7EE7\u7EED\u7B2C${this.stage+1}\u56FE\uFF0C\u8FD8\u5269${this.remaining}\u6B65\u3002`,!0)}next(){return this.state!=="between"?!1:(this.stage++,this.game=M(this.stage),this.state="running",this.paused=!1,this.message=`\u7B2C${this.stage+1}\u56FE \xB7 ${roomName(this.stage)}\u3002\u770B\u6E05\u65B0\u7684\u8D77\u70B9\u3001\u671D\u5411\u548C\u8EAB\u4F53\uFF0C\u518D\u9009\u65B9\u5411\u3002`,!0)}finish(t){this.reason=t,this.state=t==="complete"?"won":"lost",this.paused=!1,this.game.setPaused(!0),this.game.clearInput();let s={complete:`\u4E09\u56FE\u63A5\u529B\u5B8C\u6210\uFF01\u7528${this.totalSteps}\u6B65\uFF0C\u8FD8\u5269${this.remaining}\u6B65\u3002`,body:"\u78B0\u5230\u8EAB\u4F53\uFF0C\u63A5\u529B\u7ED3\u675F\u3002\u53EF\u4EE5\u5148\u5728\u4E0D\u9650\u6B65\u7EC3\u4E60\u91CC\u8BD5\u53E6\u4E00\u6761\u8DEF\u7EBF\u3002",wall:"\u78B0\u5230\u62A4\u680F\uFF0C\u63A5\u529B\u7ED3\u675F\u3002\u63A5\u529B\u4E0D\u4F7F\u7528\u62A4\u680F\u6551\u63F4\u7EE7\u7EED\u95EF\u5173\u3002",budget:"60\u6B65\u5DF2\u7528\u5B8C\uFF0C\u63A5\u529B\u7ED3\u675F\u3002\u91CD\u6765\u65F6\u8BD5\u7740\u5C11\u7ED5\u51E0\u683C\u3002"};this.message=s[t]}step(t){let s=this.game;if(this.state!=="running"||this.paused||!Number.isInteger(t)||t<0||t>3)return!1;if(t===(s.direction+2)%4)return this.message="\u4E0D\u80FD\u76F4\u63A5\u6389\u5934\uFF0C\u672C\u6B21\u4E0D\u8D70\u683C\u4E5F\u4E0D\u6263\u6B65\u6570\u3002",!1;let e=s.eventSerial,i=s.steps,o=s.hits,tailBefore=s.tailRuleSerial||0;if(s.setPaused(!1),t!==s.direction&&!s.input(t))return s.setPaused(!0),this.message="\u8F6C\u5411\u672A\u63A5\u53D7\uFF0C\u672C\u6B21\u4E0D\u8D70\u683C\u4E5F\u4E0D\u6263\u6B65\u6570\u3002",!1;for(let l=0;l<4&&s.phase==="playing"&&s.hits===o;l++)s.update(.05);s.setPaused(!0),this.totalSteps+=s.steps-i;let d=s.events.filter(l=>l.id>e),n=d.find(l=>l.type==="hurt");if(!n)noteBAYTailPass(s,tailBefore,o);if(n)return this.finish(n.reason==="wall"?"wall":"body"),!0;if(s.won)return this.results.push({stage:this.stage,name:roomName(this.stage),steps:s.steps,pickups:s.route.pickups.map(l=>({...l})),...(s.challenge==="bay-tail-waterway"?{tailPasses:[...(tailReceiptByGame.get(s)||[])]}:{})}),this.stage===w.length-1?(this.finish("complete"),!0):this.remaining===0?(this.finish("budget"),!0):(this.state="between",this.message=`\u7B2C${this.stage+1}\u56FE\u5B8C\u6210\uFF0C\u7528${s.steps}\u6B65\u3002\u8FD8\u5269${this.remaining}\u6B65\uFF1B\u51C6\u5907\u597D\u540E\u8FDB\u5165\u4E0B\u4E00\u56FE\u3002`,!0);if(this.remaining===0)return this.finish("budget"),!0;let c=d.find(l=>l.type==="eat");return this.message=c?`\u53D6\u5230 ${pickupLabel(c)}\uFF01\u4E09\u56FE\u5171\u5269${this.remaining}\u6B65\u3002`:`\u5DF2\u8D70\u4E00\u683C\u3002\u4E09\u56FE\u5171\u5269${this.remaining}\u6B65\uFF0C\u677E\u624B\u53EF\u968F\u65F6\u89C2\u5BDF\u3002`,!0}};var Y=Object.freeze([16,10,14]),G=class extends O{constructor(){super()}get stageLimit(){return limits()[this.stage]}chooseTight(t){return this.state!=="ready"?!1:(this.tight=t===!0,this.readyMessage(),!0)}reset(){let t=this.tight===!0;super.reset(),this.tight=t,this.readyMessage()}readyMessage(){this.message=this.tight?"\u5DF2\u9009\u9010\u56FE"+limits().join(" / ")+"\u6B65\u6311\u6218\u3002\u91CD\u5F00\u4FDD\u7559\u6B64\u6A21\u5F0F\uFF1B\u5982\u8981\u6539\u4E3A\u5E38\u89C460\u6B65\uFF0C\u53D6\u6D88\u4E0A\u65B9\u6311\u6218\u52FE\u9009\uFF0C\u518D\u5F00\u59CB\u3002":"\u5DF2\u9009\u5E38\u89C460\u6B65\u63A5\u529B\u3002\u91CD\u5F00\u4FDD\u7559\u6B64\u6A21\u5F0F\uFF1B\u5982\u8981\u6539\u4E3A\u9010\u56FE\u6311\u6218\uFF0C\u52FE\u9009\u4E0A\u65B9\u6311\u6218\u9009\u9879\uFF0C\u518D\u5F00\u59CB\u3002"}start(){let t=super.start();return t&&this.tight&&(this.message="\u9010\u56FE"+limits().join(" / ")+"\u6B65\uFF1AA \u2192 R \u2192 C\u3002\u7A7A\u4F59\u6B65\u6570\u4E0D\u5E26\u5230\u4E0B\u4E00\u56FE\uFF1B\u9650\u6B65\u6700\u540E\u4E00\u6B65\u53D6\u9F50\u4ECD\u53EF\u8FC7\u5173\u3002"),t}resume(){let t=super.resume();return t&&this.tight&&(this.message=`\u7EE7\u7EED\u7B2C${this.stage+1}\u56FE\uFF0C\u672C\u56FE\u8FD8\u5269${Math.max(0,this.stageLimit-this.game.steps)}\u6B65\u3002`),t}next(){let t=super.next();return t&&this.tight&&(this.message+=` \u672C\u56FE\u91CD\u65B0\u83B7\u5F97${this.stageLimit}\u6B65\u3002`),t}step(t){let s=this.game.letters,e=this.game.tiles.find(o=>o.id===this.game.cursor),i=super.step(t);return!i||!this.tight||(this.state==="running"&&this.game.steps>=this.stageLimit?(this.finish("budget"),this.reason="stage-budget",this.message=`\u672C\u56FE${this.stageLimit}\u6B65\u5DF2\u7528\u5B8C\uFF0C\u5B57\u6BCD\u8FD8\u6CA1\u53D6\u9F50\u3002\u6311\u6218\u7ED3\u675F\uFF1B\u53EF\u8FDB\u4E0D\u9650\u6B65\u7EC3\u4E60\uFF0C\u8BD5\u7740\u7F29\u77ED\u7ED5\u8DEF\u3002`):this.state==="running"?this.message=(this.game.letters>s?`\u53D6\u5230 ${numberedLabel(this.game,e)}\uFF01`:"\u5DF2\u8D70\u4E00\u683C\u3002")+`\u672C\u56FE\u5269${this.stageLimit-this.game.steps}\u6B65\uFF0C\u677E\u624B\u53EF\u968F\u65F6\u89C2\u5BDF\u3002`:this.state==="between"?this.message=`\u7B2C${this.stage+1}\u56FE${this.stageLimit}\u6B65\u6311\u6218\u901A\u8FC7\uFF0C\u7528${this.game.steps}\u6B65\u3002\u4E0B\u4E00\u56FE\u7ED9${limits()[this.stage+1]}\u6B65\uFF0C\u4F59\u6B65\u4E0D\u7ED3\u8F6C\u3002`:this.state==="won"&&(this.message=`\u9010\u56FE${limits().join(" / ")}\u6B65\u6311\u6218\u5B8C\u6210\uFF01\u4E09\u56FE\u5171${this.totalSteps}\u6B65\uFF0C\u539F60\u6B65\u63A5\u529B\u672A\u8BA1\u5165\u3002`)),i}};var R=class{constructor(t){this.game=M(t),this.stage=t,this.state="running",this.paused=!1,this.reason="",this.lastCollision=null,this.previousBoard=null,this.redoSnapshot=null,this.undoCount=0,this.bookmark=null,this.bookmarkSteps=null,this.returnCount=0,this.message=`\u6B63\u5728\u5355\u72EC\u7EC3\u4E60\u7B2C${t+1}\u56FE \xB7 ${w[t]}\u3002\u4E0D\u9650\u6B65\u6570\uFF1B\u78B0\u649E\u4ECD\u4F1A\u505C\u4E0B\uFF0C\u53EF\u9000\u56DE\u521A\u624D\u4E00\u6B65\u53E6\u8BD5\uFF0C\u4E0D\u7EED\u63A5\u6B63\u5F0F\u63A5\u529B\u3002`}get collisionText(){let t=this.lastCollision;if(!t)return"";let s=t.reason==="wall"?"\u76D8\u5916\u62A4\u680F":`\u7B2C${t.target.x+1}\u5217\u3001\u7B2C${t.target.y+1}\u884C\u7684\u8EAB\u4F53`;return`\u4E0A\u6B21\u78B0\u649E\u65F6\u4ECE\u7B2C${t.from.x+1}\u5217\u3001\u7B2C${t.from.y+1}\u884C\u5411${["\u53F3\u2192","\u4E0B\u2193","\u5DE6\u2190","\u4E0A\u2191"][t.direction]}\u8D70\uFF0C\u78B0\u5230${s}\u3002`}get totalSteps(){return this.game.steps}get canUndo(){return this.previousBoard!==null&&!this.paused}undo(){if(!this.canUndo)return!1;this.redoSnapshot=JSON.stringify({game:this.game,state:this.state,reason:this.reason,lastCollision:this.lastCollision,message:this.message});let t=JSON.parse(this.previousBoard),s=M(this.stage),e=Object.assign(s.route,t.route);return Object.assign(s,t),s.route=e,this.game=s,this.previousBoard=null,this.undoCount++,this.state="running",this.reason="",this.paused=!1,this.message=`\u5DF2\u9000\u56DE\u521A\u624D\u4E00\u6B65\u3002${this.collisionText}\u5F53\u524D\u8DEF\u7EBF${s.steps}\u6B65\uFF0C\u5DF2\u9000\u56DE${this.undoCount}\u6B21\uFF1B\u6362\u4E2A\u65B9\u5411\u8BD5\u8BD5\uFF0C\u4E0D\u8BA1\u63A5\u529B\u6210\u7EE9\u3002`,!0}get canRedo(){return this.redoSnapshot!==null&&!this.paused}redo(){if(!this.canRedo)return!1;let t=JSON.parse(this.redoSnapshot),s=M(this.stage),e=JSON.stringify(this.game),i=Object.assign(s.route,t.game.route);return Object.assign(s,t.game),s.route=i,this.game=s,this.state=t.state,this.reason=t.reason,this.lastCollision=t.lastCollision,this.message=t.message.replace(/已退回\d+次/g,`\u5DF2\u9000\u56DE${this.undoCount}\u6B21`),this.previousBoard=e,this.redoSnapshot=null,!0}get canBookmark(){return this.state==="running"&&!this.paused}get canReturn(){return this.bookmark!==null&&!this.paused}saveBookmark(){return this.canBookmark?(this.bookmark=JSON.stringify(this.game),this.bookmarkSteps=this.totalSteps,this.message=`\u5DF2\u8BB0\u4F4F\u7B2C${this.bookmarkSteps}\u6B65\u7684\u5C94\u8DEF\u3002\u53EA\u4FDD\u7559\u4E00\u5904\uFF1B\u56DE\u5230\u8FD9\u91CC\u540E\u53EF\u53E6\u9009\u65B9\u5411\uFF0C\u4E0D\u8BA1\u63A5\u529B\u6210\u7EE9\u3002`,!0):!1}returnToBookmark(){if(!this.canReturn)return!1;this.redoSnapshot=null;let t=JSON.parse(this.bookmark),s=M(this.stage),e=Object.assign(s.route,t.route);return Object.assign(s,t),s.route=e,this.game=s,this.previousBoard=null,this.returnCount++,this.lastCollision=null,this.state="running",this.reason="",this.paused=!1,this.message=`\u5DF2\u56DE\u5230\u7B2C${this.bookmarkSteps}\u6B65\u7684\u5C94\u8DEF\uFF0C\u5DF2\u56DE\u5C94\u8DEF${this.returnCount}\u6B21\u3002\u539F\u5C94\u8DEF\u4ECD\u4FDD\u7559\uFF0C\u53EF\u53E6\u8BD5\u65B9\u5411\uFF1B\u4E0D\u8BA1\u63A5\u529B\u6210\u7EE9\u3002`,!0}pause(){return this.state!=="running"||this.paused?!1:(this.paused=!0,this.message="\u672C\u56FE\u7EC3\u4E60\u5DF2\u6682\u505C\u3002\u7EE7\u7EED\u540E\u4ECD\u6BCF\u6B21\u6309\u952E\u8D70\u4E00\u683C\u3002",!0)}resume(){return this.state!=="running"||!this.paused?!1:(this.paused=!1,this.message="\u7EE7\u7EED\u672C\u56FE\u7EC3\u4E60\u3002\u4E0D\u9650\u6B65\u6570\uFF0C\u4E0D\u8BA1\u63A5\u529B\u6210\u7EE9\u3002",!0)}finish(t){this.reason=t,this.state=t==="complete"?"won":"lost",this.paused=!1,this.game.setPaused(!0),this.game.clearInput(),this.message=t==="complete"?`\u672C\u56FE\u7EC3\u4E60\u5B8C\u6210\uFF0C\u5F53\u524D\u8DEF\u7EBF${this.totalSteps}\u6B65\uFF0C\u5DF2\u9000\u56DE${this.undoCount}\u6B21\u3002\u53EF\u9000\u56DE\u6700\u540E\u4E00\u6B65\u6216\u91CD\u7EC3\u672C\u56FE\uFF1B\u8FD9\u4E0D\u7B97\u4E09\u56FE\u63A5\u529B\u901A\u5173\u3002`:`\u78B0\u5230${t==="wall"?"\u62A4\u680F":"\u8EAB\u4F53"}\uFF0C\u672C\u6B21\u7EC3\u4E60\u505C\u4E0B\u3002\u53EF\u9000\u56DE\u521A\u624D\u4E00\u6B65\u6539\u8D70\uFF0C\u6216\u91CD\u7EC3\u7B2C${this.stage+1}\u56FE\u3002`}step(t){let s=this.game;if(this.state!=="running"||this.paused||!Number.isInteger(t)||t<0||t>3)return!1;if(t===(s.direction+2)%4)return this.message="\u4E0D\u80FD\u76F4\u63A5\u6389\u5934\uFF0C\u672C\u6B21\u4E0D\u8D70\u683C\u3002",!1;let e=s.eventSerial,i=s.hits,o=JSON.stringify(s),d={...s.head},n=[[1,0],[0,1],[-1,0],[0,-1]][t];if(s.setPaused(!1),t!==s.direction&&!s.input(t))return s.setPaused(!0),this.message="\u8F6C\u5411\u672A\u63A5\u53D7\uFF0C\u672C\u6B21\u4E0D\u8D70\u683C\u3002",!1;this.redoSnapshot=null,this.previousBoard=o;for(let p=0;p<4&&s.phase==="playing"&&s.hits===i;p++)s.update(.05);s.setPaused(!0);let c=s.events.filter(p=>p.id>e),l=c.find(p=>p.type==="hurt");if(l)return this.lastCollision={from:{...l.from},direction:l.direction,target:{...l.target},reason:l.reason==="wall"?"wall":"body"},this.finish(this.lastCollision.reason),this.message+=this.collisionText,!0;if(this.lastCollision=null,s.won)return this.finish("complete"),!0;let f=c.find(p=>p.type==="eat");return this.message=f?`\u53D6\u5230 ${pickupLabel(f)}\uFF01\u672C\u56FE\u5DF2\u8D70${s.steps}\u6B65\uFF1B\u4E0D\u8BA1\u63A5\u529B\u6210\u7EE9\u3002`:`\u672C\u56FE\u5DF2\u8D70${s.steps}\u6B65\u3002\u677E\u624B\u53EF\u89C2\u5BDF\uFF0C\u4E0D\u9650\u6B65\u6570\uFF1B\u4E0D\u8BA1\u63A5\u529B\u6210\u7EE9\u3002`,!0}};function K(r,{cols:t,rows:s},{ox:e,oy:i,cell:o}){r.save(),r.strokeStyle="#385d4b70",r.lineWidth=Math.max(.65,Math.min(1,o/24)),r.setLineDash([]),r.beginPath();for(let d=1;d<t;d++){let n=e+d*o;r.moveTo(n,i),r.lineTo(n,i+s*o)}for(let d=1;d<s;d++){let n=i+d*o;r.moveTo(e,n),r.lineTo(e+t*o,n)}r.stroke(),r.restore()}function st(r,t){if(r.tailRuleFeedback!==!0||t.length<2)return null;let s=t.at(-1),e={x:x(s.x,r.cols),y:x(s.y,r.rows)},i=o=>Math.hypot(x(o.x-e.x+r.cols/2,r.cols)-r.cols/2,x(o.y-e.y+r.rows/2,r.rows)-r.rows/2)<.85;return i(t[0])||r.tiles.some(i)||r.bonus.some(i)?null:e}var it=[{ground:"#e6edcc",tile:"#e3eac6",edge:"#c8d8ad",line:"#a0b67d",leaf:"#92ad73",flower:"#edb27d",name:"\u9752\u8349\u82B1\u56ED"},{ground:"#dcebdc",tile:"#d7e6d5",edge:"#b8d3bc",line:"#89b29d",leaf:"#84ab93",flower:"#d9a4b8",name:"\u8584\u8377\u6EAA\u8C37"},{ground:"#f0e6ce",tile:"#ece0c6",edge:"#dac9a5",line:"#bdaa7c",leaf:"#b3b081",flower:"#df977d",name:"\u91D1\u8272\u679C\u56ED"}],j=(r,t,s,e,i,o,d)=>{r.fillStyle=d,r.beginPath(),r.roundRect(t,s,e,i,o),r.fill()},$=(r,t,s,e,i)=>{r.fillStyle=i,r.beginPath(),r.arc(t,s,e,0,Math.PI*2),r.fill()},z=class{constructor(t){this.canvas=t,this.ctx=t.getContext("2d",{alpha:!1}),this.cache=document.createElement("canvas"),this.back=this.cache.getContext("2d",{alpha:!1}),this.width=1,this.height=1,this.dpr=1,this.key="",this.logicGrid=!1,this.particles=[],this.rings=[],this.eatAge=10,this.displayLength=5,this.reduced=matchMedia("(prefers-reduced-motion: reduce)").matches}resize(t,s,e=devicePixelRatio||1){let i=Math.min(1.75,e);t=Math.max(1,Math.round(t)),s=Math.max(1,Math.round(s)),!(t===this.width&&s===this.height&&i===this.dpr)&&(this.width=t,this.height=s,this.dpr=i,this.canvas.width=Math.round(t*i),this.canvas.height=Math.round(s*i),this.cache.width=this.canvas.width,this.cache.height=this.canvas.height,this.key="")}geometry(t){let s=this.width<600?10:23;this.cell=Math.min((this.width-2*s)/t.cols,(this.height-2*s)/t.rows),this.ox=(this.width-this.cell*t.cols)/2,this.oy=(this.height-this.cell*t.rows)/2}background(t){let s=Math.floor(t.completed/3)%3,e=`${this.width}/${this.height}/${this.dpr}/${t.cols}/${t.rows}/${s}/${t.arena}/${this.logicGrid}/${newPack}`;if(this.key===e)return;this.key=e;let i=this.back,o=newPack?waterTheme:it[s],d=this.cell,n=this.ox,c=this.oy,l=t.cols*d,f=t.rows*d;i.setTransform(this.dpr,0,0,this.dpr,0,0),i.fillStyle=o.edge,i.fillRect(0,0,this.width,this.height);let p=W(26);for(let u=0;u<100;u++){let g=p()*this.width,b=p()*this.height;g>n-9&&g<n+l+9&&b>c-9&&b<c+f+9||(i.save(),i.translate(g,b),i.rotate(p()*6.28),i.fillStyle=o.leaf,i.beginPath(),i.ellipse(0,0,3+p()*6,2+p()*3,0,0,Math.PI*2),i.fill(),i.restore(),u%6===0&&($(i,g,b,3,o.flower),$(i,g,b,1.1,"#fff8db")))}j(i,n-4,c+2,l+8,f+8,15,"#53673b1c"),j(i,n-4,c-4,l+8,f+8,15,"#ffffff90"),j(i,n,c,l,f,12,o.ground),i.save(),i.beginPath(),i.roundRect(n,c,l,f,12),i.clip(),i.fillStyle=o.tile;for(let u=0;u<t.rows;u++)for(let g=0;g<t.cols;g++)(u+g)%2===0&&i.fillRect(n+g*d,c+u*d,d,d);if(newPack)paintWaterBanks(i,n,c,d,t.cols,t.rows);i.fillStyle=`${o.line}55`;for(let u=1;u<t.rows;u++)for(let g=1;g<t.cols;g++)i.beginPath(),i.arc(n+g*d,c+u*d,.75,0,6.29),i.fill();if(this.logicGrid&&K(i,t,this),t.arena==="classic")i.strokeStyle="#9d7e52",i.lineWidth=4,i.setLineDash([10,3]),i.strokeRect(n+2,c+2,l-4,f-4),i.setLineDash([]);else{i.fillStyle=o.line,i.globalAlpha=.65;for(let u=-1;u<=1;u++)i.beginPath(),i.moveTo(n+3,c+f/2+u*10),i.lineTo(n+6,c+f/2+u*10-3),i.lineTo(n+6,c+f/2+u*10+3),i.fill(),i.beginPath(),i.moveTo(n+l-3,c+f/2+u*10),i.lineTo(n+l-6,c+f/2+u*10-3),i.lineTo(n+l-6,c+f/2+u*10+3),i.fill()}i.restore()}event(t){if(["eat","fruit","complete","hurt","basket"].includes(t.type)){let s=t.type==="hurt"?"#d68167":t.type==="fruit"?"#e2aa39":"#f1aa61";if(this.rings.push({x:t.x+.5,y:t.y+.5,age:0,color:s}),this.rings.length>6&&this.rings.shift(),t.type==="eat"&&(this.eatAge=0),this.reduced)return;let e=t.type==="complete"?14:7;for(let i=0;i<e&&this.particles.length<64;i++){let o=i/e*Math.PI*2+.2;this.particles.push({x:t.x+.5,y:t.y+.5,vx:Math.cos(o)*(1.4+i%3*.4),vy:Math.sin(o)*1.7-.8,age:0,life:.45+i%3*.1,color:s,size:.06+i%2*.03})}}}update(t,s){this.eatAge+=t,this.displayLength+=(s.length-this.displayLength)*(1-Math.exp(-t*9));for(let e=this.particles.length-1;e>=0;e--){let i=this.particles[e];i.age+=t,i.x+=i.vx*t,i.y+=i.vy*t,i.vy+=3*t,i.age>=i.life&&this.particles.splice(e,1)}for(let e=this.rings.length-1;e>=0;e--)this.rings[e].age+=t,this.rings[e].age>.55&&this.rings.splice(e,1)}draw(t,s=0){this.geometry(t),this.background(t);let e=this.ctx,i=this.cell;e.setTransform(1,0,0,1,0,0),e.drawImage(this.cache,0,0),e.setTransform(this.dpr,0,0,this.dpr,0,0),e.save(),e.beginPath(),e.roundRect(this.ox,this.oy,t.cols*i,t.rows*i,12),e.clip(),e.translate(this.ox,this.oy),e.scale(i,i);let o=t.time+s;for(let n of t.tiles){let c=t.mode==="choose"||n.id===t.cursor,l=t.mode==="choose"&&t.hintAge>0&&n.correct,f=n.x+.5,p=n.y+.5,u=this.reduced?0:Math.sin(o*3+n.id)*.025;c&&(e.strokeStyle=l?"#4d9d77":"#da925550",e.lineWidth=.038,e.beginPath(),e.arc(f,p,.57+Math.sin(o*3)*.025,0,Math.PI*2),e.stroke()),e.save(),e.translate(f,p+u),e.scale(1.12,1.12),e.globalAlpha=c?1:.88,e.fillStyle=c?"#92683323":"#75865a14",e.beginPath(),e.ellipse(0,.3,.4,.13,0,0,Math.PI*2),e.fill();let g=c?"#e98b50":"#c5d797";e.fillStyle=g,e.beginPath(),e.moveTo(0,-.31),e.bezierCurveTo(.32,-.48,.49,-.18,.37,.14),e.bezierCurveTo(.28,.43,-.24,.43,-.37,.15),e.bezierCurveTo(-.52,-.16,-.29,-.48,0,-.31),e.fill(),e.strokeStyle=c?"#a05f37":"#809954",e.lineWidth=.055,e.lineCap="round",e.beginPath(),e.moveTo(0,-.31),e.quadraticCurveTo(-.06,-.46,.035,-.5),e.stroke(),e.fillStyle=c?"#668b48":"#8ea967",e.beginPath(),e.ellipse(.14,-.4,.13,.06,-.45,0,Math.PI*2),e.fill(),e.fillStyle=c?"#fff3de":"#f7fae2",e.beginPath(),e.ellipse(-.19,-.17,.045,.105,.45,0,Math.PI*2),e.fill(),e.fillStyle=c?"#50331f":"#4c6438",e.font="800 .52px ui-rounded, system-ui, sans-serif",e.textAlign="center",e.textBaseline="middle",e.fillText(t.mode==="choose"?String.fromCharCode(65+n.id):n.label.toUpperCase(),.02,.035),e.restore(),t.mode==="spell"&&!c&&!(t.word.en==="eel"&&n.id<2)&&($(e,f+.33,p+.31,.13,"#f5f7e5"),e.fillStyle="#748955",e.font="600 .17px system-ui",e.textAlign="center",e.textBaseline="middle",e.fillText(String(n.id+1),f+.33,p+.32))}for(let n of t.bonus){let c=n.x+.5,l=n.y+.5;e.save(),e.translate(c,l),e.rotate(Math.sin(o*2)*.1),$(e,0,.13,.32,"#b0873923"),$(e,0,0,.28,"#edb844"),$(e,-.07,-.09,.09,"#fff0a8"),e.strokeStyle="#fff6bd",e.lineWidth=.035,e.beginPath(),e.moveTo(-.12,0),e.lineTo(.12,0),e.moveTo(0,-.12),e.lineTo(0,.12),e.stroke(),e.restore()}let d=t.bodyPoints(s,this.displayLength);if(this.wrappedSnake(e,d,t,o),drawSnakeCue(e,t,this.reduced),t.word.en==="eel"&&t.tiles.forEach(tile=>{if(tile.id<2)paintOrdinal(e,tile,tile.id===t.cursor)}),t.tailRuleFeedback===!0){let n=st(t,d);n&&(e.save(),e.fillStyle="#fff5d9",e.strokeStyle="#685a43",e.lineWidth=.045,e.beginPath(),e.arc(n.x+.5,n.y+.5,.3,0,Math.PI*2),e.fill(),e.stroke(),e.fillStyle="#493f30",e.font="700 .42px system-ui, sans-serif",e.textAlign="center",e.textBaseline="middle",e.fillText("\u5C3E",n.x+.5,n.y+.51),e.restore())}for(let n of this.rings)e.globalAlpha=Math.max(0,1-n.age/.55),e.strokeStyle=n.color,e.lineWidth=.035,e.beginPath(),e.arc(n.x,n.y,.35+n.age*1.6,0,6.29),e.stroke();for(let n of this.particles)e.globalAlpha=1-n.age/n.life,$(e,n.x,n.y,n.size,n.color);e.globalAlpha=1,e.restore()}wrappedSnake(t,s,e,i){let o=Math.floor(s[0].x/e.cols)*e.cols,d=Math.floor(s[0].y/e.rows)*e.rows,n=1/0,c=-1/0,l=1/0,f=-1/0;for(let p of s)n=Math.min(n,p.x),c=Math.max(c,p.x),l=Math.min(l,p.y),f=Math.max(f,p.y);for(let p=-e.rows;p<=e.rows;p+=e.rows)for(let u=-e.cols;u<=e.cols;u+=e.cols){let g=u-o+.5,b=p-d+.5;c+g<-.7||n+g>e.cols+.7||f+b<-.7||l+b>e.rows+.7||(t.save(),t.translate(g,b),this.snake(t,s,e,i),t.restore())}}snake(t,s,e,i){t.save(),t.lineCap="round",t.lineJoin="round";let o=(l,f,p=0)=>{t.beginPath(),t.moveTo(s[0].x,s[0].y+p);for(let u=1;u<s.length;u++)t.lineTo(s[u].x,s[u].y+p);t.lineWidth=l,t.strokeStyle=f,t.stroke()};e.invincible>0&&(t.globalAlpha=.65+.2*Math.sin(i*15)),o(.72,"#4a643328",.13),e.shield&&o(.91,"#82bac355"),o(.72,e.boosting?"#518345":"#3d7047"),o(.57,e.boosting?"#b0d45e":"#8dbb67",-.035),o(.13,"#d9ec9d50",-.16);for(let l=2;l<s.length;l+=2){let f=s[l];$(t,f.x,f.y,.065,"#40694435")}let d=s[0];t.translate(d.x,d.y),t.rotate(e.direction*Math.PI/2);let n=Math.max(0,1-this.eatAge/.18);t.scale(1+n*.1,1-n*.06),t.fillStyle="#386b42",t.beginPath(),t.ellipse(.04,.03,.46,.4,0,0,Math.PI*2),t.fill(),t.fillStyle=e.boosting?"#c6e77b":"#a6cf7d",t.beginPath(),t.ellipse(.065,-.015,.435,.355,0,0,Math.PI*2),t.fill(),t.fillStyle="#d5e8a0",t.beginPath(),t.ellipse(.18,.06,.23,.22,0,0,6.29),t.fill();let c=!this.reduced&&i%4.7<.12;for(let l of[-1,1]){let p=l*.215;t.fillStyle="#fcfceb",t.beginPath(),t.ellipse(.13,p,.14,c?.035:.13,0,0,6.29),t.fill(),c||($(t,.13+.045,p,.066,"#24392b"),$(t,.13+.061,p-.028,.021,"#ffffff"))}if(t.strokeStyle="#496d3e",t.lineWidth=.025,t.beginPath(),t.moveTo(.35,-.055),t.quadraticCurveTo(.4,0,.35,.055),t.stroke(),e.boosting){t.strokeStyle="#f1f6c0",t.lineWidth=.035;for(let l of[-1,1])t.beginPath(),t.moveTo(-.55,l*.5),t.lineTo(-1.2,l*.5),t.stroke()}t.restore()}clear(){this.particles.length=0,this.rings.length=0,this.eatAge=10}};var a=r=>document.getElementById(r),m=new G,k=new z(a("board")),h=null,v=null,L=()=>h||m,rt={ArrowRight:0,d:0,ArrowDown:1,s:1,ArrowLeft:2,a:2,ArrowUp:3,w:3},nt=["\u2192","\u2193","\u2190","\u2191"];k.logicGrid=!0;function y(){const fork=a('opening-fork');fork.disabled=!!h||m.state!=='ready';fork.checked=openingFork;syncRouteBudget();syncStepInspector();let r=L(),t=r.game,s=r.state==="running"&&!r.paused;
const locked=!!h||m.state!=="ready";
for(const [id,chosen] of [["classic-pack",!newPack],["water-pack",newPack]]){
 const button=a(id);button.disabled=locked;button.setAttribute("aria-pressed",String(chosen));
}
const cat=a("cat-tail");cat.disabled=newPack||!!h||m.state!=="ready";cat.checked=!newPack&&catTail;
a("tight-label").textContent="逐图 "+limits().join(" / ")+" 步挑战（开局前可切换）";
a("eel-rule").hidden=t.word.en!=="eel";
a("board").setAttribute("aria-describedby",t.word.en==="eel"?"board-state eel-rule":"board-state");
const stepNow=Math.min(t.cursor,t.word.en.length);
const wordHeading=`第 ${r.stage+1} 图 · ${wordOrder(t)} · ${t.word.zh} · 已收 ${stepNow}/${t.word.en.length}`;
a("current-word").textContent=wordHeading;
a("board").setAttribute("aria-label",`${wordHeading} 的逐格场地`);
k.displayLength=t.length,k.draw(t),a("page-title").textContent=h?`\u7B2C${h.stage+1}\u56FE \xB7 \u5355\u72EC\u7EC3\u4E60`:"\u4E09\u79CD\u8DEF\u7EBF \xB7 \u65E0\u4F24\u63A5\u529B",a("drill-banner").hidden=!h,a("formal-brief").hidden=!!h,a("drill-controls").hidden=!h,a("metrics").textContent=h?`\u5355\u56FE\u7EC3\u4E60 \xB7 ${roomName(h.stage)} \xB7 ${t.letters}/3\u5B57\u6BCD \xB7 \u5F53\u524D\u8DEF\u7EBF${t.steps}\u6B65 \xB7 \u5DF2\u9000\u56DE${h.undoCount}\u6B21 \xB7 \u5DF2\u56DE\u5C94\u8DEF${h.returnCount}\u6B21 \xB7 \u65E0\u6B65\u6570\u4E0A\u9650 \xB7 \u4E0D\u8BA1\u63A5\u529B\u6210\u7EE9`:`\u7B2C${m.stage+1}/3\u56FE \xB7 ${roomName(m.stage)} \xB7 \u672C\u56FE${t.letters}/3\u5B57\u6BCD \xB7 \u603B\u6B65\u6570${m.totalSteps}/${B} \xB7 \u8FD8\u5269${m.remaining}\u6B65`,a("tight-mode").disabled=m.state!=="ready"||!!h,a("tight-mode").checked=m.tight,a("reset").textContent=m.tight?"\u91CD\u5F00\u4E09\u56FE \xB7 \u4FDD\u7559\u9010\u56FE\u6311\u6218":"\u91CD\u5F00\u4E09\u56FE \xB7 \u4FDD\u7559\u5E38\u89C460\u6B65",a("formal-brief").textContent=m.tight?"逐图 "+limits().join(" / ")+" 步；顺序看盘面上方，不结转。":"三图合用 60 步；顺序看盘面上方。碰撞结束本轮。",!h&&m.tight&&(a("page-title").textContent="\u9010\u56FE\u7CBE\u70BC \xB7 \u8DEF\u7EBF\u6311\u6218",a("metrics").textContent=`\u7B2C${m.stage+1}/3\u56FE \xB7 ${roomName(m.stage)} \xB7 \u672C\u56FE${t.letters}/3\u5B57\u6BCD \xB7 \u672C\u56FE${t.steps}/${m.stageLimit}\u6B65 \xB7 \u5269${Math.max(0,m.stageLimit-t.steps)}\u6B65 \xB7 \u4E09\u56FE\u7D2F\u8BA1${m.totalSteps}\u6B65`),a("status").textContent=r.message;let e=a("tail-feedback");(r.paused||r.state!=="running"||v?.game!==t||v?.step!==t.steps)&&(v=null),e.textContent=v?.text||"",e.hidden=!v;let i=t.tiles.find(o=>o.id===t.cursor);a("board-state").textContent=`\u86C7\u5934\u7B2C${t.head.x+1}\u5217\u3001\u7B2C${t.head.y+1}\u884C\uFF0C\u671D${nt[t.direction]}\u3002${i?`\u4E0B\u4E2A\u5B57\u6BCD${numberedLabel(t,i)}\u5728\u7B2C${i.x+1}\u5217\u3001\u7B2C${i.y+1}\u884C\u3002`:"\u672C\u56FE\u5B57\u6BCD\u5DF2\u6536\u9F50\u3002"}`;for(let o of document.querySelectorAll("[data-direction]"))o.disabled=!s;a("retry-record").hidden=!!h||m.state!=="won",a("start").hidden=!!h||m.state!=="ready",a("next").hidden=!!h||m.state!=="between",a("pause").hidden=r.state!=="running",a("pause").textContent=h?h.paused?"\u7EE7\u7EED\u672C\u56FE\u7EC3\u4E60":"\u6682\u505C\u7EC3\u4E60":m.paused?"\u7EE7\u7EED\u63A5\u529B":"\u6682\u505C",a("drill-start").hidden=!!h||m.state!=="lost",a("drill-start").textContent=`\u53EA\u7EC3\u521A\u5931\u8D25\u7684\u7B2C${m.stage+1}\u56FE \xB7 ${roomName(m.stage)}`,a("drill-retry").hidden=!h||h.state==="running",a("drill-exit").hidden=!h,a("drill-redo").hidden=!h,a("drill-redo").disabled=!h||!h.canRedo,a("drill-undo").hidden=!h,a("drill-undo").disabled=!h||!h.canUndo,a("drill-bookmark").hidden=!h,a("drill-bookmark").disabled=!h||!h.canBookmark,a("drill-bookmark").textContent=h&&h.bookmark!==null?"\u6539\u8BB0\u5F53\u524D\u5C94\u8DEF":"\u8BB0\u4F4F\u5F53\u524D\u5C94\u8DEF",a("drill-return").hidden=!h,a("drill-return").disabled=!h||!h.canReturn,a("drill-return").textContent=h&&h.bookmark!==null?`\u56DE\u5230\u7B2C${h.bookmarkSteps}\u6B65\u5C94\u8DEF`:"\u56DE\u5230\u5DF2\u8BB0\u5C94\u8DEF",a("drill-summary").hidden=!h||h.state==="running",a("drill-result").textContent=h&&h.state!=="running"?`${h.state==="won"?"\u672C\u56FE\u7EC3\u4E60\u5B8C\u6210":"\u672C\u6B21\u7EC3\u4E60\u672A\u5B8C\u6210"}\uFF1A${t.letters}/3\u5B57\u6BCD\uFF0C\u5F53\u524D\u8DEF\u7EBF${t.steps}\u6B65\uFF0C\u5DF2\u9000\u56DE${h.undoCount}\u6B21\uFF0C\u5DF2\u56DE\u5C94\u8DEF${h.returnCount}\u6B21\u3002${t.route.pickups.length?t.route.pickups.map(o=>`${pickupLabel(o)}\uFF1A\u7B2C${o.step}\u6B65`).join("\uFF1B")+"\u3002":""}${h.collisionText}\u539F\u63A5\u529B\u7ED3\u679C\u672A\u6539\u3002`:"",a("results").replaceChildren();for(let o of m.results){let d=document.createElement("li");d.textContent=`\u7B2C${o.stage+1}\u56FE \xB7 ${o.name}\uFF1A${o.steps}\u6B65\uFF0C\u65E0\u78B0\u649E\u3002${o.pickups.map(n=>`${pickupLabel(n)}\uFF1A\u7B2C${n.step}\u6B65`).join("\uFF1B")}\u3002`,d.textContent+=tailRouteRecap(o),a("results").append(d)}a("summary").hidden=!!h||m.results.length===0;updateRouteRecord({finished:!h&&m.state==="won",tight:m.tight,fork:openingFork,cat:catTail,steps:m.totalSteps,results:m.results});syncReviewPracticeButton()}function S(){a("board").focus({preventScroll:!0})}function Q(r){if(document.hidden)return;let t=L(),s=t.game,e=s.tailRuleSerial||0,i=s.hits,old=s.steps,letters=s.letters,before={...s.head};v=null;let o=t.step(r),d=s.tailRuleReceipt;
if(s.hits!==i)tailWakes=[];
if(o&&s.steps>old&&s.hits===i){const kind=d?.serial>e?(d.kind==="tail-pass"?"tail":"pickup"):"move";addSnakeCue(s,kind,before);playWaterSound(s.letters>letters?"pickup":kind==="tail"?"tail":"move")}o&&s.hits===i&&d&&d.serial>e&&t.state==="running"&&(v={game:s,step:s.steps,text:d.kind==="tail-pass"?"\u521A\u624D\u7A7F\u8FC7\u65E7\u5C3E\u683C\uFF1A\u8FD9\u4E00\u6B65\u6CA1\u6709\u589E\u957F\uFF0C\u5C3E\u7AEF\u540C\u6B65\u817E\u5F00\u3002\u4E0D\u662F\u6240\u6709\u8EAB\u4F53\u683C\u90FD\u80FD\u7A7F\u3002":`${s.challenge==="eel-double-vowel"?"刚才取到 "+pickupLabel(s.route.pickups.at(-1))+"，":"刚才取字后"}\u8EAB\u4F53\u589E\u957F ${d.growth} \u683C\uFF1A\u8FD9\u4E00\u6B65\u65E7\u5C3E\u683C\u6CA1\u6709\u817E\u5F00\u3002`}),y()}for(let r of document.querySelectorAll("[data-direction]"))r.addEventListener("click",()=>{Q(Number(r.dataset.direction)),S()});document.addEventListener("keydown",r=>{if(r.repeat||r.isComposing||r.ctrlKey||r.metaKey||r.altKey||r.target?.isContentEditable||/^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(r.target?.tagName))return;if(r.key==="Escape"){L().pause()&&(silenceWaterSound(),r.preventDefault(),y());return}let t=rt[r.key.length===1?r.key.toLowerCase():r.key];t!==void 0&&(r.preventDefault(),Q(t))});a("start").addEventListener("click",()=>{document.hidden||h||(m.start(),y(),S())});a("next").addEventListener("click",()=>{document.hidden||h||(m.next()&&k.clear(),y(),S())});a("pause").addEventListener("click",()=>{if(document.hidden)return;let r=L();r.paused?r.resume():(r.pause(),silenceWaterSound()),y(),S()});a("reset").addEventListener("click",()=>{if(reviewReturn){a('session-options').open=reviewReturn.optionsOpen;reviewReturn=null}h=null,m.reset(),clearRouteReceipt(),k.clear(),y(),a("start").focus({preventScroll:!0})});a("retry-record").addEventListener("click",()=>{if(document.hidden||h||m.state!=="won")return;m.reset(),clearRouteReceipt(),k.clear(),m.start(),y(),S()});a('record-practice').addEventListener('click',beginReviewPractice);a("drill-start").addEventListener("click",()=>{document.hidden||h||m.state!=="lost"||(h=new R(m.stage),k.clear(),y(),S())});a("drill-retry").addEventListener("click",()=>{document.hidden||!h||h.state==="running"||(h=new R(h.stage),k.clear(),y(),S())});a("drill-undo").addEventListener("click",()=>{document.hidden||!h||!h.undo()||(k.clear(),y(),S())});a("drill-bookmark").addEventListener("click",()=>{document.hidden||!h||!h.saveBookmark()||(y(),S())});a("drill-return").addEventListener("click",()=>{document.hidden||!h||!h.returnToBookmark()||(k.clear(),y(),S())});a("drill-redo").addEventListener("click",()=>{document.hidden||!h||!h.redo()||(k.clear(),y(),S())});a("drill-exit").addEventListener("click",returnFromPractice);a("opening-fork").addEventListener("change",()=>{if(document.hidden||h||m.state!=="ready")return;openingFork=a("opening-fork").checked;m.reset();clearRouteReceipt();k.clear();y();});function selectPack(water){
 if(document.hidden||h||m.state!=="ready"||newPack===water)return;
 newPack=water;snakeCue=null;tailWakes=[];silenceWaterSound();syncWaterSound();m.reset();clearRouteReceipt();k.clear();y();
}
a("water-sound").checked=false;
syncWaterSound();
a("water-sound").addEventListener("change",changeWaterSound);
a("classic-pack").addEventListener("click",()=>selectPack(false));
a("water-pack").addEventListener("click",()=>selectPack(true));a("cat-tail").addEventListener("change",()=>{if(document.hidden||h||m.state!=="ready")return;catTail=a("cat-tail").checked;m.reset();clearRouteReceipt();k.clear();y();});a("tight-mode").addEventListener("change",()=>{document.hidden||h||(m.chooseTight(a("tight-mode").checked),y())});a("grid").addEventListener("change",()=>{k.logicGrid=a("grid").checked,k.key="",y()});var U=()=>{L().pause(),silenceWaterSound(),y()},D=()=>{let r=a("board").getBoundingClientRect();k.resize(r.width,r.height),y()},H=new ResizeObserver(D);H.observe(a("board"));window.addEventListener("blur",U);document.addEventListener("visibilitychange",()=>{document.hidden&&U()});window.addEventListener("pagehide",()=>{U(),H.disconnect()});window.addEventListener("pageshow",()=>{H.observe(a("board")),D()});D();
