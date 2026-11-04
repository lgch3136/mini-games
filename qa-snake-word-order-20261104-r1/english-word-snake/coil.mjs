import { SnakeGame } from "./engine.mjs?v=20261027-turn-control-r1";
import { CoilRoute } from "./route-recap.mjs?v=qa-snake-word-order-20261104-r1";
export const COIL_CHALLENGE = "coil-choice-r1";
// Record resolved movement; only the explicitly selected step limit adds a new ending.
class CoilGame extends SnakeGame {
  advanceCell() {
    if (this.stepLimit && this.phase !== "playing") return;
    const steps = this.steps, letters = this.letters, serial = this.eventSerial;
    super.advanceCell();
    if (this.route && this.steps > steps) {
      this.route.reached(this.head, this.steps, letters);
      if (this.letters > letters)
        for (const event of this.events)
          if (event.id > serial && event.type === "eat") this.route.collected(event, this.steps);
    }
    // An opt-in attempt ends only after the original move/collection resolves.
    // Taking C on the last allowed step therefore remains a success.
    if (this.stepLimit && this.steps >= this.stepLimit && this.phase === "playing") {
      this.budgetExhausted = true;
      this.phase = "over";
      this.clearInput();
      this.boosting = false;
      this.progress = 0;
      this.revision++;
    }
  }
}
// Authored optional starting position, not a change to normal generation or collision.
export function completedRouteTarget(game) {
  if (!(game instanceof CoilGame) || game.challenge !== COIL_CHALLENGE ||
      game.phase !== "over" || !game.won || game.letters !== 3 || game.completed !== 1 ||
      game.cols !== 16 || game.rows !== 12 || game.arena !== "classic" ||
      game.speedSetting !== 0 || game.mode !== "spell" || game.word.en !== "arc" ||
      !Number.isSafeInteger(game.steps) || game.steps < 1) return null;
  const summary = game.route.summary(game);
  const coordinates = [[6, 6], [10, 8], [11, 3]];
  if (summary.pickups.length !== 3 || summary.pickups.at(-1).step !== game.steps ||
      summary.pickups.some((p, i, all) =>
      p.label !== "ARC"[i] || p.x !== coordinates[i][0] || p.y !== coordinates[i][1] ||
      !Number.isSafeInteger(p.step) ||
      p.step <= (i ? all[i - 1].step : 0) || p.step > game.steps)) return null;
  return Object.freeze({ steps: game.steps, comparisonScope: summary.comparisonScope });
}
// The UI supplies only a target earned by a completed attempt in this page session.
// An invalid limit falls back to the original free attempt, never an instant failure.
export function createCoilGame({ stepLimit = 0 } = {}) {
  const game = new CoilGame({cols:16, rows:12, arena:"classic", speed:0,
    mode:"spell", words:[{en:"arc",zh:"弧线"}], seed:17});
  const trail = [[7,5],[6,5],[5,5],[4,5],[4,6],[4,7],[5,7],[6,7],[7,7]];
  for(let x=8;x<=14;x++) trail.push([x,7]);
  for(let y=6;y>=1;y--) trail.push([14,y]);
  for(let x=13;x>=1;x--) trail.push([x,1]);
  trail.push([1,2],[1,3]);
  Object.assign(game,{challenge:COIL_CHALLENGE, wordGoal:1, head:{x:7,y:5},
    length:9, trail:trail.map(([x,y])=>({x,y})),
    tiles:[{x:6,y:6,id:0,label:"a",correct:true},
      {x:10,y:8,id:1,label:"r",correct:true},{x:11,y:3,id:2,label:"c",correct:true}]});
  game.stepLimit = Number.isSafeInteger(stepLimit) && stepLimit > 0 ? stepLimit : 0;
  game.budgetExhausted = false;
  game.route = new CoilRoute(game.head, game.trail.slice(0, game.length));
  game.setPaused(true);
  return game;
}
