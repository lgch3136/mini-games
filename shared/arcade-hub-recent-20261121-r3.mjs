import {matchesGame} from './arcade-catalog.mjs?v=20261008-r16';
import {GAME_GUIDE,collectEntries,readRecent,saveRecent} from './arcade-recent-20261119-r2.mjs';
const cards=[...document.querySelectorAll('.card[data-cat],#fogharbor-playtest[data-cat]')], filters=[...document.querySelectorAll('.filter')], paces=[...document.querySelectorAll('[data-pace]')];
const input=document.querySelector('#game-search'),count=document.querySelector('#catalog-count'),empty=document.querySelector('#catalog-empty');
const state={filter:'all',pace:'all',query:''};
let store;try{store=window.localStorage;}catch{}
const entries=collectEntries(document);
for(const card of cards){
 const id=card.closest('[data-game-id]')?.dataset.gameId,guide=GAME_GUIDE[id];
 if(!guide)continue;
 card.dataset.session=guide.session;
 const art=card.querySelector('.art');
 if(art){const tag=document.createElement('span');tag.className='control-chip';tag.textContent=guide.style;art.append(tag);}
}
for(const entry of entries){
 const remember=event=>{if(event.type==='auxclick'&&event.button!==1)return;saveRecent(store,entry);showRecent();};
 entry.anchor.addEventListener('click',remember);
 entry.anchor.addEventListener('auxclick',remember);
}
function apply(){
 let visible=0;
 for(const card of cards){const show=matchesGame({category:card.dataset.cat,session:card.dataset.session,text:card.textContent+' '+(card.dataset.searchAlias||'')},state);card.classList.toggle('hidden',!show);if(show)visible++;}
 document.querySelector('.more-card')?.classList.toggle('hidden',state.filter!=='all'||state.pace!=='all'||!!state.query);
 count.textContent=`${visible} 款游戏`;empty.hidden=visible!==0;
}
filters.forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter;filters.forEach(b=>{const on=b===btn;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});apply();}));
paces.forEach(btn=>btn.addEventListener('click',()=>{state.pace=btn.dataset.pace;paces.forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));apply();}));
input.addEventListener('input',()=>{state.query=input.value;apply();});
document.querySelector('#clear-search').addEventListener('click',()=>{input.value='';state.query='';state.filter='all';state.pace='all';filters.forEach(b=>{const on=b.dataset.filter==='all';b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});paces.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pace==='all')));apply();input.focus();});
export function recentTitle(label,version){
 const divider=' · ';
 if(version===label||version.startsWith(label+divider))return version;
 return label+divider+version;
}
function showRecent(){
 const game=readRecent(store,entries),link=document.querySelector('#recent-game');
 if(!game){link.hidden=true;link.removeAttribute('href');link.removeAttribute('title');return;}
 link.href=game.href;link.querySelector('strong').textContent=recentTitle(GAME_GUIDE[game.id].label,game.version);
 link.title='返回上次打开的同一版本：'+game.version;link.hidden=false;
}
window.addEventListener('pageshow',showRecent);
window.addEventListener('storage',event=>{if(event.key==='arcade.recent.v1'||event.key===null)showRecent();});
showRecent();apply();
