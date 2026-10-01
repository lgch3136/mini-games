import {GAME_GUIDE,matchesGame,readRecent,saveRecent} from './arcade-catalog.mjs?mobile=20260930-quality-r2';
const cards=[...document.querySelectorAll('.card[data-cat]')], filters=[...document.querySelectorAll('.filter')], paces=[...document.querySelectorAll('[data-pace]')];
const input=document.querySelector('#game-search'),count=document.querySelector('#catalog-count'),empty=document.querySelector('#catalog-empty');
const state={filter:'all',pace:'all',query:''};
let store;try{store=window.localStorage;}catch{}
for(const card of cards){
 const id=card.getAttribute('href').split('/')[0],guide=GAME_GUIDE[id];
 if(!guide)continue;
 card.dataset.session=guide.session;
 const tag=document.createElement('span');tag.className='control-chip';tag.textContent=guide.style;card.querySelector('.art').append(tag);
 card.addEventListener('click',()=>saveRecent(store,id));
}
function apply(){
 let visible=0;
 for(const card of cards){const show=matchesGame({category:card.dataset.cat,session:card.dataset.session,text:card.textContent},state);card.classList.toggle('hidden',!show);if(show)visible++;}
 document.querySelector('.more-card')?.classList.toggle('hidden',state.filter!=='all'||state.pace!=='all'||!!state.query);
 count.textContent=`${visible} 款游戏`;empty.hidden=visible!==0;
}
filters.forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter;filters.forEach(b=>{const on=b===btn;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});apply();}));
paces.forEach(btn=>btn.addEventListener('click',()=>{state.pace=btn.dataset.pace;paces.forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));apply();}));
input.addEventListener('input',()=>{state.query=input.value;apply();});
document.querySelector('#clear-search').addEventListener('click',()=>{input.value='';state.query='';state.filter='all';state.pace='all';filters.forEach(b=>{const on=b.dataset.filter==='all';b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});paces.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pace==='all')));apply();input.focus();});
function showRecent(){const recent=readRecent(store),link=document.querySelector('#recent-game');if(!recent){link.hidden=true;return;}link.href=`${recent.id}/index.html?v=20260930-quality-r2`;link.querySelector('strong').textContent=GAME_GUIDE[recent.id].label;link.hidden=false;}
window.addEventListener('pageshow',showRecent);showRecent();apply();
