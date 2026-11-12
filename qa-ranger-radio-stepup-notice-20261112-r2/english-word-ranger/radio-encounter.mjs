import { World, STEP } from './engine.mjs?v=qa-ranger-radio-stepup-20261112-r2';

// An isolated, finite design experiment. Ordinary World, its RNG and input rules
// remain untouched. radioEnabled=false is a CPU comparison control, not a menu mode.
export const RADIO = Object.freeze({ callerX: 700, callerY: 330, callSeconds: 2.8,
  gateX: 1120, gateWarning: 1.8, arrivalSeconds: 0.9, exitX: 1440, length: 1530 });

function enemy(id, type, x, y = 454, extra = {}) {
  return { id, type, x, y, px:x, py:y, home:x, vy:0, vx:0, face:-1,
    w:30, h:type === 'runner' ? 30 : type === 'turret' ? 40 : 59,
    hp:type === 'turret' ? 6 : 3, phase:'patrol', timer:0.6,
    shotTimer:0, shots:0, flash:0, age:0, grounded:false, gait:0, active:false, ...extra };
}

export class RadioEncounter extends World {
  constructor({ difficulty = 'normal', width = 960, radioEnabled = true } = {}) {
    super({ seed:47, stage:0, difficulty, width, shortThrow:false, specialization:'normal' });
    this.encounter = 'radio';
    this.radioEnabled = radioEnabled;
    const terrain = [
      {id:1, x:0, y:454, w:RADIO.length, h:146, material:'earth'},
      {id:2, x:320, y:354, w:220, h:16, oneWay:true, material:'wood'},
      {id:3, x:620, y:330, w:230, h:16, oneWay:true, material:'steel'},
    ];
    this.enemies = [enemy(10, 'grunt', 550), enemy(11, 'runner', 850),
      enemy(12, 'turret', RADIO.callerX, RADIO.callerY, { radioCaller:true })];
    this.terrain = terrain;
    this.props = []; this.pickups = [];
    this.level = { length:RADIO.length, terrain, enemies:this.enemies, props:this.props,
      pickups:this.pickups, beacons:[], bossX:100000, arena:100000,
      exit:100000, nextId:100 };
    this.id = 100;
    this.boss.x = this.boss.px = 100000; this.boss.hp = 0;
    this.radio = { phase:radioEnabled ? 'waiting' : 'control', remaining:RADIO.callSeconds,
      callerId:12, callerDown:false, waveCount:0, gateSeen:0, gateBlocked:false,
      clear:false, log:[] };
  }
  radioEvent(type) {
    this.radio.log.push({ type, tick:this.tick, time:this.time });
    this.emit(type);
  }
  fullyVisible(left, right, margin = 28) {
    return left >= this.camera + margin && right <= this.camera + this.viewW - margin;
  }
  updateEnemy(e, dt) {
    // A finite encounter may be backtracked. Do not let the ordinary long-level
    // cleanup silently count a skipped, still-living enemy as a cleared target.
    if (e.x < this.camera - 360) return;
    if (e.arrival > 0) {
      e.arrival = Math.max(0, e.arrival - dt);
      e.flash = Math.max(0, e.flash - dt);
      // Visible, vulnerable arrival: no contact/fire until the arrival cue ends.
      // Finite grace only. Walking into an already-visible entrant does not
      // renew it: after 0.9s the original attack/contact rules take over.
      return;
    }
    super.updateEnemy(e, dt);
  }
  step(input = {}, dt = STEP) {
    if (this.status !== 'playing') return;
    super.step(input, dt);
    if (this.status !== 'playing') return;
    const r = this.radio, caller = this.enemies.find(e => e.id === r.callerId && !e.dead);
    // Bullet/stomp/explosion damage resolves first, so a same-tick kill cancels.
    if (!caller && !r.callerDown) {
      r.callerDown = true;
      if (r.phase === 'waiting' || r.phase === 'calling') {
        r.phase = 'interrupted'; this.radioEvent('radioInterrupted');
      }
    }
    if (r.phase === 'waiting' && caller && this.player.x >= 300 &&
        this.fullyVisible(caller.x - 65, caller.x + 65)) {
      r.phase = 'calling'; this.radioEvent('radioCalling');
    } else if (r.phase === 'calling') {
      r.remaining = Math.max(0, r.remaining - dt);
      if (r.remaining <= 1e-9) {
        r.phase = 'sent'; r.gateSeen = 0; this.radioEvent('radioSent');
      }
    }
    if (r.phase === 'sent') {
      const visible = this.fullyVisible(RADIO.gateX - 48, RADIO.gateX + 100);
      r.gateSeen = visible ? r.gateSeen + dt : 0;
      const positions = [RADIO.gateX, RADIO.gateX + 60];
      r.gateBlocked = positions.some(x => Math.abs(this.player.x - x) < 150 ||
        Math.abs(this.player.safeX - x) < 70);
      if (r.gateSeen >= RADIO.gateWarning && !r.gateBlocked && r.waveCount === 0) {
        r.waveCount = 1; r.phase = 'arrived';
        this.enemies.push(...positions.map((x,i) => enemy(this.id++, i ? 'runner' : 'grunt', x, 454,
          { active:true, arrival:RADIO.arrivalSeconds, reinforcement:true })));
        this.radioEvent('radioArrived');
      }
    }
    const settled = ['interrupted','arrived','control'].includes(r.phase);
    if (!r.clear && settled && this.enemies.every(e => e.dead || e.hp <= 0)) {
      r.clear = true; this.level.exit = RADIO.exitX;
      // No unseen leftover enemy projectile can punish the completed encounter.
      this.bullets = this.bullets.filter(b => b.owner !== 'enemy');
      this.radioEvent('radioClear');
    }
  }
  retryCheckpoint() {
    return new RadioEncounter({ difficulty:this.difficulty, width:this.viewW, radioEnabled:this.radioEnabled });
  }
}

export function radioStatus(world) {
  const r = world.radio;
  if (r.clear) return ['哨点已清理 · 向右撤离 →', '本次实验不保存成绩、徽章或词汇进度'];
  if (r.phase === 'waiting') return ['呼援哨点 · 上层炮哨尚未发报', '击破可取消呼援；或先清地面，再应付右侧的一波增援'];
  if (r.phase === 'calling') return [`正在呼援 ${r.remaining.toFixed(1)}s · 击破上层炮哨可取消`, '只命中不会打断；上射、跳射或手雷可攻击上层'];
  if (r.phase === 'interrupted') return ['呼援已打断 · 不会有增援', '清理剩余目标，然后向右撤离'];
  if (r.phase === 'sent') {
    const visible = world.fullyVisible(RADIO.gateX - 48, RADIO.gateX + 100);
    return ['呼援成功 · 入口将到一波增援', r.gateBlocked
      ? '离入口再远一些，让出入场空间；出现前不会攻击'
      : !visible ? (world.player.x > RADIO.gateX ? '← 返回入口，使整个黄框入镜' : '向右接近增援入口 → 让整个黄框入镜')
      : '入口预告后出现；击破炮哨不再撤销已发出的呼援'];
  }
  if (r.phase === 'arrived') return ['唯一一波增援已到 · 不再呼援', '清理地面与上层剩余目标，然后向右撤离'];
  return ['同场景无呼援对照', '仅用于CPU对照，不是正式关卡'];
}
