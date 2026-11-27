// Draw a grounded KO in front of an inactive winner after the exchange has ended.
// Never change simulation positions, shadows, or ordering while a round is live.
export function groundedKoLayer(fightState, subject, opponent, previousLayer) {
  if ((fightState !== 'roundEnd' && fightState !== 'done') ||
      subject.hp > 0 || subject.y !== 0 || subject.py !== 0 ||
      subject.down > 20 || !opponent || opponent.hp <= 0 ||
      opponent.action || opponent.y !== 0) return previousLayer;
  return 4;
}
