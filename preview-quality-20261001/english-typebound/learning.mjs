import { PASSAGES } from './content.mjs?v=20260918-play-r1&quality4=20261002-story-r1&mobile=20261002-quality4-r1';
const functionWords=new Set(['a','an','the','and','at','by','in','on','of','to','we','you','us','is','its','can','let']);
export function chapterPage(level,depth){
 const pages=PASSAGES.filter(p=>p.level===level),index=Math.floor(depth/3)%3;
 const page=pages[index%pages.length];return {...page,words:page.en.split(' ')};
}
export function pageEntries(page,lookup){
 const words=[...new Set(page.words.filter(w=>w.length>=3&&!functionWords.has(w)))];
 return words.map(en=>({en,zh:lookup.get(en)||'这一页中的词'}));
}
export function reviewPlan(targets,lexicon,lookup){
 const chosen=targets.slice(0,2),pool=[...lexicon,...PASSAGES.filter(p=>p.level==='easy').flatMap(p=>p.en.split(' ').map(en=>({en,zh:lookup.get(en)||'书页中的词'})))];
 const plan=[];
 for(const target of chosen){
  const seen=new Set([target.en]),spacers=[];
  for(const item of pool)if(item.en.length>=3&&!seen.has(item.en)){seen.add(item.en);spacers.push(item);if(spacers.length===2)break;}
  if(spacers.length<2)throw new Error('回练至少需要两个不同的间隔词');
  const model=(word)=>({word:{en:word.en,zh:word.zh},kind:'model',role:word.en===target.en?'model':'spacer'});
  const recall=()=>({word:{en:target.en,zh:target.zh},kind:'recall',context:'写回刚才示范过的单词'});
  plan.push(model(target),...spacers.map(model),recall(),...spacers.map(model),recall());
 }
 return plan;
}
export function interveningWords(sequence,en){
 let at=sequence.length-1;while(at>=0&&sequence[at].en!==en)at--;
 return [...new Set(sequence.slice(at+1).map(v=>v.en).filter(w=>w!==en))];
}
export function recallClassification(prompt){
 return prompt.revealed?'hinted':prompt.failedSubmission?'self-corrected':'retrieved';
}
export function reviewRecord(entry={}){
 return {
  en:entry.en,zh:entry.zh,misses:Math.min(999,Math.max(1,Number(entry.misses)||1)),
  evidenceVersion:2,
  modelCompletions:Math.max(0,Number(entry.modelCompletions) || Number(entry.clean) || 0),
  hintedCompletions:Math.max(0,Number(entry.hintedCompletions)||0),
  retrievalStreak:entry.evidenceVersion===2?Math.min(2,Math.max(0,Number(entry.retrievalStreak)||0)):0,
  independentRetrievals:entry.evidenceVersion===2?Math.max(0,Number(entry.independentRetrievals)||0):0,
 };
}
export function applyReviewEvent(records,event,word){
 const en=event.en||word?.en,zh=event.zh||word?.zh;if(!en)return;
 if(event.type==='wrong'||event.type==='recallFailed'){
  const prior=records.get(en),item=reviewRecord(prior||{en,zh,misses:1});if(prior)item.misses=Math.min(999,item.misses+1);item.retrievalStreak=0;records.set(en,item);
 }else if((event.type==='word'||event.type==='studyComplete')&&records.has(en)){
  const item=reviewRecord(records.get(en)),kind=event.studyKind||event.kind||'model';
  if(kind==='model')item.modelCompletions++;
  if(kind==='hinted')item.hintedCompletions++;
  if(kind==='retrieved'&&event.independent&&new Set(event.spacers||[]).size>=2){item.retrievalStreak=Math.min(2,item.retrievalStreak+1);item.independentRetrievals++;}
  if(item.retrievalStreak>=2)records.delete(en);else records.set(en,item);
 }
 if(records.size>300)records.delete(records.keys().next().value);
}
