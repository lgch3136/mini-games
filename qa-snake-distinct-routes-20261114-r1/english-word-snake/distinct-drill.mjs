import {createRelayBoard, STAGES} from './distinct-relay.mjs?v=20261114-r1';

// A separate, page-local rehearsal of one authored board. It never receives a
// relay instance, advances a relay stage, grants a result, or writes storage.
export class RelayDrill {
  constructor(stage) {
    // Validate before retaining a stage or creating any drill state.
    this.game = createRelayBoard(stage);
    this.stage = stage;
    this.state = 'running';
    this.paused = false;
    this.reason = '';
    this.lastCollision = null;
    this.previousBoard = null;
    this.redoSnapshot = null;
    this.undoCount = 0;
    this.bookmark = null;
    this.bookmarkSteps = null;
    this.returnCount = 0;
    this.message = `正在单独练习第${stage + 1}图 · ${STAGES[stage]}。不限步数；碰撞仍会停下，可退回刚才一步另试，不续接正式接力。`;
  }
  get collisionText() {
    const c = this.lastCollision;
    if (!c) return '';
    const target = c.reason === 'wall' ? '盘外护栏' : `第${c.target.x+1}列、第${c.target.y+1}行的身体`;
    return `上次从第${c.from.x+1}列、第${c.from.y+1}行向${['右→','下↓','左←','上↑'][c.direction]}走，碰到${target}。`;
  }
  get totalSteps() { return this.game.steps; }
  get canUndo() { return this.previousBoard !== null && !this.paused; }
  undo() {
    if (!this.canUndo) return false;
    this.redoSnapshot = JSON.stringify({game:this.game,state:this.state,reason:this.reason,lastCollision:this.lastCollision,message:this.message});
    // Only one checkpoint, not a growing history or a route solver. This
    // authored single-word board makes no RNG draws after construction.
    // Re-create its class instances and seeded RNG, then restore all data.
    const data = JSON.parse(this.previousBoard), board = createRelayBoard(this.stage);
    const route = Object.assign(board.route, data.route);
    Object.assign(board, data); board.route = route;
    this.game = board; this.previousBoard = null; this.undoCount++;
    this.state = 'running'; this.reason = ''; this.paused = false;
    this.message = `已退回刚才一步。${this.collisionText}当前路线${board.steps}步，已退回${this.undoCount}次；换个方向试试，不计接力成绩。`;
    return true;
  }
  get canRedo() { return this.redoSnapshot !== null && !this.paused; }
  redo() {
    if (!this.canRedo) return false;
    const snapshot = JSON.parse(this.redoSnapshot), board = createRelayBoard(this.stage);
    const previous = JSON.stringify(this.game);
    const route = Object.assign(board.route, snapshot.game.route);
    Object.assign(board, snapshot.game); board.route = route;
    this.game = board; this.state = snapshot.state; this.reason = snapshot.reason;
    this.lastCollision = snapshot.lastCollision; this.message = snapshot.message.replace(/已退回\d+次/g, `已退回${this.undoCount}次`);
    this.previousBoard = previous; this.redoSnapshot = null;
    return true;
  }
  get canBookmark() { return this.state === 'running' && !this.paused; }
  get canReturn() { return this.bookmark !== null && !this.paused; }
  saveBookmark() {
    if (!this.canBookmark) return false;
    this.bookmark = JSON.stringify(this.game);
    this.bookmarkSteps = this.totalSteps;
    this.message = `已记住第${this.bookmarkSteps}步的岔路。只保留一处；回到这里后可另选方向，不计接力成绩。`;
    return true;
  }
  returnToBookmark() {
    if (!this.canReturn) return false;
    this.redoSnapshot = null;
    const data = JSON.parse(this.bookmark), board = createRelayBoard(this.stage);
    const route = Object.assign(board.route, data.route);
    Object.assign(board, data); board.route = route;
    this.game = board; this.previousBoard = null; this.returnCount++; this.lastCollision = null;
    this.state = 'running'; this.reason = ''; this.paused = false;
    this.message = `已回到第${this.bookmarkSteps}步的岔路，已回岔路${this.returnCount}次。原岔路仍保留，可另试方向；不计接力成绩。`;
    return true;
  }
  pause() {
    if (this.state !== 'running' || this.paused) return false;
    this.paused = true; this.message = '本图练习已暂停。继续后仍每次按键走一格。'; return true;
  }
  resume() {
    if (this.state !== 'running' || !this.paused) return false;
    this.paused = false; this.message = '继续本图练习。不限步数，不计接力成绩。'; return true;
  }
  finish(reason) {
    this.reason = reason; this.state = reason === 'complete' ? 'won' : 'lost';
    this.paused = false; this.game.setPaused(true); this.game.clearInput();
    this.message = reason === 'complete'
      ? `本图练习完成，当前路线${this.totalSteps}步，已退回${this.undoCount}次。可退回最后一步或重练本图；这不算三图接力通关。`
      : `碰到${reason === 'wall' ? '护栏' : '身体'}，本次练习停下。可退回刚才一步改走，或重练第${this.stage + 1}图。`;
  }
  step(direction) {
    const g = this.game;
    if (this.state !== 'running' || this.paused || !Number.isInteger(direction) || direction < 0 || direction > 3) return false;
    if (direction === (g.direction + 2) % 4) {
      this.message = '不能直接掉头，本次不走格。'; return false;
    }
    const serial = g.eventSerial, hits = g.hits;
    const checkpoint = JSON.stringify(g);
    const from = {...g.head}, delta = [[1,0],[0,1],[-1,0],[0,-1]][direction];
    g.setPaused(false);
    if (direction !== g.direction && !g.input(direction)) {
      g.setPaused(true); this.message = '转向未接受，本次不走格。'; return false;
    }
    this.redoSnapshot = null;
    this.previousBoard = checkpoint;
    // Identical four production ticks and first-hit stop as CleanRelay.step.
    for (let i = 0; i < 4 && g.phase === 'playing' && g.hits === hits; i++) g.update(.05);
    g.setPaused(true);
    const events = g.events.filter(e => e.id > serial), hurt = events.find(e => e.type === 'hurt');
    if (hurt) {
      this.lastCollision = {from, direction, target: {x:from.x+delta[0], y:from.y+delta[1]}, reason:hurt.reason === 'wall' ? 'wall' : 'body'};
      this.finish(this.lastCollision.reason); this.message += this.collisionText; return true;
    }
    this.lastCollision = null;
    if (g.won) { this.finish('complete'); return true; }
    const eat = events.find(e => e.type === 'eat');
    this.message = eat ? `取到 ${eat.label.toUpperCase()}！本图已走${g.steps}步；不计接力成绩。`
      : `本图已走${g.steps}步。松手可观察，不限步数；不计接力成绩。`;
    return true;
  }
}
