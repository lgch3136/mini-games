'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MinerCastBudget=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const duration=(distance,speed,step)=>Math.max(1,Math.ceil(Math.max(0,distance)/speed/step-1e-9))*step;
  const tenth=n=>(Math.ceil(Math.max(0,n)*10-1e-8)/10).toFixed(1);
  // Presentation only. Contact must come from the same ray used by the aim guide.
  // Capture takes one shoot tick; delivery starts on the next retract tick.
  function view(game,options={}) {
    const h=game?.hook,c=options.contact,it=c?.item,step=options.step;
    if(options.enabled===false||!game||game.state!=='playing'||game.timeLeft<=0||game.contractTimer>0||game.feedbackUntil>0||!game.word||
      !h||h.state!=='swing'||!it||it.grabbed||game.word.progress>=game.word.en.length&&game.treasureEarned>=game.quota)return null;
    const speed=h.speed/it.weight*options.retractMul*(1+game.strength*.2);
    if(![h.len,h.speed,h.maxLen,c.distance,it.weight,step,speed,game.timeLeft].every(Number.isFinite)||
      h.len!==46||h.speed<=0||it.weight<=0||step<=0||speed<=0||c.distance<46||c.distance>h.maxLen)return null;
    const outboundSeconds=duration(c.distance-h.len,h.speed,step);
    const returnSeconds=duration(c.distance-46,speed,step);
    const seconds=outboundSeconds+returnSeconds;
    // Deadline is tested BEFORE movement. Reserve one additional simulation tick
    // so floating-point boundaries cannot make an impossible delivery look safe.
    // A warning is conservative; it does not assert failure is guaranteed.
    const urgency=game.timeLeft<=seconds+step+1e-8?'late':game.timeLeft-seconds<=2?'tight':'normal';
    const mineral=options.mineral;
    const wrongLetter=it.kind==='letter'&&it.index!==game.word.progress;
    const name=it.kind==='letter'?`字母 ${it.letter}`:mineral?mineral.name:it.kind==='bomb'?'炸弹':'物品';
    const consequence=it.kind==='letter'?(wrongLetter?'错序会放回，字母不可炸':'字母不可炸'):mineral?`送达 +${mineral.amount}矿收`:it.kind==='bomb'?`送达扣${Math.min(100,Math.max(0,game.score))}分`:'送达后结算';
    const warning=urgency==='late'?' · 有超时风险':urgency==='tight'?' · 时间紧':'';
    return {item:it,seconds,outboundSeconds,returnSeconds,urgency,wrongLetter,
      reference:`圈选${name} · 现在出钩约${tenth(seconds)}秒送达${warning} · ${consequence}`,
      announcement:urgency==='late'?`现在出钩抓${name}约需${tenth(seconds)}秒送达，有超时风险。只有送达才结算，精准加时不能救回此前的超时。${it.kind==='letter'?'字母抓住后不可炸毁。':''}`:urgency==='tight'?`现在出钩抓${name}送达时间紧，约需${tenth(seconds)}秒。`:''};
  }
  return Object.freeze({view});
});
