import {Fight,ROSTER,MOVES,moveFor} from './original/combat.mjs';
export const IDENTITIES=Object.freeze(['lin','mei']);
export const SCENE='harbor-hall-native';
export const MOVE_NAMES=Object.freeze(Object.keys(MOVES));
export const SOURCE=Object.freeze({entry:'english-word-fury/index.html',entryBlob:'9ef1a30b15272ba7fe62cfe1f1d744c5b8c4842c',combatBlob:'7557ba7c8857c36b9b00b68e07989b85e1501628'});
export function createDuelSession({mode='arcade',difficulty='normal',seed=7181}={}){
 if(!['arcade','versus'].includes(mode)||!['easy','normal','hard'].includes(difficulty))throw new RangeError('unsupported native duel mode');
 let hero=null,game=null,matchId=0;
 const pair=()=>({hero:ROSTER.findIndex(x=>x.id===hero),enemy:ROSTER.findIndex(x=>x.id===IDENTITIES.find(x=>x!==hero))});
 function mount(){game?.clearInputs();game=new Fight({...pair(),mode,difficulty,seed});matchId++;return game;}
 return {
   select(id){if(game)return false;if(!IDENTITIES.includes(id))return false;hero=id;return true;},
   start(){if(!hero||game)return false;return mount()},
   input(...args){if(game&&(game.state==='fight'||game.state==='intro'))game.input(...args);},
   step(){game?.step();return game?.events??[]},
   clearInput(){game?.clearInputs()},
   returnToSelect(){game?.clearInputs();game=null;hero=null;},
   rematch(){if(game?.state!=='done')return false;return mount()},
   get game(){return game},
   get matchId(){return matchId},
   get matchPairs(){return game?.f.map(f=>f.c.id)??[]},
   get canRematch(){return game?.state==='done'},
 };
}
const locomotion=['idle/0','idle/1','idle/2',...['walkForward','walkBack','run'].flatMap(m=>Array.from({length:12},(_,i)=>m+'/'+i)),
 ...['F','B'].flatMap(p=>['catch','settle'].map(z=>'stop/'+p+'/'+z)),'backstep/load','backstep/travel','backstep/settle','roll/load','roll/travel','roll/settle','crouch/hold','guard/hold','guard/crouch'];
const common=['jump/rise','jump/apex','jump/descent','land/compress','land/release','tech/impact','tech/release',
 'hit/impact','hit/release','hit/air-rise','hit/air-descent','block/impact','block/release','block/crouch-impact','block/crouch-release',
 'break/impact','break/release','break/crouch-impact','break/crouch-release','down/rise','down/descent','down/contact','down/ground','rise/start','rise/recover',
 'ko/rise','ko/descent','ko/contact','ko/seated'];
const attack=MOVE_NAMES.flatMap(k=>['load','commit','active','return','settle'].map(p=>k+'/'+p));
export const REQUIRED=Object.freeze(Object.fromEntries(IDENTITIES.map(id=>[id,Object.freeze([...new Set([...locomotion,...common,...attack,...(id==='lin'?['punch/return/whiff','punch/return/whiff-late']:['kick/return/late'])])])])));
const criticalAttack=new Set(['jab','punch','kick','lowKick','sweep','overhead']);
export function allowedAlias(id,key,use){
 if(!IDENTITIES.includes(id)||key===use)return false;
 // Adjacent phases of the same gait direction may use one held drawing.
 const r=/^(walkForward|walkBack|run)\/(\d+)$/.exec(key);
 if(r)return +r[2]%2===1&&use===r[1]+'/'+(Number(r[2])-1);
 const [move,phase,...more]=key.split('/');
 // No aliases for core attack reads or the owner's V5 fitted bridges.
 return !more.length&&MOVE_NAMES.includes(move)&&!criticalAttack.has(move)&&
  (phase==='commit'&&use===move+'/load'||phase==='settle'&&use===move+'/return');
}
export function authoredInventory(id){
 const aliases={};
 for(const key of REQUIRED[id]){
  const target=REQUIRED[id].find(k=>allowedAlias(id,key,k));
  if(target)aliases[key]=target;
 }
 return {direct:REQUIRED[id].filter(x=>!aliases[x]),aliases};
}
const hex=/^[0-9a-f]{64}$/i;
// Keep proven sole anchoring a bounded, auditable render correction. No
// dynamic target dependence, world-coordinate writes or generic visual shift.
const floorCaps=new Set(['airPunch/load','airPunch/active','airPunch/return','ko/rise','ko/descent']);
const floorHolds=new Set(['down/contact','ko/contact','ko/seated']);
export function approvedAnchor(key, anchor){
 if(anchor===undefined)return true;
 if(!anchor||Object.keys(anchor).some(k=>!['mode','sole'].includes(k)))return false;
 if(anchor.mode==='floor-hold')return floorHolds.has(key)&&anchor.sole===undefined;
 return anchor.mode==='floor-cap'&&floorCaps.has(key)&&Number.isInteger(anchor.sole)&&anchor.sole>=0&&anchor.sole<=32;
}
export function auditArt(raw,images=new Map()){
 const issues=[],cels={};
 if(raw?.format!=='fury-full-native-v5-1')issues.push('Manifest has not been approved for full native motion');
 if(raw?.scene?.id!==SCENE)issues.push('Missing or mismatched authored arena binding');
 const uses=new Map(),sceneSheet=images.get(raw?.scene?.sheet);
 if(!sceneSheet||!hex.test(sceneSheet.sha256??'')||sceneSheet.sha256!==raw?.scene?.sha256)issues.push('Missing or unverified authored arena image');
 const inspect=(part,id,ids)=>{
  const sheet=images.get(part?.sheet);
  const [x,y,w,h]=part?.from??[];
  const bounds=part?.to,mat=part?.matrix;
  if(!sheet||sheet.identity!==id||!hex.test(sheet.sha256??'')||sheet.sha256!==raw?.sheets?.[part?.sheet]?.sha256||![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<1||h<1||x+w>sheet.width||y+h>sheet.height)return false;
  if(mat===undefined?(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[2]<=0||bounds[3]<=0):
    (!Array.isArray(mat)||mat.length!==6||!mat.every(Number.isFinite)||Math.abs(mat[0]*mat[3]-mat[1]*mat[2])<1e-8))return false;
  const was=uses.get(sheet.sha256);if(was&&was!==id)return false;
  uses.set(sheet.sha256,id);ids.add(part.sheet);return true;
 };
 for(const id of IDENTITIES){
  const fighter=raw?.fighters?.[id];
  cels[id]={};
  if(!fighter||fighter.id!==id||fighter.identity!==id+'-v5-authored')issues.push(id+': authored V5 identity is not attested');
  const rawCels=fighter?.cels??{}, valid=(q,k)=>q?.id===id&&q.key===k&&q.acceptance==='native-approved';
  const decoded=new Map();
  for(const key of REQUIRED[id]){
   const q=rawCels[key], ids=new Set();
   if(valid(q,key)&&!q.use&&approvedAnchor(key,q.anchor)&&Array.isArray(q.parts)&&q.parts.length&&Array.isArray(q.mirroredParts)&&q.mirroredParts.length&&
     [...q.parts,...q.mirroredParts].every(p=>inspect(p,id,ids)))decoded.set(key,q);
  }
  for(const key of REQUIRED[id]){
   const q=rawCels[key],direct=decoded.get(key);
   if(direct){cels[id][key]=direct;continue}
   if(valid(q,key)&&q.anchor===undefined&&q.reason==='equivalent-native-pose'&&allowedAlias(id,key,q.use)&&decoded.has(q.use)){
    cels[id][key]={...decoded.get(q.use),key,sourceKey:q.use};continue;
   }
   issues.push(id+':'+key);
  }
 }
 return {ready:issues.length===0,issues,cels};
}
export function moveManifest(){
 return Object.fromEntries(IDENTITIES.map(id=>[id,Object.fromEntries(MOVE_NAMES.map(name=>{
  const m=moveFor({id:ROSTER.findIndex(c=>c.id===id)},name);
  return [name,{name:m.name,level:m.level,startup:m.startup,active:m.active,recovery:m.recovery,hitFrames:m.hitFrames??null,pose:m.pose,projectile:!!m.projectile,down:!!m.down,cancel:m.cancel??[]}];
 }))]));
}
