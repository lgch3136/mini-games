import {GAME_GUIDE,matchesGame,readRecent,saveRecent} from './arcade-catalog.mjs?v=20261008-r16';
const cards=[...document.querySelectorAll('.card[data-cat]')], filters=[...document.querySelectorAll('.filter')], paces=[...document.querySelectorAll('[data-pace]')];
const input=document.querySelector('#game-search'),count=document.querySelector('#catalog-count'),empty=document.querySelector('#catalog-empty');
const state={filter:'all',pace:'all',query:''};
let store;try{store=window.localStorage;}catch{}
// Resolve only catalog game entries under the document base; stored history is
// an ID and timestamp, while each current card owns its full navigation URL.
function gameLink(card){
 try{
  const base=new URL('.',document.baseURI),url=new URL(card.getAttribute('href'),document.baseURI);
  if(!/^https?:$/.test(url.protocol)||url.origin!==window.location.origin||url.username||url.password||base.origin!==url.origin||!url.pathname.startsWith(base.pathname))return null;
  const match=url.pathname.slice(base.pathname.length).match(/^([^/]+)(?:\/(?:index\.html)?)?$/),id=match?.[1];
  return Object.hasOwn(GAME_GUIDE,id)?{id,href:url.href}:null;
 }catch{return null;}
}
for(const card of cards){
 const id=gameLink(card)?.id,guide=GAME_GUIDE[id];
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
function showRecent(){const recent=readRecent(store),link=document.querySelector('#recent-game'),game=recent&&cards.map(gameLink).find(game=>game?.id===recent.id);if(!game){link.hidden=true;link.removeAttribute('href');return;}link.href=game.href;link.querySelector('strong').textContent=GAME_GUIDE[recent.id].label;link.hidden=false;}
window.addEventListener('pageshow',showRecent);showRecent();apply();

