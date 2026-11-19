"use strict";(function(c){function s(l,i={}){const e=l?.hook,t=e?.grabbed;if(!l?.lightHaul||i.blocked||l.state!=="playing"||l.timeLeft<=0||l.contractTimer>0||!e||e.state!=="retract"||!t||!t.grabbed||t.lightHaul||!["gold","diamond","rock"].includes(t.kind)||!l.items.includes(t))return null;const n=i.mineral?.amount;if(![n,t.weight,e.len,e.speed,i.retractMul,l.strength].every(Number.isFinite)||n<=0||t.weight<=0||e.len<=46||e.speed<=0||i.retractMul<=0)return null;const r=e.speed/t.weight*i.retractMul*(1+l.strength*.2);if(!(r>0))return null;const d=Math.ceil((e.len-46)/r*60-1e-9)/60,o=Math.ceil((e.len-46)/(r*2)*60-1e-9)/60;return{item:t,originalValue:n,value:Math.floor(n*.6),weight:t.weight*.5,beforeSeconds:d,afterSeconds:o,late:l.timeLeft<=o+1e-8}}// This is a view only. Delivery settlement and timing remain engine-owned.
function arrivesBeforeTimer(run, quotedSeconds, weight, retractMul) {
  const step = 1 / 60;
  if (Math.abs(run.timeLeft - quotedSeconds) > step + 1e-8 || !Number.isFinite(retractMul)) return run.timeLeft > quotedSeconds + 1e-8;
  // Near a frame boundary, mirror the actual game's time-first and subtractive
  // rope stepping. Decimal closed-form quotes can differ by one frame here.
  const delta = run.hook.speed * (1 / weight * retractMul * (1 + run.strength * .2)) * step;
  if (!(delta > 0)) return false;
  let left = run.timeLeft, length = run.hook.len;
  for (let f = 0; f <= Math.min(600, Math.ceil(quotedSeconds / step) + 2); f++) {
    if ((left -= step) <= 0) return false;
    if ((length -= delta) <= 46) return true;
  }
  return false;
}
function decision(run, quote, retractMul) {
  if (!quote || !Number.isFinite(run.quota) || !Number.isFinite(run.treasureEarned)) return null;
  const gap = Math.max(0, run.quota - run.treasureEarned);
  const normalLate = !arrivesBeforeTimer(run, quote.beforeSeconds, quote.item.weight, retractMul);
  const fastLate = !arrivesBeforeTimer(run, quote.afterSeconds, quote.weight, retractMul);
  const seconds = Math.ceil(quote.afterSeconds * 10 - 1e-8) / 10;
  const choice = `C 留+${quote.value} · 约${seconds.toFixed(1)}秒`;
  if (fastLate) return {key:"light-both-late",text:`${choice}，仍可能超时`,announcement:"原速和减重回收都可能超时，未送达不结算。"};
  if (normalLate) {
    const quotaReached = gap > 0 && quote.value >= gap;
    const quotaMiss = gap > quote.value;
    const quota = quotaReached ? "可补足矿收" : quotaMiss ? `还差${gap - quote.value}矿收` : "";
    return {key:`light-rescue-${quotaReached ? "quota" : quotaMiss ? "partial" : "already"}`,text:`${choice} · 预计赶得上${quota ? " · "+quota : ""}`,announcement:`${choice}，预计赶得上，原速则有超时风险。${quotaReached ? "送达可补足矿收，不代表拼词已完成。" : quotaMiss ? "送达仍不能补足矿收。" : ""}`};
  }
  if (gap > quote.value && gap <= quote.originalValue) return {key:"light-keep-quota",text:`${choice} · 保留原值才补足矿收`,announcement:"两种回收方式目前都预计赶得上。保留原值才能用这一钩补足矿收。"};
  return {key:"light-open",text:choice,announcement:""};
}
const u=Object.freeze({quote:s,decision});typeof module<"u"&&module.exports?module.exports=u:c.MinerLightHaul=u})(typeof globalThis>"u"?this:globalThis);
