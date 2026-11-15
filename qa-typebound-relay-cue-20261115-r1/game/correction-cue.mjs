// Presentation-only recovery state. The simulator owns input, scoring and time.
const keyName = key => key === ' ' ? '空格' : key.toUpperCase();
export class CorrectionCue {
  constructor() { this.clear(); }
  clear() { this.pending = null; }
  event(event, game) {
    if (event.type === 'wrong' && game?.phase === 'combat') {
      this.pending = {
        game, roomId: game.roomId, wordId: game.wordId, cursor: game.cursor,
        wrong: event.char, expected: event.expected,
      };
    } else if (['letter', 'erase', 'word', 'enter', 'victory', 'defeat', 'practiceComplete'].includes(event.type)) {
      this.clear();
    }
  }
  text(game) {
    const p = this.pending;
    if (!p || p.game !== game || game?.phase !== 'combat' ||
        p.roomId !== game.roomId || p.wordId !== game.wordId ||
        p.cursor !== game.cursor || p.expected !== game.expected) return '';
    return `按了 ${keyName(p.wrong)}，需要 ${keyName(p.expected)} · 直接重打，无需退格`;
  }
}
