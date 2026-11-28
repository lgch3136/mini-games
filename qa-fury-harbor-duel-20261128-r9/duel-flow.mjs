export function duelRival(hero) {
  return hero === 1 ? 0 : 1;
}
export const arenaMode = mode => mode === "duel" ? "arcade" : mode;
export function duelResult(wins, winner, names) {
  const tip = winner === 0 ? "重赛试一次不同的起手：先让对手挥空，再迈进反击。" : "下一场不抢第一拍：先站在脚尖外，等对手收招再进。";
  return { title: winner === -1 ? "平局" : `${names[winner]}拿下对决`, score: wins.join(" : "), next: "重赛 · 同一对手", tip };
}
