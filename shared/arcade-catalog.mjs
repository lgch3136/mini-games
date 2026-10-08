export const GAME_GUIDE = Object.freeze({
 'emberwild-test-v4': {label:'余烬旷野',style:'探索与挥剑',session:'immersive',href:'emberwild-test-v4/?v=20261008-r13'},
 'english-typebound': {label:'键旅',style:'专注打字',session:'focus'},
 'english-echo-ring': {label:'回响边界',style:'双手闪避',session:'quick'},
 'english-apex-drive': {label:'团团卡丁',style:'横屏漂移',session:'immersive'},
 'english-signal-strike': {label:'零界突围',style:'双摇杆射击',session:'immersive'},
 'english-moonblade': {label:'月影忍途',style:'横屏动作',session:'immersive'},
 'english-word-ranger': {label:'单词突击队',style:'横屏动作',session:'immersive'},
 'english-word-fury': {label:'单词斗魂',style:'横屏格斗',session:'immersive'},
 'english-word-bomber': {label:'英语炸弹人',style:'走位策略',session:'quick'},
 'english-word-miner': {label:'英语挖金子',style:'单指抓钩',session:'quick'},
 'english-word-breaker': {label:'英语打砖块',style:'单指滑动',session:'quick'},
 'english-thunder-fighter': {label:'雷霆战机',style:'单指移动',session:'quick'},
 'english-word-snake': {label:'贪吃蛇背单词',style:'滑动转向',session:'quick'},
 'english-flappy-word': {label:'飞鸟背单词',style:'单指点按',session:'quick'},
 'english-temple-dash': {label:'遗迹词途',style:'按拍跳闪',session:'focus'},
 'english-word-beat': {label:'英语节奏大师',style:'多指节奏',session:'focus'},
});
export function normalizeQuery(value) { return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase(); }
export function matchesGame({category, session, text}, {filter='all', pace='all', query=''}={}) {
 const terms=normalizeQuery(query).split(/\s+/).filter(Boolean),hay=normalizeQuery(text);
 return (filter==='all'||category===filter)&&(pace==='all'||session===pace)&&terms.every(t=>hay.includes(t));
}
export function readRecent(storage) {
 try { const v=JSON.parse(storage.getItem('arcade.recent.v1')||'null'); return v&&Object.hasOwn(GAME_GUIDE,v.id)&&Number.isFinite(v.at)?{id:v.id,at:v.at}:null; } catch {return null;}
}
export function saveRecent(storage,id,at=Date.now()) {
 if(!Object.hasOwn(GAME_GUIDE,id)||!Number.isFinite(at))return false;
 try {storage.setItem('arcade.recent.v1',JSON.stringify({id,at}));return true;}catch{return false;}
}

