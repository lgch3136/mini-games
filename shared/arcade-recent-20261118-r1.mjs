import {GAME_GUIDE as originalGuide} from './arcade-catalog.mjs?v=20261008-r16';
export const GAME_GUIDE=Object.freeze({...originalGuide,
 'anime-crossroads':{label:'次元交锋',style:'单机5v5',session:'immersive'},
 'fogharbor-lamplighter':{label:'雾港守灯人',style:'走位守灯',session:'quick'},
});
// Only links actually offered in an explicitly identified game group may be resumed.
// Keep the full version URL: another candidate can have a separate save namespace.
export function safeHref(raw,baseURI){
 try{
  if(typeof raw!=='string'||!raw.trim())return null;
  const base=new URL('.',baseURI),url=new URL(raw,baseURI);
  if(!/^https?:$/.test(url.protocol)||url.origin!==base.origin||url.username||url.password||!url.pathname.startsWith(base.pathname))return null;
  if(url.pathname===base.pathname||!/(?:\.html|\/)$/.test(url.pathname))return null;
  return url.href;
 }catch{return null;}
}
export function collectEntries(doc){
 const entries=[];
 for(const group of doc.querySelectorAll('[data-game-id]')){
  const id=group.dataset.gameId;if(!Object.hasOwn(GAME_GUIDE,id))continue;
  for(const anchor of group.querySelectorAll('a.card[href],a.latest-version-link[href],a.emberwild-qa-link[href]')){
   const href=safeHref(anchor.getAttribute('href'),doc.baseURI);if(!href)continue;
   const primary=anchor.matches('.card')||(!group.querySelector('a.card')&&!entries.some(e=>e.id===id));
   const heading=anchor.querySelector('strong'),subtitle=heading?.nextElementSibling;
   const description=subtitle?.tagName==='SPAN'?heading.textContent+' · '+subtitle.textContent:heading?.textContent||anchor.textContent||'独立版本';
   const version=anchor.matches('.card')?'主卡版本':description.trim().replace(/\s+/g,' ').slice(0,64);
   entries.push({id,href,version,primary,anchor});
  }
 }
 return entries;
}
export function readRecent(storage,entries){
 try{
  const v=JSON.parse(storage.getItem('arcade.recent.v1')||'null');
  if(!v||!Object.hasOwn(GAME_GUIDE,v.id)||!Number.isFinite(v.at))return null;
  // Upgrade legacy ID-only history to its main card, but never silently migrate
  // a known candidate URL to a different version if that candidate disappears.
  if(Object.hasOwn(v,'href'))return entries.find(e=>e.id===v.id&&e.href===v.href)||null;
  return entries.find(e=>e.id===v.id&&e.primary)||null;
 }catch{return null;}
}
export function saveRecent(storage,entry,at=Date.now()){
 if(!entry||!Object.hasOwn(GAME_GUIDE,entry.id)||typeof entry.href!=='string'||!Number.isFinite(at))return false;
 try{storage.setItem('arcade.recent.v1',JSON.stringify({id:entry.id,href:entry.href,at}));return true;}catch{return false;}
}
