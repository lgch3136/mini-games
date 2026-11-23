const descriptions = {
  lin:"凌风站定会分掌发波。越过波后，留意他收掌的空档。",
  mei:"赤绫先撤半步蓄势，再用飞燕两段追身。两脚落空或挡完第二脚，都留有反击的空档。",
  shan:"铁岳张掌压近会使山岳崩，跳开或撤步可让他抓空。隔一步见他压低重心，要防扫堂腿。"
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
