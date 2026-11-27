// The second human gets the same tactical result as the first. Never credit CPU hits.
export function combatContactRead(event,mode,defenderName) {
  if(event?.type!=="hit" || (event.side!==0 && !(mode==="versus"&&event.side===1)))return "";
  const text=event.counter?"COUNTER · 破招":event.punish?"PUNISH · 抓住收招":"";
  return text && event.side===1 ? `${defenderName} · ${text}` : text;
}
