import { SnakeGame, MAX_LENGTH } from './engine.mjs?v=20261102-grammar-context-r1';

export const WORD_ORDER_CHALLENGE = 'two-word-order-r1';
export const WORDS = Object.freeze({
  cat: Object.freeze({ en: 'cat', zh: '猫' }),
  dog: Object.freeze({ en: 'dog', zh: '狗' }),
});
const BOARD = Object.freeze([
  ['cat', 0, 6, 5], ['cat', 1, 6, 3], ['cat', 2, 11, 3],
  ['dog', 0, 10, 8], ['dog', 1, 12, 8], ['dog', 2, 12, 5],
]);

// Only selection and authored starting data are new. Movement, tail-cell
// collision, per-letter growth, completion shrinkage, HP and boost are inherited.
export class WordOrderGame extends SnakeGame {
  constructor() {
    super({ cols: 16, rows: 12, arena: 'classic', speed: 0,
      mode: 'spell', words: Object.values(WORDS), seed: 17 });
    const trail = [[7,6],[6,6],[5,6],[4,6],[4,5],[4,4],[5,4],[6,4],[7,4]];
    // Historical (not active) tail continues the final eastward tangent.
    for (let x = 8; trail.length < MAX_LENGTH + 3; x++) trail.push([x,4]);
    Object.assign(this, {
      challenge: WORD_ORDER_CHALLENGE, wordGoal: 2,
      head: { x: 7, y: 6 }, length: 9,
      trail: trail.map(([x,y]) => ({x,y})),
    });
    this.pickups = [];
    this.setPaused(true);
  }
  nextWord() {
    if (!this.completedOrder) {
      this.completedOrder = [];
      this.activeGroup = null;
      this.tiles = BOARD.map(([group, id, x, y]) => {
        const tile = { group, id, x, y, label: WORDS[group].en[id] };
        // The inherited advanceCell reads this before testing the moving tail.
        // A locked-out word is never mistaken for a growing target.
        Object.defineProperty(tile, 'correct', { enumerable: true,
          get: () => this.activeGroup === null || this.activeGroup === group });
        return tile;
      });
    } else {
      this.activeGroup = Object.keys(WORDS).find(group => !this.completedOrder.includes(group));
    }
    this.word = WORDS[this.activeGroup || 'cat'];
    this.cursor = 0;
    this.wordClean = true;
    this.hintAge = 0;
    this.emit('word', { word: this.activeGroup || 'cat / dog' });
  }
  isTileActive(tile) {
    return Boolean(tile && this.tiles.includes(tile) && tile.correct && tile.id === this.cursor);
  }
  target() {
    return this.tiles.find(tile => this.isTileActive(tile));
  }
  collect(tile) {
    if (this.phase !== 'playing' || !this.isTileActive(tile)) return;
    if (!this.activeGroup) {
      this.activeGroup = tile.group;
      this.word = WORDS[tile.group];
      this.emit('lock', { group: tile.group });
    }
    this.pickups.push({ group: tile.group, letter: tile.label.toUpperCase(),
      step: this.steps, x: this.head.x, y: this.head.y, direction: this.direction,
      body: this.trail.slice(0, this.length).map(p => ({...p})) });
    super.collect(tile);
  }
  complete() {
    this.completedOrder.push(this.activeGroup);
    super.complete();
    if (this.phase === 'over') this.boosting = false;
  }
}
export const createWordOrderGame = () => new WordOrderGame();
