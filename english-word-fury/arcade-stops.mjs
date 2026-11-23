const descriptions = {
  lin:"凌风分掌后会发波，近身时留意他收回前掌的空档。",
  mei:"赤绫先提膝再伸腿；贴身挡住第一下时，留意紧随其后的远踢。",
  shan:"铁岳贴近时能擒投。看见扫腿落空，可以在他收回支撑脚时抢拳。"
};
export function arcadeStop(ladder) {
  const final=ladder%2===1;
  return {final,venue:final?"夜渡码头":"港城会馆",bout:final?"决赛":"初擂"};
}
export function arcadeResult(ladder,won,hero,enemy,roster) {
  const stop=arcadeStop(ladder);
  if(!won) return {title:"再读一次对手。",next:"再战"+roster[enemy].name,read:descriptions[roster[enemy].id]};
  if(stop.final) return {title:"两馆夺魁",next:"开启下一轮",read:roster[hero].name+"已击败本轮两位擂主。"};
  let next=(enemy+1)%roster.length;
  if(next===hero)next=(next+1)%roster.length;
  return {title:"港城初擂胜出",next:"前往夜渡决赛",read:"下一场对手是"+roster[next].name+"。"+descriptions[roster[next].id]};
}
