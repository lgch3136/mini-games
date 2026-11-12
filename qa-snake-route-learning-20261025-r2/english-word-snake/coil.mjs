import { SnakeGame } from "./engine.mjs?v=20261021-basket-feedback-r1";
import { CoilRoute } from "./route-recap.mjs?v=20261025-route-learning-r2";
export const COIL_CHALLENGE = "coil-choice-r1";
// Observe only after the unchanged engine resolves actual movement and collection.
class CoilGame extends SnakeGame {
  advanceCell() {
    const steps = this.steps, letters = this.letters, serial = this.eventSerial;
    super.advanceCell();
    if (this.route && this.steps > steps) {
      this.route.reached(this.head, this.steps, letters);
      if (this.letters > letters)
        for (const event of this.events)
          if (event.id > serial && event.type === "eat") this.route.collected(event, this.steps);
    }
  }
}
// Authored optional starting position, not a change to normal generation or collision.
export function createCoilGame() {
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
  game.route = new CoilRoute(game.head, game.trail.slice(0, game.length));
  game.setPaused(true);
  return game;
}
