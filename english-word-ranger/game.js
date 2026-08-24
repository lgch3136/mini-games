'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const wrap = $('game-wrap');

let VIEW_W = 960;
const VIEW_H = 540;
const GROUND_Y = 478;
const CHUNK_W = 720;
const TAU = Math.PI * 2;
const PLAYER_H = 59.8;
const CROUCH_H = 30;
const BULLET_SPEED = 660;
const FIXED_STEP = 1 / 60;
const POWERUP_LABELS = { spread: '散射', rapid: '连射', shield: '护盾' };

const DIFFICULTIES = {
  easy: { speed: 220, enemySpeed: 44, hp: 1, fireEvery: 3, spawn: .8, label: '初级' },
  medium: { speed: 236, enemySpeed: 58, hp: 2, fireEvery: 2.25, spawn: 1, label: '中级' },
  hard: { speed: 252, enemySpeed: 72, hp: 3, fireEvery: 1.65, spawn: 1.25, label: '高级' },
};

const BIOMES = [
  { name: '曙光森林', ground: '#102f25', edge: '#efc766', weather: 'pollen', gravity: 1450, traction: 1 },
  { name: '风蚀峡谷', ground: '#3d2619', edge: '#f0b75d', weather: 'dust', gravity: 1450, traction: .9 },
  { name: '雨中古城', ground: '#0d2a30', edge: '#9bd8d0', weather: 'rain', gravity: 1500, traction: .46 },
  { name: '月晶遗迹', ground: '#111b31', edge: '#e7bd58', weather: 'glow', gravity: 840, traction: .82 },
];

const STAGES = [
  [
    { name: '林地侦察', foes: [['beetle', 350]] },
    { name: '树桥伏击', foes: [['beetle', 210], ['drone', 560]] },
    { name: '守卫哨站', foes: [['drone', 250], ['guardian', 545]] },
  ],
  [
    { name: '断崖上升', foes: [['beetle', 170], ['drone', 525]] },
    { name: '逆风飞跃', foes: [['drone', 310], ['guardian', 610]] },
    { name: '悬桥落石', foes: [['beetle', 150], ['drone', 390], ['guardian', 620]] },
  ],
  [
    { name: '湿街追逐', foes: [['beetle', 230], ['guardian', 560]] },
    { name: '蒸汽管廊', foes: [['drone', 210], ['guardian', 520]] },
    { name: '雷暴广场', foes: [['beetle', 160], ['drone', 410], ['guardian', 625]] },
  ],
  [
    { name: '低重力门', foes: [['drone', 230], ['beetle', 575]] },
    { name: '晶簧跃迁', foes: [['drone', 270], ['guardian', 590]] },
    { name: '月台激光', foes: [['beetle', 170], ['drone', 390], ['guardian', 625]] },
  ],
];

const MISSION_LEVELS = [
  { name: '第一关 · 曙光森林', biome: 0, bossName: '林地核心', music: 'ranger-stage',
    beats: [
      { tag: 'TEACH', name: '巡逻线', hint: '橙光亮起后，巡逻兽会直线冲锋', foes: [['beetle', 420]], lock: true },
      { tag: 'TEST', name: '壕沟试跳', hint: '先越过壕沟，再处理冲锋', gaps: [[330, 105]], foes: [['beetle', 555]], lock: true },
      { tag: 'RECOVERY', name: '林间补给', hint: '短暂喘息，击落补给舱', foes: [['capsule', 470]], checkpoint: true, drop: 'spread' },
      { tag: 'TEACH', name: '跃击预警', hint: '压低蓄力时后撤，从落点下方穿过', foes: [['leaper', 430]], lock: true },
      { tag: 'TEST', name: '高台炮线', hint: '瞄准线锁定后立刻改变高度', platforms: [[405, 96, 150]], foes: [['turret', 485, 96]], lock: true },
      { tag: 'COMBINE', name: '盾墙交叉火力', hint: '绕过盾面，在炮台恢复窗口反击', platforms: [[455, 92, 145]], foes: [['guardian', 315], ['turret', 520, 92]], lock: true },
      { tag: 'TWIST', name: '蜂群来袭', hint: '两架无人机交错俯冲', gaps: [[300, 88]], foes: [['drone', 320], ['drone', 520]], lock: true },
      { tag: 'COMBINE', name: '壕沟双哨', hint: '越壕后立刻处理跃击者', gaps: [[280, 96]], platforms: [[430, 90, 130]], foes: [['leaper', 480], ['beetle', 560]], lock: true },
      { tag: 'WORD_GATE', name: '回忆补给门', hint: '只看中文，主动回忆刚才的单词', wordGate: true, checkpoint: true },
      { tag: 'TWIST', name: '林冠俯冲', hint: '锁定标记出现后横向撤离', gaps: [[330, 92]], foes: [['drone', 430], ['leaper', 585]], lock: true },
      { tag: 'TEST', name: '林间竞速', hint: '连续三段跳跃保持节奏', gaps: [[240, 84], [420, 92], [580, 88]], platforms: [[330, 82, 100], [500, 96, 104]], lock: true },
      { tag: 'CLIMAX', name: '三向夹击', hint: '先拆炮台，再处理盾兵与冲锋', platforms: [[520, 88, 138]], foes: [['beetle', 250], ['guardian', 420], ['turret', 580, 88]], lock: true },
      { tag: 'RECOVERY', name: '守卫前庭', hint: '补充火力，准备首领战', foes: [['capsule', 455]], wordGate: true, checkpoint: true, drop: 'rapid' },
      { tag: 'BOSS', name: '林地核心', hint: '观察预兆，击破单词护盾', foes: [['boss', 520]], lock: true },
    ] },
  { name: '第二关 · 风蚀峡谷', biome: 1, bossName: '峡谷暴君', music: 'ranger-boss',
    beats: [
      { tag: 'TEACH', name: '峡谷风口', hint: '上升气流可以托住跳跃', gaps: [[335, 100]], hazards: [['updraft', 505, 255, 112]], foes: [['beetle', 240]], lock: true },
      { tag: 'TEST', name: '落石走廊', hint: '落石往返巡逻，看准节奏通过', hazards: [['rock', 345, 0, 40]], foes: [['beetle', 180], ['leaper', 540]], lock: true },
      { tag: 'RECOVERY', name: '岩架补给', hint: '击落补给舱，补充弹药', foes: [['capsule', 450]], checkpoint: true, drop: 'spread' },
      { tag: 'COMBINE', name: '双层哨位', hint: '先清高台炮，再处理地面盾兵', platforms: [[380, 120, 140]], hazards: [['updraft', 560, 250, 110]], foes: [['turret', 420, 120], ['guardian', 560]], lock: true },
      { tag: 'WORD_GATE', name: '回忆石门', hint: '只看中文，主动回忆单词', wordGate: true, checkpoint: true },
      { tag: 'TWIST', name: '断桥强风', hint: '逆风会拉低跳跃距离', gaps: [[285, 200]], hazards: [['updraft', 285, 248, 200]], foes: [['drone', 420], ['beetle', 560]], lock: true },
      { tag: 'TEST', name: '滚石坡道', hint: '双落石交错，走外线', hazards: [['rock', 300, 0, 40], ['rock', 520, 0, 40]], foes: [['leaper', 430]], lock: true },
      { tag: 'COMBINE', name: '风眼窄桥', hint: '强风中走窄平台', gaps: [[250, 180], [500, 170]], platforms: [[340, 118, 110], [580, 132, 108]], hazards: [['updraft', 250, 246, 180]], foes: [['drone', 450]], lock: true },
      { tag: 'TWIST', name: '落石雨', hint: '四块落石封锁路面', hazards: [['rock', 260, 0, 40], ['rock', 400, 0, 40], ['rock', 540, 0, 40]], foes: [['beetle', 620]], lock: true },
      { tag: 'CLIMAX', name: '峡谷绞索', hint: '三线夹击，先拆空中', platforms: [[450, 128, 135]], hazards: [['updraft', 300, 260, 105]], foes: [['drone', 260], ['guardian', 430], ['turret', 590, 128]], lock: true },
      { tag: 'RECOVERY', name: '暴君前厅', hint: '最后补给，准备首领战', foes: [['capsule', 460]], wordGate: true, checkpoint: true, drop: 'shield' },
      { tag: 'BOSS', name: '峡谷暴君', hint: '落石+冲锋交替，保持移动', foes: [['boss', 520]], lock: true },
    ] },
  { name: '第三关 · 雨中古城', biome: 2, bossName: '古城主宰', music: 'ranger-stage',
    beats: [
      { tag: 'TEACH', name: '湿滑石街', hint: '水洼会打滑，提前刹车', hazards: [['puddle', 180, 0, 115], ['puddle', 475, 0, 130]], foes: [['beetle', 300]], lock: true },
      { tag: 'TEST', name: '蒸汽管廊', hint: '蒸汽有喷射节奏', platforms: [[180, 105, 145]], hazards: [['steam', 350, 0, 40], ['steam', 625, 0, 40]], foes: [['leaper', 480]], lock: true },
      { tag: 'RECOVERY', name: '骑楼补给', hint: '雨中喘息', foes: [['capsule', 440]], checkpoint: true, drop: 'rapid' },
      { tag: 'COMBINE', name: '激光回廊', hint: '双激光交错，走对角线', hazards: [['laser', 190, 0, 96], ['laser', 520, 0, 104]], foes: [['drone', 380]], lock: true },
      { tag: 'WORD_GATE', name: '回忆圣堂', hint: '主动回忆，奖励翻倍', wordGate: true, checkpoint: true },
      { tag: 'TWIST', name: '暴雨空袭', hint: '无人机群+湿滑地面', hazards: [['puddle', 320, 0, 120]], foes: [['drone', 260], ['drone', 480], ['leaper', 590]], lock: true },
      { tag: 'COMBINE', name: '钟楼防线', hint: '高台双炮，用蒸汽掩护推进', platforms: [[200, 110, 130], [470, 140, 135]], hazards: [['steam', 350, 0, 40]], foes: [['turret', 240, 110], ['turret', 510, 140]], lock: true },
      { tag: 'TWIST', name: '双廊蒸汽', hint: '两组蒸汽交替喷射', hazards: [['steam', 220, 0, 40], ['steam', 380, 0, 40], ['steam', 540, 0, 40]], foes: [['leaper', 300], ['leaper', 600]], lock: true },
      { tag: 'COMBINE', name: '钟摆激光', hint: '移动中跨越激光阵', hazards: [['laser', 200, 0, 96], ['laser', 360, 0, 104], ['laser', 520, 0, 96]], platforms: [[290, 92, 90], [450, 98, 90]], lock: true },
      { tag: 'CLIMAX', name: '广场总攻', hint: '全兵种会师，逐个击破', platforms: [[430, 96, 140]], hazards: [['laser', 200, 0, 100]], foes: [['beetle', 240], ['guardian', 400], ['turret', 570, 96], ['drone', 620]], lock: true },
      { tag: 'RECOVERY', name: '主宰王庭', hint: '最终补给', foes: [['capsule', 450]], wordGate: true, checkpoint: true, drop: 'shield' },
      { tag: 'BOSS', name: '古城主宰', hint: '三阶段狂暴，护盾口令是关键', foes: [['boss', 520]], lock: true },
    ] },
  { name: '第四关 · 月晶遗迹', biome: 3, bossName: '月晶守卫', music: 'ranger-boss',
    beats: [
      { tag: 'TEACH', name: '低重力训练', hint: '月球重力下跳得更高更飘', gaps: [[320, 150]], foes: [['beetle', 500]], lock: true },
      { tag: 'TEST', name: '晶簧起跳', hint: '弹簧把你送上高台', gaps: [[300, 145]], hazards: [['spring', 238, 0, 50]], platforms: [[325, 132, 96]], foes: [['drone', 480]], lock: true },
      { tag: 'RECOVERY', name: '星尘补给', hint: '月色下的喘息', foes: [['capsule', 440]], checkpoint: true, drop: 'spread' },
      { tag: 'COMBINE', name: '悬浮炮台', hint: '弹簧近身拆炮', gaps: [[205, 125], [505, 130]], hazards: [['spring', 145, 0, 50], ['spring', 445, 0, 50]], platforms: [[190, 105, 150]], foes: [['turret', 300, 105]], lock: true },
      { tag: 'WORD_GATE', name: '回忆星门', hint: '最终回忆考验', wordGate: true, checkpoint: true },
      { tag: 'TWIST', name: '晶柱迷宫', hint: '低重力连续跳台', gaps: [[240, 120], [430, 125], [600, 120]], platforms: [[350, 122, 92], [520, 138, 92]], lock: true },
      { tag: 'TEST', name: '激光走廊', hint: '低重力下小心越过激光', hazards: [['laser', 210, 0, 110], ['laser', 460, 0, 110]], foes: [['guardian', 600]], lock: true },
      { tag: 'COMBINE', name: '水晶夹缝', hint: '弹簧+浮台+无人机', gaps: [[410, 155]], platforms: [[405, 125, 165]], hazards: [['spring', 345, 0, 50]], foes: [['drone', 250], ['leaper', 550]], lock: true },
      { tag: 'CLIMAX', name: '月台会战', hint: '全兵种终极考验', platforms: [[300, 118, 120], [520, 142, 120]], hazards: [['spring', 200, 0, 50], ['laser', 440, 0, 100]], foes: [['guardian', 260], ['drone', 420], ['turret', 545, 142]], lock: true },
      { tag: 'RECOVERY', name: '守卫圣殿', hint: '决战前最后的补给', foes: [['capsule', 450]], wordGate: true, checkpoint: true, drop: 'rapid' },
      { tag: 'BOSS', name: '月晶守卫', hint: '最终首领：低重力下的终极试炼', foes: [['boss', 520]], lock: true },
    ] },
];
// 兼容: 当前关卡的节拍表
let MISSION_BEATS = MISSION_LEVELS[0].beats;

const BEAT_LABELS = {
  TEACH: '教学', TEST: '测试', RECOVERY: '喘息', COMBINE: '组合',
  WORD_GATE: '回忆门', TWIST: '变化', CLIMAX: '高潮', BOSS: '首领', EXIT: '终点',
};

const ENEMY_SPECS = {
  beetle: { w: 42, h: 34, hp: 1, range: 95 },
  leaper: { w: 48, h: 38, hp: 2, range: 105 },
  drone: { w: 42, h: 42, hp: 2, range: 125, air: true },
  guardian: { w: 55, h: 62, hp: 4, range: 70 },
  turret: { w: 52, h: 46, hp: 3, range: 0 },
  boss: { w: 78, h: 92, hp: 16, range: 115 },
  capsule: { w: 46, h: 28, hp: 2, range: 150, air: true },
};

const ASSETS = {};
for (const [name, src] of Object.entries({
  hero: 'assets/hero-sprites.webp',
  actions: 'assets/hero-actions-v2.png',
  enemies: 'assets/enemy-sprites.webp',
  biomes: 'assets/biomes.webp',
  hazards: 'assets/hazard-atlas-v2.webp',
})) {
  const image = new Image();
  image.src = src;
  ASSETS[name] = image;
}

const HAZARD_SPRITES = {
  updraft: { row: 0, column: 0, w: 112, h: 132, baseline: 496 / 512 },
  rock: { row: 0, column: 1, w: 58, h: 58, baseline: 473 / 512 },
  puddle: { row: 0, column: 2, w: 126, h: 50, baseline: 499 / 512 },
  steam: { row: 1, column: 0, w: 76, h: 116, baseline: 475 / 512 },
  laser: { row: 1, column: 1, w: 142, h: 94, baseline: 419 / 512 },
  spring: { row: 1, column: 2, w: 70, h: 78, baseline: 459 / 512 },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const input = { left: false, right: false, up: false, down: false, fire: false, jumpHeld: false, jumpBuffer: 0 };
const mobileAssist = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

const Game = {
  state: 'menu', mode: 'mission', difficulty: 'easy', score: 0, wordsDone: 0, hp: 3,
  missionLevel: 0,
  distance: 0, maxX: 70, camera: 0, checkpoint: 70, time: 0,
  feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null, wordEcho: null,
  generatedTo: 0, nextChunkIndex: 0, enteredChunk: -1,
  reinforcementTimer: 4.5, reinforcementCount: 0, stageBanner: null,
  hitStop: 0, shake: 0, shakeStrength: 0, flash: 0, victoryTimer: 0,
  autoFire: false, sessionWords: [], sessionWordIndex: 0, completedWords: [], recalledWords: [], recallResults: [], wordGate: null,
  bossNodes: [], bossNodeProgress: 0, bossGateDone: false, bossWord: null,
  chunks: [], pickups: [], powerups: [], enemies: [], bullets: [], enemyBullets: [], particles: [],
  player: {
    x: 70, y: GROUND_Y - PLAYER_H, w: 30, h: PLAYER_H,
    vx: 0, vy: 0, facing: 1, onGround: true,
    coyote: .1, inv: 0, fireCooldown: 0, dropTimer: 0,
    crouching: false, aimX: 1, aimY: 0,
    landingTimer: 0, skidTimer: 0, hurtTimer: 0,
    runCycle: 0, stepTimer: 0, recoil: 0, muzzleFlash: 0,
    weapon: 'normal', weaponTimer: 0, shield: 0,
    overdrive: 0, combo: 0, comboTimer: 0,
  },
};

function aimDirection(source = input, player = Game.player) {
  const horizontal = Number(Boolean(source.right)) - Number(Boolean(source.left));
  let x = horizontal || player.facing || 1;
  let y = 0;
  if (source.up) {
    y = -1;
    if (!horizontal) x = 0;
  } else if (source.down && (!player.onGround || horizontal)) {
    y = 1;
    if (!horizontal) x = 0;
  }
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

// 护盾阶段的辅助瞄准: up键即锁定应击节点(解决八方向瞄不到上方节点的死局)
function playerFacingPositive() { return (Game.player.facing || 1) >= 0; }
function shotDirection() {
  const bossShieldActive = Game.enemies.some((enemy) => enemy.type === 'boss' && !enemy.dead && enemy.bossPhase === 2);
  if (bossShieldActive && input.up && Game.player.onGround) {
    // 护盾阶段辅助瞄准: 子弹自动导向当前应击的节点(顺序正确的优先)
    const boss = Game.enemies.find((e) => e.type === 'boss' && !e.dead && e.bossPhase === 2);
    if (boss) {
      const targetNode =
        Game.bossNodes.find((n) => n.active && n.order === Game.bossNodeProgress) ||
        Game.bossNodes.find((n) => n.active && n.order >= 0);
      if (targetNode) {
        const rect = bossNodeRect(targetNode, boss);
        const ox = Game.player.x + Game.player.w / 2 + 28;
        const oy = Game.player.y + Game.player.h * .42;
        const dx = rect.x + rect.w / 2 - ox;
        const dy = rect.y + rect.h / 2 - oy;
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
      }
    }
    // 没有节点可瞄时退回普通斜射
    const dirX = input.right || playerFacingPositive() ? 1 : -1;
    return { x: Math.cos(.5) * dirX, y: -Math.sin(.5) };
  }
  return baseAimShot();
}

function baseAimShot() {
  const manual = aimDirection();
  if (!mobileAssist || input.up || input.down) return manual;
  const player = Game.player;
  const originX = player.x + player.w / 2;
  const originY = player.y + player.h * .42;
  const boss = Game.enemies.find((enemy) => enemy.type === 'boss' && !enemy.dead);
  const nodeTargets = boss ? Game.bossNodes.filter((node) => node.active).map((node) => bossNodeRect(node, boss)) : [];
  const targets = nodeTargets.map((node) => ({ x: node.x + node.w / 2, y: node.y + node.h / 2 }))
    .concat(Game.enemies.filter((enemy) => !enemy.dead && enemy.type !== 'capsule').map((enemy) => ({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2 })));
  const target = targets.filter((item) => {
    const dx = item.x - originX;
    return Math.abs(dx) < 470 && (Math.sign(dx || player.facing) === player.facing || Math.abs(dx) < 90);
  }).sort((a, b) => Math.hypot(a.x - originX, (a.y - originY) * .65) - Math.hypot(b.x - originX, (b.y - originY) * .65))[0];
  if (!target) return manual;
  const dx = target.x - originX;
  const dy = target.y - originY;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function setCrouching(enabled) {
  const player = Game.player;
  if (player.crouching === enabled) return;
  const feet = player.y + player.h;
  player.crouching = enabled;
  player.h = enabled ? CROUCH_H : PLAYER_H;
  player.y = feet - player.h;
}

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 9);
}

function biomeIndexAt(x) {
  return Game.mode === 'mission' ? 0 : Math.floor(Math.max(0, x) / (CHUNK_W * 3)) % BIOMES.length;
}

function chunkAt(x) {
  return Game.chunks.find((chunk) => x >= chunk.start && x < chunk.start + CHUNK_W);
}

function isGap(chunk, x) {
  return chunk && chunk.gaps.some((gap) => x >= gap.x && x <= gap.x + gap.w);
}

function groundAt(x) {
  const chunk = chunkAt(x);
  return chunk && !isGap(chunk, x) ? GROUND_Y : null;
}

function chunkHasThreats(chunk) {
  return Game.enemies.some((enemy) => !enemy.dead && enemy.type !== 'capsule' && enemy.chunkIndex === chunk.index);
}

function platformTop(platform) {
  return platform.y + (platform.move ? Math.sin(Game.time * 1.45 + platform.phase) * platform.move : 0);
}

function makeEnemy(type, x, chunkIndex, floorY = GROUND_Y) {
  const conf = DIFFICULTIES[Game.difficulty];
  const spec = ENEMY_SPECS[type];
  const scale = Game.mode === 'mission' ? 1 : Math.min(3.2, 1 + Math.floor(chunkIndex / 6) * .16);
  const hp = Math.ceil(spec.hp * conf.hp * scale);
  const baseY = type === 'drone' ? 285 : type === 'capsule' ? 185 : floorY - spec.h;
  return {
    type, chunkIndex, x, home: x, floorY, baseY, y: baseY,
    w: spec.w, h: spec.h, hp, maxHp: hp, range: spec.range,
    vx: 0, vy: 0, facing: -1, onGround: !spec.air,
    state: 'idle', stateTimer: 0, cooldown: .65 + Math.random() * .8, attackIndex: 0,
    targetX: x, targetY: baseY, bossPhase: 1,
    phase: Math.random() * TAU, dead: false, hit: 0, stun: 0, dropType: null,
  };
}

function generateMissionChunk(index, start) {
  const beat = MISSION_BEATS[index] || { tag: 'EXIT', name: '守卫封锁线', hint: '前线任务已结束', foes: [] };
  const chunk = {
    index, start, biome: MISSION_LEVELS[Game.missionLevel].biome, encounter: beat.name, tag: beat.tag, hint: beat.hint,
    lock: Boolean(beat.lock), wordGate: Boolean(beat.wordGate), checkpoint: Boolean(beat.checkpoint),
    gateUsed: false, cleared: false, gaps: [], platforms: [], hazards: [], decor: [],
  };
  for (const [offset, width] of beat.gaps || []) chunk.gaps.push({ x: start + offset, w: width });
  for (const [offset, rise, width] of beat.platforms || []) chunk.platforms.push({ x: start + offset, y: GROUND_Y - rise, w: width, move: 0, phase: 0 });
  for (const [type, offset, y, w] of beat.hazards || []) {
    const h = type === 'updraft' ? GROUND_Y - y : type === 'puddle' ? 8 : type === 'rock' ? 40 : type === 'steam' ? 96 : type === 'laser' ? 12 : 18;
    chunk.hazards.push({ type, x: start + offset, y: type === 'updraft' ? y : GROUND_Y - h - (y || 0), w: w || (type === 'rock' ? 40 : 100), h,
      phase: index * .7 + offset * .01, home: start + offset, range: 82, vx: type === 'rock' ? 62 : 0 });
  }
  for (let i = 0; i < 5; i++) chunk.decor.push({ x: start + 88 + i * 132 + (index * 29 + i * 19) % 38, size: .74 + ((index + i) % 3) * .13 });
  Game.chunks.push(chunk);
  Game.generatedTo += CHUNK_W;
  maybeSwitchBossMusic(chunk);
  for (const [type, offset, rise = 0] of beat.foes || []) {
    const enemy = makeEnemy(type, start + offset, index, GROUND_Y - rise);
    if (type === 'capsule') enemy.dropType = beat.drop || 'shield';
    Game.enemies.push(enemy);
  }
}

// 任务模式进入 Boss 节拍时切换战斗曲（在 chunk 生成时检测）
function maybeSwitchBossMusic(chunk) {
  if (!window.ChipMusic || Game.mode !== 'mission') return;
  if (chunk.tag === 'BOSS' && ChipMusic.playing !== 'ranger-boss') ChipMusic.play('ranger-boss');
}

function generateChunk() {
  const index = Game.nextChunkIndex++;
  const start = Game.generatedTo;
  if (Game.mode === 'mission') {
    generateMissionChunk(index, start);
    return;
  }
  const biome = biomeIndexAt(start);
  const slot = index % 3;
  const stage = STAGES[biome][slot];
  const chunk = { index, start, biome, encounter: stage.name, gaps: [], platforms: [], hazards: [], decor: [] };

  if (index > 0 && biome === 0) {
    if (slot === 1) {
      chunk.gaps.push({ x: start + 335, w: 105 });
      chunk.platforms.push({ x: start + 340, y: GROUND_Y - 78, w: 96, move: 0, phase: 0 });
    } else if (slot === 2) {
      chunk.gaps.push({ x: start + 505, w: 82 });
      chunk.platforms.push({ x: start + 190, y: GROUND_Y - 72, w: 130, move: 0, phase: 0 });
      chunk.platforms.push({ x: start + 480, y: GROUND_Y - 112, w: 122, move: 16, phase: index });
    }
  } else if (biome === 1) {
    if (slot === 0) {
      chunk.gaps.push({ x: start + 235, w: 100 }, { x: start + 505, w: 112 });
      chunk.platforms.push({ x: start + 218, y: GROUND_Y - 76, w: 125, move: 0, phase: 0 });
      chunk.platforms.push({ x: start + 480, y: GROUND_Y - 144, w: 145, move: 0, phase: 0 });
      chunk.hazards.push({ type: 'updraft', x: start + 505, y: 255, w: 112, h: GROUND_Y - 255, phase: index });
    } else if (slot === 1) {
      chunk.gaps.push({ x: start + 285, w: 205 });
      chunk.platforms.push({ x: start + 326, y: GROUND_Y - 126, w: 125, move: 54, phase: index * .7 });
      chunk.hazards.push({ type: 'updraft', x: start + 285, y: 248, w: 205, h: GROUND_Y - 248, phase: index });
    } else {
      chunk.gaps.push({ x: start + 485, w: 105 });
      chunk.platforms.push({ x: start + 150, y: GROUND_Y - 58, w: 105, move: 0, phase: 0 });
      chunk.platforms.push({ x: start + 310, y: GROUND_Y - 118, w: 112, move: 0, phase: 0 });
      chunk.platforms.push({ x: start + 470, y: GROUND_Y - 176, w: 132, move: 22, phase: index });
      chunk.hazards.push({ type: 'rock', x: start + 345, y: GROUND_Y - 40, w: 40, h: 40, home: start + 345, range: 82, vx: 62, phase: index });
    }
  } else if (biome === 2) {
    if (slot === 0) {
      chunk.hazards.push(
        { type: 'puddle', x: start + 180, y: GROUND_Y - 8, w: 115, h: 8, phase: index },
        { type: 'puddle', x: start + 475, y: GROUND_Y - 8, w: 130, h: 8, phase: index + 1 },
      );
      chunk.platforms.push({ x: start + 325, y: GROUND_Y - 90, w: 118, move: 0, phase: 0 });
    } else if (slot === 1) {
      chunk.platforms.push({ x: start + 180, y: GROUND_Y - 105, w: 145, move: 0, phase: 0 });
      chunk.platforms.push({ x: start + 470, y: GROUND_Y - 135, w: 135, move: 18, phase: index });
      chunk.hazards.push(
        { type: 'steam', x: start + 350, y: GROUND_Y - 96, w: 40, h: 96, phase: .6 },
        { type: 'steam', x: start + 625, y: GROUND_Y - 96, w: 40, h: 96, phase: 3.2 },
      );
    } else {
      chunk.gaps.push({ x: start + 355, w: 82 });
      chunk.platforms.push({ x: start + 345, y: GROUND_Y - 86, w: 102, move: 0, phase: 0 });
      chunk.hazards.push(
        { type: 'laser', x: start + 190, y: GROUND_Y - 58, w: 96, h: 12, phase: .8 },
        { type: 'laser', x: start + 520, y: GROUND_Y - 58, w: 104, h: 12, phase: 3.6 },
      );
    }
  } else if (biome === 3) {
    if (slot === 0) {
      chunk.gaps.push({ x: start + 300, w: 145 });
      chunk.platforms.push({ x: start + 325, y: GROUND_Y - 132, w: 96, move: 35, phase: index });
      chunk.hazards.push({ type: 'spring', x: start + 238, y: GROUND_Y - 18, w: 50, h: 18, phase: index });
    } else if (slot === 1) {
      chunk.gaps.push({ x: start + 205, w: 125 }, { x: start + 505, w: 130 });
      chunk.platforms.push({ x: start + 190, y: GROUND_Y - 105, w: 150, move: 22, phase: index });
      chunk.platforms.push({ x: start + 490, y: GROUND_Y - 155, w: 155, move: 38, phase: index + 2 });
      chunk.hazards.push(
        { type: 'spring', x: start + 145, y: GROUND_Y - 18, w: 50, h: 18, phase: index },
        { type: 'spring', x: start + 445, y: GROUND_Y - 18, w: 50, h: 18, phase: index + 1 },
      );
    } else {
      chunk.gaps.push({ x: start + 410, w: 155 });
      chunk.platforms.push({ x: start + 405, y: GROUND_Y - 125, w: 165, move: 30, phase: index });
      chunk.hazards.push(
        { type: 'laser', x: start + 185, y: GROUND_Y - 58, w: 110, h: 12, phase: 1.4 },
        { type: 'spring', x: start + 345, y: GROUND_Y - 18, w: 50, h: 18, phase: index },
      );
    }
  }

  for (let i = 0; i < 5; i++) {
    chunk.decor.push({ x: start + 80 + i * 135 + (index * 31 + i * 17) % 45, size: .7 + ((index + i) % 4) * .12 });
  }

  Game.chunks.push(chunk);
  Game.generatedTo += CHUNK_W;

  const bossChunk = index > 0 && index % 8 === 7;
  const formation = stage.foes;
  const count = bossChunk ? 1 : Game.difficulty === 'easy' ? Math.max(1, formation.length - 1) : formation.length;
  for (let i = 0; i < count; i++) {
    const [plannedType, offset] = bossChunk ? ['boss', 520] : formation[i];
    let x = start + offset;
    while (isGap(chunk, x) && x < start + CHUNK_W - 100) x += 45;
    Game.enemies.push(makeEnemy(plannedType, Math.min(x, start + CHUNK_W - 100), index));
  }
  if (!bossChunk && Game.difficulty === 'hard' && index > 1) {
    Game.enemies.push(makeEnemy('beetle', start + CHUNK_W - 70, index));
  }
  if (!bossChunk && index > 0 && slot === 1) {
    const capsule = makeEnemy('capsule', start + 520, index);
    capsule.dropType = ['spread', 'rapid', 'shield'][Math.floor(index / 3) % 3];
    Game.enemies.push(capsule);
  }
}

let worldGenBudget = 0;   // 运行时每帧限2个chunk防尖峰; 初始化/自检传Infinity
function ensureWorld(targetX, budget) {
  const cap = budget == null ? worldGenBudget : budget;
  let used = 0;
  while (Game.generatedTo < targetX && used < cap) { generateChunk(); used++; }
}

function findSafeSpot(candidate) {
  ensureWorld(candidate + 260);
  for (let offset = 0; offset < 420; offset += 32) {
    const x = candidate + offset;
    const chunk = chunkAt(x);
    const platform = chunk && chunk.platforms.find((item) => !item.move && x > item.x + 18 && x < item.x + item.w - 18);
    if (platform && offset % 64 === 0) return { x, y: platform.y - 42 };
    if (groundAt(x) !== null) return { x, y: GROUND_Y - 42 };
  }
  return { x: candidate, y: GROUND_Y - 130 };
}

function buildSessionWords() {
  const pool = wordBank().slice();
  const count = Math.min(8, pool.length);
  for (let i = 0; i < count; i++) {
    const pick = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[pick]] = [pool[pick], pool[i]];
  }
  return pool.slice(0, count);
}

function nextWord(initial) {
  if (!Game.sessionWords.length) Game.sessionWords = buildSessionWords();
  const item = Game.sessionWords[Game.sessionWordIndex++ % Game.sessionWords.length];
  Game.lastWord = item.en;
  Game.currentWord = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  Game.pickups = [];
  const start = Game.player.x + (initial ? 320 : 470);
  [...Game.currentWord.en].forEach((letter, index) => {
    const spot = findSafeSpot(start + index * 145);
    Game.pickups.push({ ...spot, w: 30, h: 34, letter, index, taken: false });
  });
  showFeedback(initial ? '按顺序收集字母，前线会不断延伸' : '新单词已投放到前方');
  updateHud();
}

function resetPlayer(x) {
  Object.assign(Game.player, {
    x: x == null ? 70 : x, y: GROUND_Y - PLAYER_H, w: 30, h: PLAYER_H, vx: 0, vy: 0,
    facing: 1, onGround: true, coyote: .1, inv: 1.15, fireCooldown: 0, dropTimer: 0,
    crouching: false, aimX: 1, aimY: 0, landingTimer: 0, skidTimer: 0, hurtTimer: 0,
    runCycle: 0, stepTimer: 0, recoil: 0, muzzleFlash: 0,
    weapon: 'normal', weaponTimer: 0, shield: 0, overdrive: 0, combo: 0, comboTimer: 0,
  });
}

function startGame(mode = Game.mode) {
  Game.mode = mode === 'arcade' ? 'arcade' : 'mission';
  // 任务模式: 从菜单选中的关卡开始; 街机/过关链: 保持当前关
  if (mode === 'mission' && Game.state === 'menu') {
    Game.missionLevel = clamp(Game.selectedLevel || 0, 0, MISSION_LEVELS.length - 1);
  }
  MISSION_BEATS = MISSION_LEVELS[Game.missionLevel].beats;
  Object.assign(Game, {
    state: 'playing', score: 0, wordsDone: 0, hp: 3, distance: 0, maxX: 70,
    camera: 0, checkpoint: 70, time: 0, feedbackTimer: 0, hudTimer: 0, lastWord: '',
    currentWord: null, wordEcho: null, generatedTo: 0, nextChunkIndex: 0, enteredChunk: -1,
    reinforcementTimer: 4.5, reinforcementCount: 0, stageBanner: null,
    hitStop: 0, shake: 0, shakeStrength: 0, flash: 0, victoryTimer: 0,
    sessionWords: [], sessionWordIndex: 0, completedWords: [], recalledWords: [], recallResults: [], wordGate: null,
    bossNodes: [], bossNodeProgress: 0, bossGateDone: false, bossWord: null,
  });
  for (const list of [Game.chunks, Game.pickups, Game.powerups, Game.enemies, Game.bullets, Game.enemyBullets, Game.particles]) list.length = 0;
  resetInput();
  resetPlayer(70);
  ensureWorld(VIEW_W * 3, Infinity);
  nextWord(true);
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('word-gate').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch-controls').classList.remove('hidden');
  if (window.ArcadeAudio) {
    ArcadeAudio.start();
    ArcadeAudio.stopBgm();   // 停掉旧ogg循环, 避免与ChipMusic双音乐
  }
  // 芯片配乐：任务=丛林行动曲
  if (window.ChipMusic) ChipMusic.play('ranger-stage');
  updateHud();
}

function resetInput() {
  input.left = input.right = input.up = input.down = input.fire = input.jumpHeld = false;
  input.jumpBuffer = 0;
  document.querySelectorAll('#touch-controls button').forEach((button) => button.classList.remove('active'));
}

function togglePause() {
  if (Game.state === 'playing') {
    Game.state = 'paused';
    resetInput();
    $('paused').classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    $('paused').classList.add('hidden');
    lastTime = performance.now();
  }
}

function backToMenu() {
  Game.state = 'menu';
  resetInput();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('over').classList.add('hidden');
  $('word-gate').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

function renderRecap() {
  const recap = $('over-recap');
  recap.replaceChildren();
  for (const word of Game.completedWords.slice(-8)) {
    const item = document.createElement('span');
    item.textContent = word.en + ' · ' + word.zh;
    recap.append(item);
  }
}

function finishRun(victory) {
  Game.state = 'over';
  resetInput();
  if (!victory && window.ChipMusic) ChipMusic.stop();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('word-gate').classList.add('hidden');
  $('over').classList.remove('hidden');
  const lvName = (MISSION_LEVELS[Game.missionLevel] || MISSION_LEVELS[0]).name;
  if (victory) {
    const allClear = Game.missionLevel >= MISSION_LEVELS.length - 1;
    $('over-kicker').textContent = allClear ? '全线告捷 · 三关通关' : lvName + ' 完成';
    $('over-title').textContent = allClear ? '你是单词突击之王！' : MISSION_LEVELS[Game.missionLevel].bossName + ' 已被击败';
  } else {
    $('over-kicker').textContent = lvName;
    $('over-title').textContent = '再向前一点';
  }
  const key = 'word-ranger-highscore-' + Game.mode + '-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(high)); }
  } catch (e) { /* local storage may be unavailable */ }
  const correct = Game.recallResults.filter((result) => result.correct).length;
  $('over-stats').innerHTML =
    '<div><span>本局得分</span><b>' + Game.score + '</b></div>' +
    '<div><span>完成单词</span><b>' + Game.wordsDone + '</b></div>' +
    '<div><span>主动回忆</span><b>' + correct + ' / ' + Game.recallResults.length + '</b></div>' +
    '<div><span>推进里程</span><b>' + Game.distance + ' m</b></div>' +
    '<div><span>最高纪录</span><b>' + high + '</b></div>';
  renderRecap();
}

function gameOver() { finishRun(false); }
function missionComplete() { finishRun(true); }

// 魂斗罗式过关: 分数继承, HP+1奖励(上限5), 进入下一关
function advanceLevel() {
  Game.missionLevel = Math.min(MISSION_LEVELS.length - 1, Game.missionLevel + 1);
  MISSION_BEATS = MISSION_LEVELS[Game.missionLevel].beats;
  const keepScore = Game.score, keepWords = Game.wordsDone,
        keepCompleted = Game.completedWords.slice(), keepMastery = Game.recallResults.slice(),
        nextLv = Game.missionLevel;
  Object.assign(Game, {
    hp: Math.min(5, Game.hp + 1), distance: 0, maxX: 70,
    camera: 0, checkpoint: 70, time: 0, feedbackTimer: 0, hudTimer: 0,
    generatedTo: 0, nextChunkIndex: 0, enteredChunk: -1,
    reinforcementTimer: 4.5, reinforcementCount: 0, stageBanner: null,
    hitStop: 0, shake: 0, shakeStrength: 0, flash: 0, victoryTimer: 0,
    bossNodes: [], bossNodeProgress: 0, bossGateDone: false, bossWord: null,
    wordGate: null,
  });
  for (const list of [Game.chunks, Game.pickups, Game.powerups, Game.enemies, Game.bullets, Game.enemyBullets]) list.length = 0;
  Game.score = keepScore; Game.wordsDone = keepWords;
  Game.completedWords = keepCompleted; Game.recallResults = keepMastery;
  resetInput();
  resetPlayer(70);
  ensureWorld(VIEW_W * 3);
  nextWord(false);
  Game.state = 'playing';
  Game.stageBanner = { tag: 'TEST', name: MISSION_LEVELS[nextLv].name, hint: '分数延续 · 士气如虹', timer: 3 };
  if (window.ChipMusic) ChipMusic.play(MISSION_LEVELS[nextLv].music);
  updateHud();
}

function queueJump() {
  if (Game.state !== 'playing') return;
  input.jumpBuffer = .14;
  input.jumpHeld = true;
}

function shoot() {
  const player = Game.player;
  if (player.fireCooldown > 0 || Game.state !== 'playing') return;
  const aim = shotDirection();
  const centerX = player.x + player.w / 2;
  const centerY = player.y + player.h * (player.crouching ? .38 : .43);
  const muzzleX = centerX + aim.x * 28;
  const muzzleY = centerY + aim.y * 28;
  player.fireCooldown = player.overdrive > 0 ? .065 : player.weapon === 'rapid' ? .085 : .14;
  player.aimX = aim.x;
  player.aimY = aim.y;
  player.recoil = .09;
  player.muzzleFlash = .055;
  player.muzzleX = muzzleX;
  player.muzzleY = muzzleY;
  const baseAngle = Math.atan2(aim.y, aim.x);
  const offsets = player.weapon === 'spread' ? [-.18, 0, .18] : [0];
  for (const offset of offsets) {
    const angle = baseAngle + offset;
    Game.bullets.push({
      x: muzzleX - 4, y: muzzleY - 4, w: 8, h: 8,
      vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
    });
  }
  burst(muzzleX, muzzleY, '#f4d37a', 3);
  // 射击不再全屏震动(用户反馈: 平时射击震屏干扰), 震动留给受击和爆炸
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .14, player.weapon === 'spread' ? .82 : player.weapon === 'rapid' ? 1.22 : 1);
}

function dropPowerup(enemy, type) {
  const spot = findSafeSpot(enemy.x);
  Game.powerups.push({ x: spot.x - 17, y: spot.y + 8, w: 34, h: 34, type, phase: Math.random() * TAU, taken: false });
  showFeedback('补给已落地：' + POWERUP_LABELS[type]);
}

function collectPowerup(powerup) {
  if (powerup.taken) return;
  const player = Game.player;
  powerup.taken = true;
  if (powerup.type === 'shield') {
    player.shield = 1;
  } else {
    player.weapon = powerup.type;
    player.weaponTimer = 16;
  }
  Game.score += 240;
  burst(powerup.x + 17, powerup.y + 17, '#f4d37a', 18);
  showFeedback('获得' + POWERUP_LABELS[powerup.type] + (powerup.type === 'shield' ? '，可抵挡一次攻击' : '，持续 16 秒'));
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .28);
  updateHud();
}

function defeatEnemy(enemy, source) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.state = 'dead';
  Game.hitStop = Math.max(Game.hitStop, enemy.type === 'boss' ? .11 : .055);
  Game.shake = Math.max(Game.shake, enemy.type === 'boss' ? .42 : .12);
  Game.shakeStrength = Math.max(Game.shakeStrength, enemy.type === 'boss' ? 9 : 3.5);
  if (enemy.type === 'capsule') {
    Game.score += 100;
    dropPowerup(enemy, enemy.dropType || 'spread');
    burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#f4d37a', 20);
    updateHud();
    return;
  }
  const player = Game.player;
  player.combo = player.comboTimer > 0 ? Math.min(9, player.combo + 1) : 1;
  player.comboTimer = 2.4;
  const base = enemy.type === 'boss' ? 1500 : enemy.type === 'guardian' ? 260 : 130;
  Game.score += base * Math.min(5, player.combo);
  burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#e9784f', enemy.type === 'boss' ? 42 : 18);
  if (source === 'stomp') {
    player.vy = -430;
    player.onGround = false;
  }
  if (enemy.type === 'boss') {
    if (Game.mode === 'mission') {
      const isLast = Game.missionLevel >= MISSION_LEVELS.length - 1;
      Game.victoryTimer = 1.6;
      Game.victoryNextLevel = !isLast;
      showFeedback(isLast ? MISSION_LEVELS[Game.missionLevel].bossName + ' 崩解，全线告捷！'
                          : MISSION_LEVELS[Game.missionLevel].bossName + ' 已败！进军下一关');
      if (window.ChipMusic) ChipMusic.play('victory');
    } else {
      dropPowerup(enemy, 'shield');
      showFeedback('区域守卫已击败，护盾补给已投放');
    }
  } else if (player.combo >= 3) {
    showFeedback('连续击破 ×' + player.combo);
  }
  const chunk = Game.chunks.find((item) => item.index === enemy.chunkIndex);
  if (chunk?.lock && !chunkHasThreats(chunk)) {
    chunk.cleared = true;
    if (enemy.type !== 'boss') showFeedback('封锁解除：' + chunk.encounter);
  }
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', enemy.type === 'boss' ? .38 : .14, enemy.type === 'boss' ? .62 : 1.35);
  updateHud();
}

function hurt(fell = false) {
  const player = Game.player;
  if (player.inv > 0 || Game.state !== 'playing') return;
  if (player.shield) {
    player.shield = 0;
    player.inv = .9;
    player.combo = 0;
    player.comboTimer = 0;
    Game.enemyBullets.length = 0;
    Game.hitStop = Math.max(Game.hitStop, .06);
    Game.shake = Math.max(Game.shake, .18);
    Game.shakeStrength = Math.max(Game.shakeStrength, 5);
    Game.flash = .16;
    burst(player.x + player.w / 2, player.y + player.h / 2, '#f4d37a', 22);
    showFeedback('护盾吸收了这次攻击');
    updateHud();
    return;
  }
  Game.hp--;
  Game.hitStop = Math.max(Game.hitStop, .08);
  Game.shake = Math.max(Game.shake, .28);
  Game.shakeStrength = Math.max(Game.shakeStrength, 7);
  Game.flash = .22;
  burst(player.x + player.w / 2, Math.min(player.y + player.h / 2, GROUND_Y), '#ef835e', 16);
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .22, .52);
  if (Game.hp <= 0) {
    gameOver();
    return;
  }
  Game.enemyBullets.length = 0;
  if (fell) {
    showFeedback('跌落，返回最近安全点');
    resetPlayer(Game.checkpoint);
    Game.player.hurtTimer = .32;
  } else {
    showFeedback('受到攻击，短暂无敌');
    setCrouching(false);
    Object.assign(player, {
      vx: -player.facing * 180, vy: -260, onGround: false, inv: 1.15, hurtTimer: .32,
      weapon: 'normal', weaponTimer: 0, overdrive: 0, combo: 0, comboTimer: 0,
    });
  }
  updateHud();
}

function collectLetter(pickup) {
  const word = Game.currentWord;
  if (!word || pickup.taken) return;
  if (pickup.index !== word.progress) {
    showFeedback('先收集字母 ' + word.en[word.progress]);
    return;
  }
  pickup.taken = true;
  word.progress++;
  flashWord(word, word.progress === word.en.length);
  Game.score += 50;
  burst(pickup.x + 15, pickup.y + 17, '#f4d37a', 10);
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2);
  if (word.progress === word.en.length) {
    Game.score += 300 + word.en.length * 20;
    Game.wordsDone++;
    Game.completedWords.push({ en: word.en, zh: word.zh });
    if (Game.wordsDone % 5 === 0 && Game.hp < 3) Game.hp++;
    nextWord(false);
    Game.player.overdrive = 4.5;
    showFeedback('单词完成：4.5 秒火力爆发');
    const chunk = chunkAt(Game.player.x + Game.player.w / 2);
    if (chunk?.wordGate && !chunk.gateUsed) chunk.gateUsed = openWordGate(chunk);
  } else {
    showFeedback('正确，下一个字母是 ' + word.en[word.progress]);
  }
  updateHud();
}

function showFeedback(text) {
  Game.feedbackTimer = 2.2;
  $('feedback').textContent = text;
}

function flashWord(word, complete) {
  Game.wordEcho = { en: word.en, zh: word.zh, progress: word.progress, complete, timer: complete ? 1.8 : 1.15 };
}

function saveRecallResult(word, correct, responseMs) {
  try {
    const key = 'word-ranger-mastery-v1';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const entry = data[word.en] || { correct: 0, wrong: 0, last: 0, responseMs: 0 };
    entry[correct ? 'correct' : 'wrong']++;
    entry.last = Date.now();
    entry.responseMs = Math.round(responseMs);
    data[word.en] = entry;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) { /* local storage may be unavailable */ }
}

function grantRecallReward() {
  const reward = ['spread', 'rapid', 'shield'][Math.min(2, Game.recallResults.length - 1)];
  if (reward === 'shield') Game.player.shield = 1;
  else { Game.player.weapon = reward; Game.player.weaponTimer = 18; }
  Game.player.overdrive = Math.max(Game.player.overdrive, 3);
  Game.score += 500;
  return POWERUP_LABELS[reward];
}

function openWordGate(chunk) {
  const word = Game.completedWords.slice().reverse().find((item) => !Game.recalledWords.includes(item.en));
  if (!word) return false;
  const distractors = Game.sessionWords.map((item) => item.en.toUpperCase()).filter((item) => item !== word.en).slice(0, 2);
  const options = [word.en, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const pick = Math.floor(Math.random() * (i + 1));
    [options[i], options[pick]] = [options[pick], options[i]];
  }
  Game.state = 'word-gate';
  Game.wordGate = { word, chunkIndex: chunk.index, options, startedAt: performance.now() };
  resetInput();
  $('gate-meaning').textContent = word.zh;
  const list = $('gate-options');
  list.replaceChildren();
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gate-option';
    button.textContent = option;
    button.addEventListener('click', () => answerWordGate(option));
    list.append(button);
  }
  $('word-gate').classList.remove('hidden');
  list.querySelector('button')?.focus();
  return true;
}

function answerWordGate(option) {
  if (Game.state !== 'word-gate' || !Game.wordGate) return;
  const gate = Game.wordGate;
  const correct = option === gate.word.en;
  const responseMs = performance.now() - gate.startedAt;
  Game.recalledWords.push(gate.word.en);
  Game.recallResults.push({ en: gate.word.en, correct, responseMs });
  saveRecallResult(gate.word, correct, responseMs);
  let feedback;
  if (correct) {
    feedback = '主动回忆正确：获得' + grantRecallReward();
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .32, 1.08);
  } else {
    Game.player.combo = Game.player.comboTimer = 0;
    let x = Game.player.x + 300;
    while (groundAt(x) === null && x < Game.player.x + 520) x += 32;
    const chunk = chunkAt(x);
    if (chunk) Game.enemies.push(makeEnemy('leaper', x, chunk.index));
    feedback = '正确答案是 ' + gate.word.en + '，前方出现增援';
    if (window.ArcadeAudio) ArcadeAudio.play('laser', .18, .62);
  }
  Game.wordGate = null;
  Game.state = 'playing';
  $('word-gate').classList.add('hidden');
  showFeedback(feedback);
  lastTime = performance.now();
  accumulator = 0;
  updateHud();
}

function updateHud() {
  $('score').textContent = Game.score;
  $('words').textContent = Game.wordsDone;
  $('lives').textContent = Game.hp;
  $('distance').textContent = Game.distance + 'm';
  const chunk = chunkAt(Game.player.x + Game.player.w / 2);
  $('biome').textContent = Game.mode === 'mission' && chunk
    ? (MISSION_LEVELS[Game.missionLevel] ? MISSION_LEVELS[Game.missionLevel].name.split(' · ')[0] + ' ' : '') + Math.min(MISSION_BEATS.length, chunk.index + 1) + '/' + MISSION_BEATS.length + ' ' + chunk.encounter
    : BIOMES[biomeIndexAt(Game.player.x)].name;
  const word = Game.currentWord;
  if (word) {
    $('word-meaning').textContent = word.zh;
    $('word-progress').textContent = [...word.en].map((letter, index) => index < word.progress ? letter : '_').join(' ');
    if (Game.feedbackTimer <= 0) $('feedback').textContent = Game.mode === 'mission' ? '观察预兆 · 选择解法 · 记住单词' : '按顺序收集字母 · 射击清理道路';
  }
}

function updatePlayer(dt) {
  const conf = DIFFICULTIES[Game.difficulty];
  const player = Game.player;
  const biomeIndex = biomeIndexAt(player.x);
  const biome = BIOMES[biomeIndex];
  const wasOnGround = player.onGround;
  input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.inv = Math.max(0, player.inv - dt);
  player.dropTimer = Math.max(0, player.dropTimer - dt);
  player.landingTimer = Math.max(0, player.landingTimer - dt);
  player.skidTimer = Math.max(0, player.skidTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.recoil = Math.max(0, player.recoil - dt);
  player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
  player.weaponTimer = Math.max(0, player.weaponTimer - dt);
  player.overdrive = Math.max(0, player.overdrive - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  if (!player.weaponTimer) player.weapon = 'normal';
  if (!player.comboTimer) player.combo = 0;
  player.coyote = player.onGround ? .11 : Math.max(0, player.coyote - dt);

  const move = Number(input.right) - Number(input.left);
  setCrouching(Boolean(input.down && !move && player.onGround));
  if (move) player.facing = move;
  if (move && Math.sign(player.vx) !== move && Math.abs(player.vx) > 105) player.skidTimer = .16;
  player.vx = approach(player.vx, player.crouching ? 0 : move * conf.speed, (move ? 1500 : 2100) * biome.traction * dt);
  if (!player.onGround && biomeIndex === 1) player.vx += Math.sin(Game.time * 1.1) * 58 * dt;
  player.runCycle = (player.runCycle + Math.abs(player.vx) * dt / 30) % 4;
  const aim = aimDirection();
  if (input.up || input.down || move || player.fireCooldown <= 0) {
    player.aimX = aim.x;
    player.aimY = aim.y;
  }
  if (input.jumpBuffer > 0 && player.coyote > 0) {
    const dropping = input.down && !move && player.y + player.h < GROUND_Y - 4;
    setCrouching(false);
    player.vy = dropping ? 110 : biomeIndex === 3 ? -505 : -610;
    player.onGround = false;
    player.coyote = 0;
    player.dropTimer = dropping ? .18 : 0;
    input.jumpBuffer = 0;
    if (!dropping && window.ArcadeAudio) ArcadeAudio.play('jump', .22);
  }
  if (!input.jumpHeld && player.vy < -180) player.vy += biome.gravity * .72 * dt;

  player.x += player.vx * dt;
  player.x = Math.max(Math.max(0, Game.camera - 130), player.x);
  if (Game.mode === 'mission') {
    const locked = Game.chunks.find((chunk) => chunk.lock && !chunk.cleared && chunkHasThreats(chunk) && player.x >= chunk.start && player.x < chunk.start + CHUNK_W);
    if (locked) player.x = Math.min(player.x, locked.start + CHUNK_W - 74);
  }
  const previousBottom = player.y + player.h;
  player.vy += biome.gravity * dt;
  player.y += player.vy * dt;
  const fallingSpeed = player.vy;
  player.onGround = false;

  for (const chunk of player.dropTimer > 0 ? [] : Game.chunks) {
    if (chunk.start > player.x + player.w || chunk.start + CHUNK_W < player.x) continue;
    for (const platform of chunk.platforms) {
      const top = platformTop(platform);
      if (player.vy >= 0 && player.x + player.w > platform.x && player.x < platform.x + platform.w && previousBottom <= top + 12 && player.y + player.h >= top) {
        player.y = top - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
  }
  if (player.y + player.h >= GROUND_Y && groundAt(player.x + player.w / 2) !== null) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  }
  if (!wasOnGround && player.onGround && fallingSpeed > 180) {
    player.landingTimer = .12;
    burst(player.x + player.w / 2, player.y + player.h, '#c7b37d', 9);
    Game.shake = Math.max(Game.shake, .09);
    Game.shakeStrength = Math.max(Game.shakeStrength, fallingSpeed > 520 ? 4 : 2);
    if (window.ArcadeAudio) ArcadeAudio.play('click', fallingSpeed > 520 ? .16 : .08, fallingSpeed > 520 ? .62 : .78);
  }
  if (player.y > VIEW_H + 90) hurt(true);
  if (player.onGround && Math.abs(player.vx) > 80) {
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      player.stepTimer = .22;
      burst(player.x + player.w / 2 - player.facing * 8, player.y + player.h, '#b8a878', 2);
    }
  } else {
    player.stepTimer = 0;
  }
  if (input.fire || Game.autoFire) shoot();

  for (const pickup of Game.pickups) {
    if (!pickup.taken && overlap(player, pickup)) collectLetter(pickup);
  }
  for (const powerup of Game.powerups) {
    if (!powerup.taken && overlap(player, powerup)) collectPowerup(powerup);
  }
  const needed = Game.pickups.find((pickup) => !pickup.taken && pickup.index === Game.currentWord.progress);
  if (needed && needed.x < player.x - VIEW_W * .75) {
    Object.assign(needed, findSafeSpot(player.x + 220));
    showFeedback('漏掉的字母已移动到前方');
  }
}

function hazardActive(hazard) {
  return Math.sin(Game.time * 2.35 + hazard.phase) > -.22;
}

function updateHazards(dt) {
  const player = Game.player;
  for (const chunk of Game.chunks) {
    if (chunk.start > Game.camera + VIEW_W + 300 || chunk.start + CHUNK_W < Game.camera - 200) continue;
    for (const hazard of chunk.hazards) {
      if (hazard.type === 'rock') {
        hazard.x += hazard.vx * dt;
        if (hazard.x < hazard.home - hazard.range || hazard.x > hazard.home + hazard.range) hazard.vx *= -1;
      }
      if (!overlap(player, hazard)) continue;
      if (hazard.type === 'updraft' && !player.onGround) {
        player.vy = Math.max(-390, player.vy - 1180 * dt);
      } else if (hazard.type === 'puddle' && player.onGround) {
        player.vx *= Math.max(0, 1 - 2.4 * dt);
      } else if (hazard.type === 'spring' && player.vy >= 0) {
        player.vy = -720;
        player.onGround = false;
        burst(player.x + player.w / 2, GROUND_Y - 8, '#e7bd58', 12);
        if (window.ArcadeAudio) ArcadeAudio.play('jump', .18);
      } else if ((hazard.type === 'rock' || hazardActive(hazard)) && hazard.type !== 'updraft' && hazard.type !== 'puddle' && hazard.type !== 'spring') {
        hurt();
      }
    }
  }
}

function setEnemyState(enemy, state, duration) {
  enemy.state = state;
  enemy.stateTimer = duration;
  if (state === 'telegraph' && enemy.x > Game.camera - 80 && enemy.x < Game.camera + VIEW_W + 80 && window.ArcadeAudio) {
    ArcadeAudio.play('confirm', enemy.type === 'boss' ? .16 : .07, enemy.type === 'boss' ? .55 : .78);
  }
}

function fireEnemyVolley(enemy, offsets, speed) {
  const originX = enemy.x + enemy.w / 2;
  const originY = enemy.y + enemy.h * .42;
  const targetX = enemy.targetX == null ? Game.player.x + Game.player.w / 2 : enemy.targetX;
  const targetY = enemy.targetY == null ? Game.player.y + Game.player.h / 2 : enemy.targetY;
  const base = Math.atan2(targetY - originY, targetX - originX);
  for (const offset of offsets) {
    const angle = base + offset;
    Game.enemyBullets.push({ x: originX - 5, y: originY - 4, w: 10, h: 8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }
  burst(originX, originY, '#ef835e', 5);
  if (window.ArcadeAudio) ArcadeAudio.play('laser', enemy.type === 'boss' ? .22 : .11, enemy.type === 'boss' ? .66 : .78);
}

function moveGroundEnemy(enemy, dt) {
  const nextX = enemy.x + enemy.vx * dt;
  if (enemy.floorY < GROUND_Y || groundAt(nextX + enemy.w / 2) !== null) enemy.x = nextX;
  else { enemy.vx = 0; setEnemyState(enemy, 'recover', .45); }
}

function bossNodeRect(node, boss) {
  const bob = Math.sin(Game.time * 3.4 + node.phase) * 6;
  return { x: boss.x + boss.w / 2 + node.ox - 18, y: boss.y + node.oy + bob, w: 36, h: 36 };
}

function startBossShield(boss) {
  const candidates = [...Game.completedWords].reverse().concat(Game.currentWord || [], Game.sessionWords);
  const source = candidates.find((item) => new Set(item.en.toUpperCase()).size >= 3) || candidates[0];
  const word = { en: source.en.toUpperCase(), zh: source.zh };
  const letters = [...word.en];
  const indices = letters.map((letter, index) => ({ letter, index })).filter((item, index, list) => list.findIndex((other) => other.letter === item.letter) === index).slice(0, 3);
  const entries = indices.map((item, order) => ({ letter: item.letter, order }));
  const distractor = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((letter) => !letters.includes(letter));
  entries.push({ letter: distractor, order: -1 });
  for (let i = entries.length - 1; i > 0; i--) {
    const pick = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[pick]] = [entries[pick], entries[i]];
  }
  const positions = [{ ox: -126, oy: -62 }, { ox: -44, oy: -112 }, { ox: 44, oy: -112 }, { ox: 126, oy: -62 }];
  Game.bossWord = { en: word.en, zh: word.zh };
  Game.bossNodes = entries.map((entry, index) => ({ ...entry, ...positions[index], active: true, phase: index * 1.7 }));
  Game.bossNodeProgress = 0;
  boss.bossPhase = 2;
  boss.vx = 0;
  setEnemyState(boss, 'shield', Infinity);
  Game.stageBanner = { tag: 'WORD_GATE', name: '护盾口令：' + word.zh, hint: '按英文顺序击破三个正确节点', timer: 3.2 };
}

function hitBossNode(node, boss) {
  if (node.order === Game.bossNodeProgress) {
    node.active = false;
    Game.bossNodeProgress++;
    burst(bossNodeRect(node, boss).x + 18, bossNodeRect(node, boss).y + 18, '#8de0b5', 16);
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2, 1 + Game.bossNodeProgress * .1);
    if (Game.bossNodeProgress >= 3) {
      Game.bossGateDone = true;
      boss.bossPhase = 3;
      boss.cooldown = .8;
      setEnemyState(boss, 'recover', .85);
      Game.player.overdrive = 6;
      Game.score += 900;
      Game.recallResults.push({ en: Game.bossWord.en, correct: true, responseMs: 0 });
      saveRecallResult(Game.bossWord, true, 0);
      showFeedback('口令正确：首领弱点开放，火力爆发 6 秒');
    }
    return;
  }
  Game.bossNodeProgress = 0;
  Game.bossNodes.forEach((item) => { item.active = true; });
  boss.hp = Math.min(boss.maxHp, boss.hp + 1);
  const chunk = Game.chunks.find((item) => item.index === boss.chunkIndex);
  if (chunk && Game.enemies.filter((enemy) => !enemy.dead && enemy.type === 'leaper').length < 2) {
    Game.enemies.push(makeEnemy('leaper', Math.max(chunk.start + 100, boss.x - 260), chunk.index));
  }
  Game.player.combo = Game.player.comboTimer = 0;
  showFeedback('口令顺序错误：护盾恢复并呼叫增援');
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .2, .58);
}

function updateBoss(enemy, dt, dx, dy, conf) {
  if (enemy.bossPhase === 1 && enemy.hp <= enemy.maxHp * .66 && !Game.bossGateDone) startBossShield(enemy);
  if (enemy.bossPhase === 2) return;
  if (enemy.state === 'idle') {
    enemy.vx = Math.abs(dx) > 260 ? Math.sign(dx) * conf.enemySpeed * .5 : 0;
    moveGroundEnemy(enemy, dt);
    if (enemy.cooldown <= 0 && Math.abs(dx) < 680) {
      enemy.attackKind = enemy.attackIndex++ % 3;
      enemy.targetX = Game.player.x + Game.player.w / 2;
      enemy.targetY = Game.player.y + Game.player.h / 2;
      enemy.facing = Math.sign(dx || -1);
      enemy.vx = 0;
      setEnemyState(enemy, 'telegraph', enemy.bossPhase === 3 ? .38 : .58);
    }
  } else if (enemy.state === 'telegraph' && enemy.stateTimer <= 0) {
    if (enemy.attackKind === 0) fireEnemyVolley(enemy, enemy.bossPhase === 3 ? [-.24, -.08, .08, .24] : [-.14, 0, .14], enemy.bossPhase === 3 ? 330 : 285);
    else if (enemy.attackKind === 1) enemy.vx = enemy.facing * (enemy.bossPhase === 3 ? 360 : 300);
    else {
      Game.enemyBullets.push(
        { x: enemy.x + enemy.w / 2, y: GROUND_Y - 15, w: 16, h: 8, vx: -320, vy: 0 },
        { x: enemy.x + enemy.w / 2, y: GROUND_Y - 15, w: 16, h: 8, vx: 320, vy: 0 },
      );
      Game.shake = .22; Game.shakeStrength = 7;
    }
    setEnemyState(enemy, 'attack', enemy.attackKind === 1 ? .48 : .22);
  } else if (enemy.state === 'attack') {
    if (enemy.attackKind === 1) moveGroundEnemy(enemy, dt);
    if (enemy.stateTimer <= 0) { enemy.vx = 0; setEnemyState(enemy, 'recover', enemy.bossPhase === 3 ? .42 : .68); }
  } else if (enemy.state === 'recover' && enemy.stateTimer <= 0) {
    enemy.cooldown = enemy.bossPhase === 3 ? .55 : .9;
    setEnemyState(enemy, 'idle', 0);
  }
}

function updateEnemies(dt) {
  const conf = DIFFICULTIES[Game.difficulty];
  const player = Game.player;
  for (const enemy of Game.enemies) {
    if (enemy.dead || enemy.x < Game.camera - 500 || enemy.x > Game.camera + VIEW_W + 650) continue;
    enemy.hit = Math.max(0, enemy.hit - dt);
    enemy.stun = Math.max(0, enemy.stun - dt);
    enemy.cooldown -= dt;
    if (Number.isFinite(enemy.stateTimer)) enemy.stateTimer = Math.max(0, enemy.stateTimer - dt);
    const dx = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
    const dy = player.y + player.h / 2 - (enemy.y + enemy.h / 2);
    if (enemy.state !== 'attack') enemy.facing = Math.sign(dx || enemy.facing || -1);
    if (enemy.stun > 0) {
      enemy.x += (enemy.knockback || 0) * dt;
      enemy.knockback = approach(enemy.knockback || 0, 0, 900 * dt);
      continue;
    }

    if (enemy.type === 'capsule') {
      enemy.y = enemy.baseY + Math.sin(Game.time * 2.8 + enemy.phase) * 22;
    } else if (enemy.type === 'boss') {
      updateBoss(enemy, dt, dx, dy, conf);
    } else if (enemy.type === 'beetle') {
      if (enemy.state === 'idle') {
        enemy.vx = enemy.facing * conf.enemySpeed * .48;
        moveGroundEnemy(enemy, dt);
        if (enemy.cooldown <= 0 && Math.abs(dx) < 270) { enemy.vx = 0; setEnemyState(enemy, 'telegraph', .42); }
      } else if (enemy.state === 'telegraph' && enemy.stateTimer <= 0) {
        enemy.vx = enemy.facing * conf.enemySpeed * 4.4;
        setEnemyState(enemy, 'attack', .36);
      } else if (enemy.state === 'attack') {
        moveGroundEnemy(enemy, dt);
        if (enemy.stateTimer <= 0) { enemy.vx = 0; setEnemyState(enemy, 'recover', .52); }
      } else if (enemy.state === 'recover' && enemy.stateTimer <= 0) {
        enemy.cooldown = 1.05; setEnemyState(enemy, 'idle', 0);
      }
    } else if (enemy.type === 'leaper') {
      if (enemy.state === 'idle' && enemy.cooldown <= 0 && Math.abs(dx) < 340) {
        enemy.vx = 0; setEnemyState(enemy, 'telegraph', .52);
      } else if (enemy.state === 'telegraph' && enemy.stateTimer <= 0) {
        enemy.vx = enemy.facing * conf.enemySpeed * 3;
        enemy.vy = -470; enemy.onGround = false; setEnemyState(enemy, 'attack', 1.2);
      } else if (enemy.state === 'attack') {
        enemy.x += enemy.vx * dt; enemy.vy += 1450 * dt; enemy.y += enemy.vy * dt;
        if (enemy.y + enemy.h >= enemy.floorY) {
          enemy.y = enemy.floorY - enemy.h; enemy.vx = enemy.vy = 0; enemy.onGround = true; setEnemyState(enemy, 'recover', .56);
        }
      } else if (enemy.state === 'recover' && enemy.stateTimer <= 0) {
        enemy.cooldown = 1.1; setEnemyState(enemy, 'idle', 0);
      }
    } else if (enemy.type === 'guardian') {
      if (enemy.state === 'idle') {
        enemy.vx = Math.abs(dx) > 150 ? enemy.facing * conf.enemySpeed * .38 : 0;
        moveGroundEnemy(enemy, dt);
        if (enemy.cooldown <= 0 && Math.abs(dx) < 470) {
          enemy.vx = 0; enemy.targetX = player.x; enemy.targetY = player.y + player.h * .45; setEnemyState(enemy, 'telegraph', .58);
        }
      } else if (enemy.state === 'telegraph' && enemy.stateTimer <= 0) {
        fireEnemyVolley(enemy, [-.035, .035], 235); setEnemyState(enemy, 'attack', .18);
      } else if (enemy.state === 'attack' && enemy.stateTimer <= 0) {
        setEnemyState(enemy, 'recover', .72);
      } else if (enemy.state === 'recover' && enemy.stateTimer <= 0) {
        enemy.cooldown = 1.1; setEnemyState(enemy, 'idle', 0);
      }
    } else if (enemy.type === 'turret') {
      if (enemy.state === 'idle' && enemy.cooldown <= 0 && Math.abs(dx) < 560) {
        enemy.targetX = player.x + player.w / 2; enemy.targetY = player.y + player.h / 2; setEnemyState(enemy, 'telegraph', .68);
      } else if (enemy.state === 'telegraph' && enemy.stateTimer <= 0) {
        fireEnemyVolley(enemy, [0], 315); setEnemyState(enemy, 'attack', .16);
      } else if (enemy.state === 'attack' && enemy.stateTimer <= 0) {
        setEnemyState(enemy, 'recover', .92);
      } else if (enemy.state === 'recover' && enemy.stateTimer <= 0) {
        enemy.cooldown = .72; setEnemyState(enemy, 'idle', 0);
      }
    } else if (enemy.type === 'drone') {
      if (enemy.state === 'idle') {
        enemy.y = enemy.baseY + Math.sin(Game.time * 2.2 + enemy.phase) * 28;
        if (enemy.cooldown <= 0 && Math.abs(dx) < 480) {
          enemy.targetX = player.x + player.w / 2; enemy.targetY = Math.min(GROUND_Y - 20, player.y + player.h / 2);
          setEnemyState(enemy, 'telegraph', .52);
        }
      } else if (enemy.state === 'telegraph' && enemy.stateTimer <= 0) {
        enemy.vx = (enemy.targetX - enemy.x) / .46; enemy.vy = (enemy.targetY - enemy.y) / .46; setEnemyState(enemy, 'attack', .46);
      } else if (enemy.state === 'attack') {
        enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
        if (enemy.stateTimer <= 0) { enemy.vx = enemy.vy = 0; setEnemyState(enemy, 'recover', .72); }
      } else if (enemy.state === 'recover') {
        enemy.x = approach(enemy.x, enemy.home, 180 * dt); enemy.y = approach(enemy.y, enemy.baseY, 220 * dt);
        if (enemy.stateTimer <= 0) { enemy.cooldown = 1.15; setEnemyState(enemy, 'idle', 0); }
      }
    }

    if (overlap(player, enemy)) {
      if ((enemy.type === 'beetle' || enemy.type === 'leaper') && player.vy > 100 && player.y + player.h < enemy.y + enemy.h * .62) defeatEnemy(enemy, 'stomp');
      else if (enemy.type !== 'capsule') hurt();
    }
  }
}

function updateReinforcements(dt) {
  if (Game.mode === 'mission') return;
  Game.reinforcementTimer -= dt;
  if (Game.reinforcementTimer > 0) return;
  const conf = DIFFICULTIES[Game.difficulty];
  const armed = Game.player.weapon !== 'normal' || Game.player.overdrive > 0;
  Game.reinforcementTimer = clamp((5.6 - Game.wordsDone * .12 - (armed ? .7 : 0)) / conf.spawn, 2.5, 5.6) + Math.random();
  if (Game.player.x < 900) return;
  const nearby = Game.enemies.filter((enemy) => !enemy.dead && enemy.type !== 'capsule' && enemy.x > Game.camera - 80 && enemy.x < Game.camera + VIEW_W + 120).length;
  if (nearby >= (Game.difficulty === 'hard' ? 6 : 5)) return;
  let x = Game.camera + VIEW_W + 70;
  ensureWorld(x + 100);
  const type = Game.wordsDone > 1 && Game.reinforcementCount % 4 === 3 ? 'drone' : 'beetle';
  if (type === 'beetle') while (groundAt(x) === null && x < Game.camera + VIEW_W + 350) x += 32;
  const chunk = chunkAt(x);
  if (!chunk || (type === 'beetle' && groundAt(x) === null)) return;
  const enemy = makeEnemy(type, x, chunk.index);
  enemy.vx = -Math.abs(enemy.vx);
  enemy.range = 190;
  Game.enemies.push(enemy);
  Game.reinforcementCount++;
}

function enemyBlocksBullet(enemy, bullet) {
  // 护盾阶段boss本体不再挡弹: 中间两个节点与boss矩形重叠,
  // 旧逻辑会让子弹在到达节点前被boss吞掉(实测死局)。
  // 错误节点的惩罚机制(hitBossNode里)已足够防乱射。
  if (enemy.type === 'boss') return false;
  // Boss护盾战期间 guardian 不挡弹(防止小怪卡死节点射击)
  const bossShielding = Game.enemies.some((e) => e.type === 'boss' && !e.dead && e.bossPhase === 2);
  if (bossShielding && enemy.type === 'guardian') return false;
  if (enemy.type !== 'guardian' || enemy.state === 'recover') return false;
  const fromFront = Math.sign(bullet.vx || 1) === -enemy.facing;
  const plunging = bullet.vy > 120 && bullet.y < enemy.y + enemy.h * .38;
  return fromFront && !plunging;
}

function damageEnemy(enemy, bullet) {
  if (enemyBlocksBullet(enemy, bullet)) {
    burst(bullet.x, bullet.y, '#b9e3d6', 8);
    Game.hitStop = Math.max(Game.hitStop, .025);
    if (window.ArcadeAudio) ArcadeAudio.play('click', .12, 1.5);
    return;
  }
  enemy.hp--;
  enemy.hit = .12;
  enemy.stun = .055;
  enemy.knockback = Math.sign(bullet.vx || 1) * (enemy.type === 'boss' ? 28 : 95);
  Game.hitStop = Math.max(Game.hitStop, .05);
  Game.shake = Math.max(Game.shake, .055);
  Game.shakeStrength = Math.max(Game.shakeStrength, 2.5);
  burst(bullet.x, bullet.y, '#f4d37a', 7);
  if (window.ArcadeAudio) ArcadeAudio.play('click', .08, enemy.type === 'guardian' || enemy.type === 'boss' ? .82 : 1.3);
  if (enemy.hp <= 0) defeatEnemy(enemy, 'shot');
}

function updateProjectiles(dt) {
  for (let i = Game.bullets.length - 1; i >= 0; i--) {
    const bullet = Game.bullets[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(bullet.vx, bullet.vy) * dt / 10));
    let hit = false;
    for (let step = 0; step < steps && !hit; step++) {
      bullet.x += bullet.vx * dt / steps;
      bullet.y += bullet.vy * dt / steps;
      const boss = Game.enemies.find((enemy) => enemy.type === 'boss' && !enemy.dead && enemy.bossPhase === 2);
      if (boss) {
        // 只检测"当前应击节点": 节点间距离近, 全开判定会让子弹误触错误节点
        // (实测: 打节点1的弹道穿过节点0 => progress被重置, 死循环)
        const node = Game.bossNodes.find((item) => item.active && item.order === Game.bossNodeProgress
          && overlap(bullet, bossNodeRect(item, boss)));
        if (node) { hitBossNode(node, boss); hit = true; break; }
      }
      for (const enemy of Game.enemies) {
        if (enemy.dead || !overlap(bullet, enemy)) continue;
        damageEnemy(enemy, bullet);
        hit = true;
        break;
      }
    }
    if (hit || bullet.x < Game.camera - 80 || bullet.x > Game.camera + VIEW_W + 100 || bullet.y < -80 || bullet.y > VIEW_H + 80) Game.bullets.splice(i, 1);
  }

  for (let i = Game.enemyBullets.length - 1; i >= 0; i--) {
    const bullet = Game.enemyBullets[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(bullet.vx, bullet.vy) * dt / 10));
    let struck = false;
    for (let step = 0; step < steps && !struck; step++) {
      bullet.x += bullet.vx * dt / steps;
      bullet.y += bullet.vy * dt / steps;
      struck = overlap(bullet, Game.player);
    }
    if (struck) {
      Game.enemyBullets.splice(i, 1);
      hurt();
      if (!Game.enemyBullets.length) break;
    } else if (bullet.x < Game.camera - 100 || bullet.x > Game.camera + VIEW_W + 100 || bullet.y < -40 || bullet.y > VIEW_H + 40) {
      Game.enemyBullets.splice(i, 1);
    }
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = 45 + Math.random() * 150;
    Game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + Math.random() * .35, color });
  }
  if (Game.particles.length > 160) Game.particles.splice(0, Game.particles.length - 160);
}

function updateParticles(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const particle = Game.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 280 * dt;
    if (particle.life <= 0) Game.particles.splice(i, 1);
  }
}

function cullWorld() {
  const cutoff = Game.camera - CHUNK_W * 1.5;
  Game.chunks = Game.chunks.filter((chunk) => chunk.start + CHUNK_W > cutoff);
  Game.enemies = Game.enemies.filter((enemy) => !enemy.dead && enemy.x + enemy.w > cutoff);
  Game.powerups = Game.powerups.filter((powerup) => !powerup.taken && powerup.x + powerup.w > cutoff);
}

function update(dt) {
  Game.frameDt = dt;
  worldGenBudget = 2;
  if (Game.hitStop > 0) {
    Game.hitStop = Math.max(0, Game.hitStop - dt);
    Game.shake = Math.max(0, Game.shake - dt);
    Game.flash = Math.max(0, Game.flash - dt);
    updateParticles(dt * .25);
    return;
  }
  Game.time += dt;
  Game.feedbackTimer = Math.max(0, Game.feedbackTimer - dt);
  Game.hudTimer = Math.max(0, Game.hudTimer - dt);
  Game.shake = Math.max(0, Game.shake - dt);
  Game.flash = Math.max(0, Game.flash - dt);
  if (Game.stageBanner) {
    Game.stageBanner.timer -= dt;
    if (Game.stageBanner.timer <= 0) Game.stageBanner = null;
  }
  if (Game.victoryTimer > 0) {
    Game.victoryTimer -= dt;
    if (Game.victoryTimer <= 0) {
      if (Game.victoryNextLevel) { advanceLevel(); return; }
      missionComplete();
      return;
    }
  }
  if (Game.wordEcho) {
    Game.wordEcho.timer -= dt;
    if (Game.wordEcho.timer <= 0) Game.wordEcho = null;
  }
  updatePlayer(dt);
  updateHazards(dt);
  updateReinforcements(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  Game.maxX = Math.max(Game.maxX, Game.player.x);
  Game.distance = Math.floor(Game.maxX / 10);
  ensureWorld(Game.player.x + VIEW_W * 2.4);
  const entered = chunkAt(Game.player.x + Game.player.w / 2);
  if (entered && entered.index !== Game.enteredChunk) {
    Game.enteredChunk = entered.index;
    Game.stageBanner = { tag: entered.tag || 'TEST', name: entered.encounter, hint: entered.hint || '', timer: 2.4 };
    if (entered.checkpoint) Game.checkpoint = entered.start + 110;
    if (entered.wordGate && !entered.gateUsed) {
      entered.gateUsed = openWordGate(entered);
    } else if (entered.index > 0) {
      showFeedback('战况：' + entered.encounter);
    }
  }
  const targetCamera = Math.max(0, Game.player.x - VIEW_W * .3);
  Game.camera += (targetCamera - Game.camera) * (1 - Math.exp(-9 * dt));
  if (Game.player.onGround && Game.player.x > Game.checkpoint + 480 && groundAt(Game.player.x + Game.player.w / 2) !== null) Game.checkpoint = Game.player.x;
  if (!Game.hudTimer) { Game.hudTimer = .1; updateHud(); }
  if (Math.floor(Game.time * 2) !== Math.floor((Game.time - dt) * 2)) cullWorld();
}

function drawBiomeLayer(index, alpha, progress) {
  if (!ASSETS.biomes.complete || !ASSETS.biomes.naturalWidth) {
    ctx.fillStyle = ['#6f9f8e', '#b68352', '#3f7380', '#263e58'][index];
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }
  const sourceH = ASSETS.biomes.naturalHeight / 4;
  const sourceW = Math.min(ASSETS.biomes.naturalWidth, sourceH * VIEW_W / VIEW_H);
  const sourceX = (ASSETS.biomes.naturalWidth - sourceW) * clamp(progress, 0, 1);
  ctx.globalAlpha = alpha;
  ctx.drawImage(ASSETS.biomes, sourceX, sourceH * index, sourceW, sourceH, 0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 1;
}

/* 魂斗罗式远景层: 雪峰剪影+瀑布(慢视差, 画在全景图之上) */
function drawFarLayer(index) {
  // 远山只画在上半部(晨雾区), 低透明度=透过雾气隐现的冷色锚点
  const parallax = (Game.camera * .22) % (VIEW_W + 520);
  const palette = [
    { far: 'rgba(178,182,225,.78)', near: 'rgba(74,74,120,.9)', snow: '#f4f7ff' },
    { far: 'rgba(228,200,156,.74)', near: 'rgba(124,94,60,.9)', snow: '#fff8e2' },
    { far: 'rgba(156,196,204,.76)', near: 'rgba(62,102,112,.9)', snow: '#e8fbff' },
    { far: 'rgba(164,176,226,.78)', near: 'rgba(70,78,134,.9)', snow: '#eff4ff' },
  ][index] || { far: 'rgba(178,182,225,.78)', near: 'rgba(74,74,120,.9)', snow: '#f4f7ff' };
  ctx.save();
  // 远层山(淡蓝紫, 慢视差)
  const parallaxFar = (Game.camera * .14) % (VIEW_W + 520);
  for (let i = -1; i <= 1; i++) {
    const bx = i * 520 - (parallaxFar % 520);
    ctx.fillStyle = palette.far;
    ctx.beginPath();
    ctx.moveTo(bx, 152);
    ctx.lineTo(bx + 180, 152 - 165);
    ctx.lineTo(bx + 360, 152);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = palette.snow;
    ctx.beginPath();
    ctx.moveTo(bx + 148, 152 - 122);
    ctx.lineTo(bx + 180, 152 - 165);
    ctx.lineTo(bx + 213, 152 - 118);
    ctx.closePath(); ctx.fill();
  }
  // 层间雾带: 切开远山与近山(形成"山—雾—山—雾"节奏)
  const midFog = ctx.createLinearGradient(0, 108, 0, 152);
  midFog.addColorStop(0, 'rgba(233,230,186,0)');
  midFog.addColorStop(.6, 'rgba(233,230,186,.5)');
  midFog.addColorStop(1, 'rgba(233,230,186,.88)');
  ctx.fillStyle = midFog;
  ctx.fillRect(0, 108, VIEW_W, 44);
  // 近层山(深偏紫, 快视差) —— 两层递进
  for (let i = -1; i <= 1; i++) {
    const bx = i * 440 - (parallax % 440);
    ctx.fillStyle = palette.near;
    ctx.beginPath();
    ctx.moveTo(bx + 60, 156);
    ctx.lineTo(bx + 200, 156 - 105);
    ctx.lineTo(bx + 340, 156);
    ctx.closePath(); ctx.fill();
  }
  // 山脚雾带(水平渐隐, 融入晨雾)
  const fogBand = ctx.createLinearGradient(0, 88, 0, 168);
  fogBand.addColorStop(0, 'rgba(235,230,182,0)');
  fogBand.addColorStop(.45, 'rgba(235,230,182,.42)');
  fogBand.addColorStop(.78, 'rgba(235,230,182,.78)');
  fogBand.addColorStop(1, 'rgba(235,230,182,.95)');
  ctx.fillStyle = fogBand;
  ctx.fillRect(0, 88, VIEW_W, 80);
  ctx.restore();
}

function drawWeather(index) {
  const type = BIOMES[index].weather;
  ctx.save();
  if (type === 'rain') {
    ctx.strokeStyle = 'rgba(184,224,232,.32)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 46; i++) {
      const x = (i * 83 + Game.time * 310) % (VIEW_W + 80) - 40;
      const y = (i * 47 + Game.time * 430) % VIEW_H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 13, y + 28); ctx.stroke();
    }
  } else {
    const color = type === 'dust' ? 'rgba(239,193,112,.25)' : type === 'glow' ? 'rgba(244,211,122,.5)' : 'rgba(236,224,151,.32)';
    ctx.fillStyle = color;
    for (let i = 0; i < 28; i++) {
      const x = (i * 97 + Game.time * (type === 'dust' ? 54 : 16)) % VIEW_W;
      const y = 70 + (i * 61 + Math.sin(Game.time + i) * 35) % 350;
      const size = type === 'glow' ? 2 + (i % 3) : 1 + (i % 2);
      ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function drawBackground() {
  const span = CHUNK_W * 3;
  const group = Math.floor(Game.camera / span);
  const index = Game.mode === 'mission' ? (MISSION_LEVELS[Game.missionLevel] || MISSION_LEVELS[0]).biome : group % BIOMES.length;
  const local = (Game.camera % span) / span;
  drawBiomeLayer(index, 1, local);
  drawFarLayer(index);   // 雪峰画在全景图之上: 半透明蓝紫剪影透过晨雾隐现
  if (Game.mode !== 'mission' && local > .84) drawBiomeLayer((index + 1) % BIOMES.length, (local - .84) / .16, 0);
  ctx.fillStyle = ['rgba(7,27,20,.22)', 'rgba(45,24,12,.18)', 'rgba(4,24,30,.3)', 'rgba(5,10,25,.34)'][index];
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  // 可读性纪律：背景整体压暗降饱和，把对比度留给玩法元素（魂斗罗/马里奥的前后景分离原则）
  shade.addColorStop(0, 'rgba(6,16,15,.30)');
  shade.addColorStop(.5, 'rgba(6,15,14,.42)');
  shade.addColorStop(.72, 'rgba(5,13,12,.58)');
  shade.addColorStop(1, 'rgba(4,10,9,.80)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWeather(index);
}

function drawDecor(chunk) {
  ctx.fillStyle = BIOMES[chunk.biome].ground;
  for (const item of chunk.decor) {
    if (chunk.biome === 0) {
      ctx.globalAlpha = .72;
      ctx.fillRect(item.x, GROUND_Y - 27 * item.size, 4, 27 * item.size);
      ctx.beginPath(); ctx.ellipse(item.x - 7, GROUND_Y - 21 * item.size, 10 * item.size, 4, -.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(item.x + 8, GROUND_Y - 14 * item.size, 11 * item.size, 4, .5, 0, TAU); ctx.fill();
    } else if (chunk.biome === 1) {
      ctx.globalAlpha = .58;
      ctx.beginPath(); ctx.moveTo(item.x - 10, GROUND_Y); ctx.lineTo(item.x, GROUND_Y - 24 * item.size); ctx.lineTo(item.x + 13, GROUND_Y); ctx.fill();
    } else if (chunk.biome === 2) {
      ctx.globalAlpha = .6;
      ctx.fillRect(item.x - 8, GROUND_Y - 35 * item.size, 16, 35 * item.size);
      ctx.fillRect(item.x - 13, GROUND_Y - 38 * item.size, 26, 5);
    } else {
      ctx.globalAlpha = .78;
      ctx.fillStyle = '#d4a64e';
      ctx.beginPath(); ctx.moveTo(item.x - 10, GROUND_Y); ctx.lineTo(item.x - 2, GROUND_Y - 28 * item.size); ctx.lineTo(item.x + 4, GROUND_Y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(item.x + 1, GROUND_Y); ctx.lineTo(item.x + 10, GROUND_Y - 19 * item.size); ctx.lineTo(item.x + 15, GROUND_Y); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawGround(chunk) {
  const biome = BIOMES[chunk.biome];
  const gaps = chunk.gaps.slice().sort((a, b) => a.x - b.x);
  let x = chunk.start;
  for (const gap of gaps.concat({ x: chunk.start + CHUNK_W, w: 0 })) {
    const width = gap.x - x;
    if (width > 0) {
      ctx.fillStyle = biome.ground;
      ctx.fillRect(x, GROUND_Y, width, VIEW_H - GROUND_Y);
      ctx.fillStyle = biome.edge;
      ctx.fillRect(x, GROUND_Y, width, 7);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      for (let mark = x + 18; mark < x + width; mark += 58) ctx.fillRect(mark, GROUND_Y + 24, 30, 3);
    }
    x = gap.x + gap.w;
  }
}

function drawPlatforms(chunk) {
  const biome = BIOMES[chunk.biome];
  for (const platform of chunk.platforms) {
    const y = platformTop(platform);
    ctx.fillStyle = biome.ground;
    ctx.beginPath(); ctx.roundRect(platform.x, y, platform.w, 18, 5); ctx.fill();
    ctx.fillStyle = biome.edge;
    ctx.fillRect(platform.x + 3, y, platform.w - 6, 5);
    ctx.fillStyle = 'rgba(8,20,18,.36)';
    for (let x = platform.x + 15; x < platform.x + platform.w; x += 32) ctx.fillRect(x, y + 8, 4, 8);
  }
}

function drawBarrier(chunk) {
  if (!chunk.lock || chunk.cleared || !chunkHasThreats(chunk)) return;
  const x = chunk.start + CHUNK_W - 58;
  // 危险语义强化：脉冲发光 + 扫描线动画，一眼读懂"此路不通"
  const pulse = .55 + Math.sin(Game.time * 5) * .35;
  ctx.save();
  ctx.strokeStyle = 'rgba(239,104,72,' + clamp(.55 + pulse * .4, 0, 1) + ')';
  ctx.fillStyle = 'rgba(239,104,72,' + (.14 + pulse * .1) + ')';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ef6848';
  ctx.shadowBlur = 16 + pulse * 14;
  ctx.fillRect(x - 8, 118, 16, GROUND_Y - 118);
  ctx.strokeRect(x - 8, 118, 16, GROUND_Y - 118);
  // 上下端盖：明确的"墙"读感
  ctx.fillRect(x - 20, 112, 40, 9);
  ctx.fillRect(x - 20, GROUND_Y - 10, 40, 9);
  for (let y = 132; y < GROUND_Y; y += 38) {
    ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x + 18, y + 24); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd2b8'; ctx.font = '900 11px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('封锁', x, 104);
  ctx.restore();
}

function drawHazards(chunk) {
  for (const hazard of chunk.hazards) {
    const spec = HAZARD_SPRITES[hazard.type];
    if (!spec) continue;
    ctx.save();
    const active = hazard.type !== 'steam' && hazard.type !== 'laser' || hazardActive(hazard);
    const width = hazard.type === 'puddle' ? Math.max(spec.w, hazard.w + 12)
      : hazard.type === 'laser' ? Math.max(spec.w, hazard.w + 30) : spec.w;
    const height = spec.h * (hazard.type === 'spring' ? 1 + Math.sin(Game.time * 7 + hazard.phase) * .025 : 1);
    const centerX = hazard.x + hazard.w / 2;
    ctx.globalAlpha = active ? 1 : .28;
    ctx.shadowColor = hazard.type === 'laser' ? 'rgba(255,72,49,.72)'
      : hazard.type === 'spring' ? 'rgba(180,92,255,.62)' : 'rgba(242,185,82,.42)';
    ctx.shadowBlur = active ? 10 : 3;
    const drawn = drawAtlasFrame(ASSETS.hazards, spec.row, spec.column, centerX - width / 2, GROUND_Y - spec.baseline * height, width, height, false, 3, 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    if (hazard.type === 'updraft') {
      ctx.strokeStyle = 'rgba(245,205,126,.42)'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const y = hazard.y + ((i * 61 - Game.time * 92) % hazard.h + hazard.h) % hazard.h;
        ctx.beginPath();
        ctx.moveTo(hazard.x + 18 + i * 23, y + 28);
        ctx.bezierCurveTo(hazard.x + 35 + i * 18, y + 12, hazard.x + 8 + i * 28, y - 4, hazard.x + 31 + i * 17, y - 20);
        ctx.stroke();
      }
    } else if (!drawn) {
      ctx.fillStyle = '#e4b75e'; ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
    }
    ctx.restore();
  }
}

function drawPickups() {
  for (const pickup of Game.pickups) {
    if (pickup.taken || pickup.x < Game.camera - 80 || pickup.x > Game.camera + VIEW_W + 80) continue;
    const pulse = 1 + Math.sin(Game.time * 5 + pickup.index) * .07;
    // 形状即语义：圆形发光宝珠 = 收集物（区别于平台/机关的矩形语言）
    const isNext = Game.currentWord && pickup.index === Game.currentWord.progress;
    const bob = Math.sin(Game.time * 3.2 + pickup.index * 1.3) * 4;
    ctx.save();
    ctx.translate(pickup.x + 15, pickup.y + 17 + bob);
    ctx.scale(pulse, pulse);
    // 当前目标字母：额外旋转光环提示
    if (isNext) {
      ctx.save();
      ctx.rotate(Game.time * 1.6);
      ctx.strokeStyle = 'rgba(255,240,170,.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.shadowColor = isNext ? 'rgba(255,240,180,1)' : 'rgba(210,190,140,.45)';
    ctx.shadowBlur = isNext ? 20 : 8;
    const grad = ctx.createRadialGradient(-6, -8, 3, 0, 0, 21);
    if (isNext) {
      // 当前目标：炽白金高亮，与后续字母的暗金色明显分层（颜色语义 > 光环语义）
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(.5, '#ffe89a');
      grad.addColorStop(1, '#e8b23e');
    } else {
      grad.addColorStop(0, '#f7ecc4');
      grad.addColorStop(.55, '#cbb26a');
      grad.addColorStop(1, '#96772c');
    }
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#fff2b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#17372e';
    ctx.font = '900 20px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pickup.letter, 0, 1);
    ctx.restore();
  }
}

function drawPowerups() {
  const colors = { spread: '#e76f51', rapid: '#65b7a1', shield: '#e0b44f' };
  const marks = { spread: 'S', rapid: 'R', shield: '盾' };
  for (const powerup of Game.powerups) {
    if (powerup.taken || powerup.x < Game.camera - 80 || powerup.x > Game.camera + VIEW_W + 80) continue;
    const bob = Math.sin(Game.time * 4 + powerup.phase) * 6;
    ctx.save();
    ctx.translate(powerup.x + 17, powerup.y + 17 + bob);
    ctx.rotate(Math.sin(Game.time * 2 + powerup.phase) * .12);
    ctx.shadowColor = colors[powerup.type]; ctx.shadowBlur = 16;
    ctx.fillStyle = '#f7edcf'; ctx.strokeStyle = colors[powerup.type]; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-15, -15, 30, 30, 9); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#17372e'; ctx.font = '900 15px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(marks[powerup.type], 0, 1);
    ctx.restore();
  }
}

function drawAtlasFrame(image, row, column, x, y, width, height, flip = false, columns = 4, rows = 4) {
  if (!image.complete || !image.naturalWidth) return false;
  const sourceW = image.naturalWidth / columns;
  const sourceH = image.naturalHeight / rows;
  ctx.save();
  ctx.translate(x + width / 2, y);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.drawImage(image, column * sourceW, row * sourceH, sourceW, sourceH, -width / 2, 0, width, height);
  ctx.restore();
  return true;
}

function drawEnemyTelegraph(enemy) {
  if (enemy.state !== 'telegraph') return;
  const pulse = .55 + Math.sin(Game.time * 22) * .25;
  ctx.save();
  // 性能: 不用 shadowBlur(每个敌人每帧一次会显著拖慢Canvas),
  // 改为双层描边模拟发光, 视觉效果几乎一致但零开销
  ctx.strokeStyle = 'rgba(255,112,73,' + (pulse * .35) + ')';
  ctx.lineWidth = (enemy.type === 'boss' ? 4 : 2.5) + 4;
  if (enemy.type === 'turret' || enemy.type === 'guardian' || enemy.type === 'boss') {
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(enemy.x + enemy.w / 2, enemy.y + enemy.h * .42);
    ctx.lineTo(enemy.targetX, enemy.targetY);
    ctx.stroke();
  } else if (enemy.type === 'drone') {
    ctx.beginPath(); ctx.arc(enemy.targetX, enemy.targetY, 24 + Math.sin(Game.time * 18) * 5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(enemy.targetX - 34, enemy.targetY); ctx.lineTo(enemy.targetX + 34, enemy.targetY); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h, enemy.w * .72, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd1bd'; ctx.font = '950 16px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('!', enemy.x + enemy.w / 2, enemy.y - 12);
  ctx.restore();
}

function drawEnemy(enemy) {
  if (enemy.dead || enemy.x < Game.camera - 140 || enemy.x > Game.camera + VIEW_W + 140) return;
  drawEnemyTelegraph(enemy);
  if (enemy.type === 'capsule') {
    const mark = { spread: 'S', rapid: 'R', shield: '盾' }[enemy.dropType] || 'S';
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    if (enemy.hit > 0) ctx.globalAlpha = .55;
    ctx.fillStyle = '#d6c8a3';
    ctx.beginPath(); ctx.moveTo(-23, -5); ctx.lineTo(-34, 5); ctx.lineTo(-21, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23, -5); ctx.lineTo(34, 5); ctx.lineTo(21, 7); ctx.fill();
    ctx.shadowColor = '#f4d37a'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#27483e'; ctx.strokeStyle = '#f4d37a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-23, -14, 46, 28, 12); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#f4d37a';
    ctx.font = '900 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mark, 0, 1);
    ctx.restore();
    return;
  }
  if (enemy.type === 'turret') {
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h);
    if (enemy.hit > 0) ctx.globalAlpha = .5;
    ctx.fillStyle = '#17372f'; ctx.strokeStyle = '#e2b858'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-24, -18, 48, 18, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#294f43'; ctx.beginPath(); ctx.arc(0, -29, 17, Math.PI, TAU); ctx.fill(); ctx.stroke();
    const angle = Math.atan2(enemy.targetY - (enemy.y + 18), enemy.targetX - (enemy.x + enemy.w / 2));
    ctx.rotate(angle); ctx.fillStyle = '#d8a94b'; ctx.beginPath(); ctx.roundRect(0, -5, 31, 10, 4); ctx.fill();
    ctx.restore();
  } else {
    const spec = {
      beetle: { row: 0, w: 68, h: 58, ox: -13, oy: -20 },
      leaper: { row: 0, w: 78, h: 66, ox: -15, oy: -27 },
      drone: { row: 1, w: 72, h: 72, ox: -15, oy: -16 },
      guardian: { row: 2, w: 88, h: 86, ox: -17, oy: -20 },
      boss: { row: 3, w: 122, h: 118, ox: -22, oy: -24 },
    }[enemy.type];
    const frameRate = enemy.state === 'recover' ? 3 : enemy.type === 'boss' ? 4 : 7;
    const frame = Math.floor(Game.time * frameRate + enemy.phase) % 4;
    ctx.save();
    if (enemy.hit > 0) ctx.globalAlpha = .45;
    if (!drawAtlasFrame(ASSETS.enemies, spec.row, frame, enemy.x + spec.ox, enemy.y + spec.oy, spec.w, spec.h, enemy.facing > 0)) {
      ctx.fillStyle = enemy.type === 'boss' ? '#6c4932' : '#365e52';
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
    }
    ctx.restore();
  }
  if (enemy.type === 'guardian' && enemy.state !== 'recover') {
    const frontX = enemy.facing < 0 ? enemy.x - 5 : enemy.x + enemy.w + 5;
    // 性能: 盾弧用双层描边代替 shadowBlur
    ctx.save(); ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(157,221,199,.28)';
    ctx.beginPath(); ctx.arc(frontX, enemy.y + enemy.h * .52, 31, enemy.facing < 0 ? Math.PI / 2 : -Math.PI / 2, enemy.facing < 0 ? Math.PI * 1.5 : Math.PI / 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(157,221,199,.85)';
    ctx.stroke(); ctx.restore();
  }
  if (enemy.type === 'boss' && enemy.bossPhase === 2) {
    ctx.save(); ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(244,211,122,.30)';
    ctx.beginPath(); ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 68, 76, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(244,211,122,.9)';
    ctx.stroke(); ctx.restore();
  }
  if (enemy.type === 'boss' || enemy.type === 'guardian' || enemy.type === 'turret') {
    ctx.fillStyle = 'rgba(11,28,24,.72)'; ctx.fillRect(enemy.x, enemy.y - 10, enemy.w, 5);
    ctx.fillStyle = '#f4d37a'; ctx.fillRect(enemy.x, enemy.y - 10, enemy.w * enemy.hp / enemy.maxHp, 5);
  }
}

function drawBossNodes() {
  const boss = Game.enemies.find((enemy) => enemy.type === 'boss' && !enemy.dead && enemy.bossPhase === 2);
  if (!boss) return;
  for (const node of Game.bossNodes) {
    if (!node.active) continue;
    const isCurrent = node.order === Game.bossNodeProgress;
    const isDecoy = node.order < 0;
    const rect = bossNodeRect(node, boss);
    ctx.save();
    if (isCurrent) {
      // 当前应击: 高亮金+脉动+序号角标
      const pulse = 1 + Math.sin(Game.time * 6) * .08;
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.scale(pulse, pulse);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
      ctx.shadowColor = '#ffe89a'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffe89a';
      ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 3;
    } else if (isDecoy) {
      ctx.shadowColor = '#ef704e'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#67362c';
      ctx.strokeStyle = '#ffd6c5'; ctx.lineWidth = 2;
    } else {
      // 后续节点: 暗金半透明(可见但明确不是现在打的)
      ctx.globalAlpha = .55;
      ctx.shadowColor = '#f4d37a'; ctx.shadowBlur = 6;
      ctx.fillStyle = '#8a7434';
      ctx.strokeStyle = '#d9c27a'; ctx.lineWidth = 2;
    }
    ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 9); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = isCurrent ? '#3b2a06' : isDecoy ? '#ffd6c5' : '#e8dcb5';
    ctx.font = '950 19px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(node.letter, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    if (isCurrent) {
      // 序号角标
      ctx.fillStyle = '#86efac';
      ctx.font = '900 11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('第' + (Game.bossNodeProgress + 1) + '个', rect.x + rect.w / 2, rect.y - 10);
    }
    ctx.restore();
  }
}

function drawBullet(bullet, color) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.translate(bullet.x + bullet.w / 2, bullet.y + bullet.h / 2);
  ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
  ctx.beginPath(); ctx.roundRect(-7, -2.5, 14, 5, 3); ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const player = Game.player;
  ctx.save();
  ctx.globalAlpha = player.onGround ? .34 : clamp(.28 - Math.abs(player.vy) / 2600, .1, .24);
  ctx.fillStyle = '#071512';
  ctx.beginPath(); ctx.ellipse(player.x + player.w / 2, Math.min(GROUND_Y - 2, player.y + player.h + 2), player.onGround ? 25 : 18, player.onGround ? 6 : 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // 主角存在感：底部接触阴影(不是全身暗晕!) + 金色轮廓光
  ctx.save();
  ctx.fillStyle = 'rgba(5,14,11,.5)';
  ctx.beginPath();
  ctx.ellipse(player.x + player.w / 2, Math.min(GROUND_Y - 3, player.y + player.h + 1), 20, 5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (player.shield) {
    ctx.save();
    ctx.strokeStyle = 'rgba(244,211,122,.8)'; ctx.lineWidth = 3;
    ctx.shadowColor = '#f4d37a'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(player.x + player.w / 2, player.y + player.h / 2, 30, 39, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (player.inv > 0 && Math.floor(Game.time * 14) % 2) return;
  let row = 0;
  let column = Math.floor(Game.time * 3) % 4;
  let atlas = ASSETS.hero;
  const firing = player.fireCooldown > .055;
  if (player.hurtTimer > 0) {
    atlas = ASSETS.actions; row = 3; column = 3;
  } else if (player.landingTimer > 0) {
    atlas = ASSETS.actions; row = 3; column = 1;
  } else if (player.skidTimer > 0 && player.onGround) {
    atlas = ASSETS.actions; row = 3; column = 2;
  } else if (player.crouching) {
    atlas = ASSETS.actions; row = 1; column = firing ? 1 : 0;
  } else if (player.aimY < -.45) {
    atlas = ASSETS.actions;
    if (player.onGround) { row = 0; column = Math.abs(player.aimX) > .2 ? (firing ? 3 : 2) : (firing ? 1 : 0); }
    else { row = 2; column = firing ? 1 : 0; }
  } else if (player.aimY > .45) {
    atlas = ASSETS.actions;
    if (!player.onGround) { row = Math.abs(player.aimX) < .2 && firing ? 3 : 2; column = row === 3 ? 0 : (firing ? 3 : 2); }
    else { row = 1; column = firing ? 3 : 2; }
  } else if (!player.onGround) {
    row = 2; column = player.vy < 0 ? 0 : 1;
  } else if (firing) {
    row = 3; column = Math.abs(player.vx) > 30 ? 2 + Math.floor(player.runCycle) % 2 : Math.floor(Game.time * 8) % 2;
  } else if (Math.abs(player.vx) > 30) {
    row = 1; column = Math.floor(player.runCycle) % 4;
  }
  const baselineOffset = atlas === ASSETS.hero && row === 1 ? [0, 4, 4, 0][column]
    : atlas === ASSETS.hero && row === 3 ? [0, 7, 7, 6][column] : 0;
  const drawY = player.y + player.h - 79 + baselineOffset + (atlas === ASSETS.actions ? (row === 1 ? 12 : 6) : 0);
  // 剪影分离: 精灵背后一圈深色柔光, 从丛林背景里浮出(魂斗罗式可读性)
  ctx.save();
  ctx.shadowColor = 'rgba(8,20,14,.85)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(8,20,14,.4)';
  ctx.beginPath();
  ctx.ellipse(player.x + player.w / 2, drawY + player.h * .52, player.w * .62, player.h * .55, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  const recoilRatio = clamp(player.recoil / .09, 0, 1);
  const poseX = player.x - player.aimX * recoilRatio * 7;
  const poseY = drawY - player.aimY * recoilRatio * 5;
  // 金色轮廓光直接叠在精灵绘制上：光晕跟随实际姿势轮廓（比圆形圈自然得多）
  ctx.save();
  ctx.shadowColor = 'rgba(255,206,105,.85)';
  ctx.shadowBlur = 15;
  if (!drawAtlasFrame(atlas, row, column, poseX - 25, poseY, 80, 82, player.facing < 0)) {
    ctx.fillStyle = '#d18a32'; ctx.fillRect(player.x, player.y, player.w, player.h);
  }
  ctx.restore();
  if (player.muzzleFlash > 0) {
    const size = 7 + player.muzzleFlash * 80;
    ctx.save(); ctx.translate(player.muzzleX, player.muzzleY); ctx.rotate(Math.atan2(player.aimY, player.aimX));
    ctx.shadowColor = '#ffe39a'; ctx.shadowBlur = 14; ctx.fillStyle = '#fff0ad';
    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(0, -size * .46); ctx.lineTo(-size * .35, 0); ctx.lineTo(0, size * .46); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  const status = player.overdrive > 0
    ? '火力爆发 ' + Math.ceil(player.overdrive)
    : player.weapon !== 'normal' ? POWERUP_LABELS[player.weapon] + ' ' + Math.ceil(player.weaponTimer) : '';
  const label = [status, player.combo > 1 ? '连击 ×' + player.combo : ''].filter(Boolean).join(' · ');
  if (label) {
    ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12,31,26,.85)'; ctx.strokeText(label, player.x + player.w / 2, player.y - 10);
    ctx.fillStyle = '#f8e8af'; ctx.fillText(label, player.x + player.w / 2, player.y - 10);
  }
}

function drawWordEcho() {
  const echo = Game.wordEcho;
  if (!echo) return;
  const width = Math.min(Math.max(170, echo.en.length * 25 + 30), VIEW_W - 20);
  const x = (VIEW_W - width) / 2;
  const bossActive = Game.enemies.some((enemy) => enemy.type === 'boss' && !enemy.dead);
  const y = bossActive ? 148 : 104;
  const chip = Math.min(27, (width - 28) / echo.en.length - 3);
  const gap = 3;
  const total = echo.en.length * chip + (echo.en.length - 1) * gap;
  const start = VIEW_W / 2 - total / 2;
  ctx.save();
  ctx.globalAlpha = clamp(echo.timer * 3, 0, 1);
  ctx.fillStyle = 'rgba(8,27,23,.78)'; ctx.strokeStyle = echo.complete ? '#86d7ae' : 'rgba(244,211,122,.72)'; ctx.lineWidth = 1.2;
  ctx.shadowColor = 'rgba(3,15,12,.62)'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.roundRect(x, y, width, 62, 14); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = echo.complete ? '#9de2bd' : '#d3ddd7'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(echo.complete ? '拼写完成 · ' + echo.zh : '拼写记忆 · ' + echo.zh, VIEW_W / 2, y + 15);
  for (let i = 0; i < echo.en.length; i++) {
    const active = i < echo.progress;
    const latest = i === echo.progress - 1;
    const cx = start + i * (chip + gap);
    ctx.fillStyle = active ? (latest ? '#f4d37a' : 'rgba(244,211,122,.82)') : 'rgba(255,255,255,.08)';
    ctx.strokeStyle = latest ? '#fff0b0' : 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.roundRect(cx, y + 27, chip, 25, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = active ? '#173128' : 'rgba(220,230,224,.42)'; ctx.font = '900 14px ui-monospace, monospace';
    ctx.fillText(active ? echo.en[i] : '·', cx + chip / 2, y + 40);
  }
  ctx.restore();
}

function drawStageBanner() {
  const banner = Game.stageBanner;
  if (!banner) return;
  const compact = VIEW_W < 420;
  const width = Math.min(430, VIEW_W - 28);
  const x = (VIEW_W - width) / 2;
  const y = 214;
  ctx.save();
  ctx.globalAlpha = clamp(banner.timer * 2, 0, 1);
  ctx.fillStyle = 'rgba(8,27,22,.82)'; ctx.strokeStyle = 'rgba(244,211,122,.54)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x, y, width, compact ? 88 : 64, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4d37a'; ctx.font = '900 10px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(BEAT_LABELS[banner.tag] || '战况', x + 15, y + 16);
  ctx.fillStyle = '#f6f0dc'; ctx.font = '950 ' + (compact ? 18 : 20) + 'px system-ui, sans-serif'; ctx.fillText(banner.name, x + 15, y + 38);
  ctx.fillStyle = '#bed2c8'; ctx.font = '600 ' + (compact ? 10 : 11) + 'px system-ui, sans-serif'; ctx.textAlign = compact ? 'left' : 'right';
  ctx.fillText(banner.hint, compact ? x + 15 : x + width - 15, compact ? y + 65 : y + 48, width - 30);
  ctx.restore();
}

function drawBossStatus() {
  const boss = Game.enemies.find((enemy) => enemy.type === 'boss' && !enemy.dead);
  if (!boss) return;
  const width = Math.min(360, VIEW_W - 24);
  const x = (VIEW_W - width) / 2;
  const y = 96;
  ctx.save();
  ctx.fillStyle = 'rgba(8,24,21,.86)'; ctx.strokeStyle = 'rgba(239,112,78,.65)';
  ctx.beginPath(); ctx.roundRect(x, y, width, 40, 11); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8daca'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('林地核心 · 阶段 ' + boss.bossPhase, x + 12, y + 16);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(x + 12, y + 25, width - 24, 5, 3); ctx.fill();
  ctx.fillStyle = boss.bossPhase === 2 ? '#f4d37a' : '#ef704e'; ctx.beginPath(); ctx.roundRect(x + 12, y + 25, (width - 24) * boss.hp / boss.maxHp, 5, 3); ctx.fill();
  if (boss.bossPhase === 2 && Game.bossWord) {
    ctx.fillStyle = '#f4d37a'; ctx.textAlign = 'right'; ctx.fillText('口令：' + Game.bossWord.zh + '  ' + Game.bossNodeProgress + '/3', x + width - 12, y + 16);
  }
  ctx.restore();
}

function render() {
  ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
  drawBackground();
  ctx.save();
  const shakeClock = performance.now() * .05;
  const shakeX = Game.shake > 0 ? Math.sin(shakeClock) * Game.shakeStrength : 0;
  const shakeY = Game.shake > 0 ? Math.cos(shakeClock * 1.17) * Game.shakeStrength * .55 : 0;
  ctx.translate(-Game.camera + shakeX, shakeY);
  for (const chunk of Game.chunks) {
    if (chunk.start > Game.camera + VIEW_W + CHUNK_W || chunk.start + CHUNK_W < Game.camera - CHUNK_W) continue;
    drawDecor(chunk); drawGround(chunk); drawPlatforms(chunk); drawHazards(chunk); drawBarrier(chunk);
  }
  drawPickups();
  drawPowerups();
  for (const enemy of Game.enemies) drawEnemy(enemy);
  drawBossNodes();
  for (const bullet of Game.bullets) drawBullet(bullet, '#ffe49a');
  for (const bullet of Game.enemyBullets) drawBullet(bullet, '#e9664c');
  drawPlayer();
  // 前景遮挡草丛(魂斗罗纵深关键一招): 比玩家更快的半透明剪影掠过
  if (!Game.foreGrass) {
    Game.foreGrass = [];
    for (let i = 0; i < 14; i++) {
      Game.foreGrass.push({ x: Math.random() * VIEW_W * 2.4, h: 46 + Math.random() * 50, w: 70 + Math.random() * 80, sway: Math.random() * TAU });
    }
  }
  {
    const fgDt = clamp(Game.frameDt || .016, .008, .05);
    ctx.save();
    for (const g of Game.foreGrass) {
      g.x -= fgDt * 640;   // 前景速度≈玩家速度1.5倍
      if (g.x + g.w < Game.camera - 60) g.x += VIEW_W * 2.6;
      const sx = g.x - Game.camera * 1.18;
      if (sx > VIEW_W + 40 || sx + g.w < -40) continue;
      const swayA = Math.sin(Game.time * 2.2 + g.sway) * 3;
      ctx.fillStyle = 'rgba(6,20,13,.34)';
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y + 26);
      ctx.quadraticCurveTo(sx + g.w * .3 + swayA, GROUND_Y - g.h, sx + g.w * .55, GROUND_Y - g.h * .9);
      ctx.quadraticCurveTo(sx + g.w * .8 - swayA, GROUND_Y - g.h * .4, sx + g.w, GROUND_Y + 26);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  for (const particle of Game.particles) {
    ctx.globalAlpha = clamp(particle.life * 3, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawBossStatus();
  drawWordEcho();
  drawStageBanner();
  if (Game.flash > 0) {
    ctx.fillStyle = 'rgba(239,103,76,' + clamp(Game.flash * 1.8, 0, .34) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function resize() {
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  VIEW_W = VIEW_H * width / height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}

function setMuteButton() {
  const muted = window.ArcadeAudio && ArcadeAudio.muted;
  $('mute-btn').textContent = muted ? '已静音' : '声音';
  $('mute-btn').setAttribute('aria-pressed', muted ? 'true' : 'false');
}

function toggleMute() {
  if (window.ArcadeAudio) ArcadeAudio.toggle();
  setMuteButton();
}

function bindHold(id, property) {
  const button = $(id);
  const release = () => { input[property] = false; button.classList.remove('active'); };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    input[property] = true;
    button.classList.add('active');
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

bindHold('left-btn', 'left');
bindHold('right-btn', 'right');
bindHold('up-btn', 'up');
bindHold('down-btn', 'down');
bindHold('fire-btn', 'fire');
$('fire-btn').addEventListener('pointerdown', () => { if (Game.state === 'playing') shoot(); });
$('jump-btn').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add('active');
  queueJump();
});
const releaseJump = () => { input.jumpHeld = false; $('jump-btn').classList.remove('active'); };
$('jump-btn').addEventListener('pointerup', releaseJump);
$('jump-btn').addEventListener('pointercancel', releaseJump);
$('jump-btn').addEventListener('lostpointercapture', releaseJump);

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = true;
  if (event.code === 'ArrowUp' || event.code === 'KeyW') input.up = true;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') input.down = true;
  if (event.code === 'Space' && !event.repeat) queueJump();
  if (event.code === 'KeyJ' || event.code === 'KeyK' || event.code === 'KeyX') {
    input.fire = true;
    if (!event.repeat && Game.state === 'playing') shoot();
  }
  if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat && (Game.state === 'playing' || Game.state === 'paused')) togglePause();
  if (event.code === 'KeyM' && !event.repeat) toggleMute();
  if (Game.state === 'word-gate' && /^Digit[123]$/.test(event.code)) {
    const option = Game.wordGate?.options[Number(event.code.at(-1)) - 1];
    if (option) answerWordGate(option);
  }
  if (event.code === 'Enter' && !event.repeat && Game.state === 'menu') startGame('mission');
  else if (event.code === 'Enter' && !event.repeat && Game.state === 'over') startGame(Game.mode);
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = false;
  if (event.code === 'ArrowUp' || event.code === 'KeyW') input.up = false;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') input.down = false;
  if (event.code === 'Space') input.jumpHeld = false;
  if (event.code === 'KeyJ' || event.code === 'KeyK' || event.code === 'KeyX') input.fire = false;
});

document.querySelectorAll('.difficulty').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.difficulty').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  Game.difficulty = button.dataset.difficulty;
}));
// 关卡选择(解锁制: 最高到达关+1可选; 也允许自由选, 单机游戏不必卡)
document.querySelectorAll('.level-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.level-btn').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.selectedLevel = Number(b.dataset.level);
  const names = ['曙光森林', '风蚀峡谷', '雨中古城', '月晶遗迹'];
  $('start-btn').textContent = '开始任务 · ' + names[Game.selectedLevel];
}));
Game.selectedLevel = 0;

$('start-btn').addEventListener('click', () => startGame('mission'));
$('arcade-start-btn').addEventListener('click', () => startGame('arcade'));
$('retry-btn').addEventListener('click', () => {
  // 战败/结算后重开: 若是通关结算, 从第一关重新开始
  if (Game.victoryNextLevel === false && Game.state === 'over') Game.keepLevel = false;
  startGame(Game.mode);
});
$('menu-btn').addEventListener('click', backToMenu);
$('pause-menu-btn').addEventListener('click', backToMenu);
$('resume-btn').addEventListener('click', togglePause);
$('pause-btn').addEventListener('click', togglePause);
$('mute-btn').addEventListener('click', toggleMute);
$('auto-btn').addEventListener('click', () => {
  Game.autoFire = !Game.autoFire;
  $('auto-btn').setAttribute('aria-pressed', String(Game.autoFire));
  $('auto-btn').textContent = Game.autoFire ? '自动开' : '自动';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 180));

resize();
setMuteButton();
render();

let lastTime = performance.now();
let accumulator = 0;
function frame(now) {
  const dt = Math.min(.1, (now - lastTime) / 1000 || FIXED_STEP);
  lastTime = now;
  if (Game.state === 'playing') {
    accumulator = Math.min(.1, accumulator + dt);
    while (accumulator >= FIXED_STEP && Game.state === 'playing') {
      update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
  } else {
    accumulator = 0;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__wordRanger = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame('mission');
      if (Game.mode !== 'mission' || FIXED_STEP !== 1 / 60) throw new Error('mission or fixed-step setup failed');
      if (Game.generatedTo < VIEW_W * 3) throw new Error('world did not generate ahead');
      ensureWorld(CHUNK_W * 4, Infinity);
      if (Game.chunks.slice(0, 4).map((chunk) => chunk.tag).join(',') !== 'TEACH,TEST,RECOVERY,TEACH') throw new Error('curated mission order failed');
      const startX = Game.player.x;
      input.right = true;
      for (let i = 0; i < 40; i++) update(1 / 60);
      input.right = false;
      if (!(Game.player.x > startX)) throw new Error('player did not move');
      if (!(Game.player.runCycle > 0)) throw new Error('run animation did not follow distance');
      input.down = true;
      update(1 / 60);
      if (!Game.player.crouching || Game.player.h !== CROUCH_H) throw new Error('crouch collider did not shrink');
      input.down = false;
      update(1 / 60);
      if (Game.player.crouching || Game.player.h !== PLAYER_H) throw new Error('crouch collider did not restore');
      const up = aimDirection({ up: true }, { facing: 1, onGround: true });
      const diagonal = aimDirection({ up: true, right: true }, { facing: 1, onGround: true });
      const down = aimDirection({ down: true }, { facing: 1, onGround: false });
      if (up.x !== 0 || up.y !== -1 || diagonal.x <= 0 || diagonal.y >= 0 || down.x !== 0 || down.y !== 1) throw new Error('multi-direction aim failed');
      Game.player.fireCooldown = 0;
      input.right = input.up = true;
      shoot();
      input.right = input.up = false;
      const shot = Game.bullets.pop();
      if (!shot || Math.abs(Math.hypot(shot.vx, shot.vy) - BULLET_SPEED) > .01) throw new Error('diagonal shot speed changed');
      collectPowerup({ x: Game.player.x, y: Game.player.y, w: 34, h: 34, type: 'spread', taken: false });
      Game.bullets.length = 0;
      Game.player.fireCooldown = 0;
      shoot();
      if (Game.bullets.length !== 3 || Game.bullets.some((bullet) => Math.abs(Math.hypot(bullet.vx, bullet.vy) - BULLET_SPEED) > .01)) throw new Error('spread weapon failed');
      Game.bullets.length = 0;
      Object.assign(Game.player, { x: 1300, y: GROUND_Y - PLAYER_H, inv: 0, onGround: true });
      Game.camera = 1000;
      Game.checkpoint = 400;
      const cameraBeforeHit = Game.camera;
      const xBeforeHit = Game.player.x;
      Game.player.inv = 0;
      Game.enemyBullets.push(
        { x: Game.player.x, y: Game.player.y, w: 9, h: 7, vx: 0, vy: 0 },
        { x: Game.player.x, y: Game.player.y, w: 9, h: 7, vx: 0, vy: 0 },
      );
      updateProjectiles(0);
      if (Game.enemyBullets.length) throw new Error('enemy bullets survived player hit');
      if (Math.abs(Game.camera - cameraBeforeHit) > 1 || Math.abs(Game.player.x - xBeforeHit) > 1) throw new Error('ordinary damage jumped the camera');
      const firstWord = Game.currentWord;
      Game.pickups.slice().sort((a, b) => a.index - b.index).forEach(collectLetter);
      if (Game.wordsDone !== 1 || Game.currentWord === firstWord) throw new Error('word loop did not continue');
      if (!Game.wordEcho || !Game.wordEcho.complete || Game.wordEcho.en !== firstWord.en) throw new Error('word memory echo failed');
      ensureWorld(CHUNK_W * 10, Infinity);
      const gateChunk = Game.chunks.find((chunk) => chunk.wordGate);
      if (!gateChunk || !openWordGate(gateChunk) || Game.state !== 'word-gate') throw new Error('active recall gate failed to open');
      answerWordGate(Game.wordGate.word.en);
      if (Game.state !== 'playing' || !Game.recallResults.at(-1)?.correct || Game.player.overdrive <= 0) throw new Error('active recall reward failed');
      const turret = makeEnemy('turret', Game.player.x + 220, gateChunk.index);
      turret.cooldown = 0;
      Game.enemies = [turret];
      updateEnemies(FIXED_STEP);
      if (turret.state !== 'telegraph') throw new Error('enemy telegraph state failed');
      const sweepTarget = makeEnemy('beetle', Game.player.x + 180, gateChunk.index);
      sweepTarget.hp = sweepTarget.maxHp = 2;
      Game.enemies = [sweepTarget];
      Game.bullets = [{ x: sweepTarget.x - 80, y: sweepTarget.y + 12, w: 8, h: 8, vx: 2400, vy: 0 }];
      updateProjectiles(.05);
      if (sweepTarget.hp !== 1) throw new Error('swept bullet collision failed');
      const boss = makeEnemy('boss', Game.player.x + 420, MISSION_BEATS.length - 1);
      Game.enemies = [boss];
      Game.completedWords = [{ en: 'BRIDGE', zh: '桥' }];
      boss.hp = Math.floor(boss.maxHp * .6);
      updateBoss(boss, FIXED_STEP, -300, 0, DIFFICULTIES.easy);
      if (boss.bossPhase !== 2 || Game.bossNodes.length !== 4 || new Set(Game.bossNodes.filter((node) => node.order >= 0).map((node) => node.letter)).size !== 3) throw new Error('boss word shield failed');
      for (let order = 0; order < 3; order++) hitBossNode(Game.bossNodes.find((node) => node.order === order), boss);
      if (!Game.bossGateDone || boss.bossPhase !== 3 || Game.player.overdrive < 6) throw new Error('boss phase transition failed');
      startGame('arcade');
      ensureWorld(CHUNK_W * 13, Infinity);
      if (new Set(Game.chunks.map((chunk) => chunk.biome)).size !== 4) throw new Error('biome rotation missing');
      if (new Set(Game.chunks.map((chunk) => chunk.encounter)).size < 5) throw new Error('encounter rotation missing');
      const hazardTypes = new Set(Game.chunks.flatMap((chunk) => chunk.hazards.map((hazard) => hazard.type)));
      if (Object.keys(HAZARD_SPRITES).length !== 6 || ['updraft', 'rock', 'puddle', 'steam', 'laser', 'spring'].some((type) => !hazardTypes.has(type))) throw new Error('biome-specific mechanics missing');
      if (!Game.enemies.some((enemy) => enemy.type === 'capsule')) throw new Error('supply capsules missing');
      startGame('arcade');
      Game.hp = 999;
      input.right = input.fire = true;
      let jumpHold = 0;
      for (let i = 0; i < 12000; i++) {
        const nextGap = Game.chunks.flatMap((chunk) => chunk.gaps).find((gap) => gap.x > Game.player.x && gap.x - Game.player.x < 125);
        if (Game.player.onGround && (nextGap || i % 109 === 0)) { queueJump(); jumpHold = 18; }
        input.jumpHeld = jumpHold-- > 0;
        if (i % 151 === 0) input.down = true;
        if (i % 151 === 9) input.down = false;
        update(1 / 60);
        if (Game.chunks.length > 12 || Game.enemies.length > 36 || Game.particles.length > 160) throw new Error('unbounded collections');
      }
      input.right = input.fire = input.down = false;
      if (Game.distance < 1000 || new Set(Game.chunks.map((chunk) => chunk.biome)).size < 2) throw new Error('long-run biome progression failed');
      Game.camera = Game.generatedTo - VIEW_W;
      cullWorld();
      if (Game.chunks.length > 6) throw new Error('old chunks were not reclaimed');
      if (![Game.player.x, Game.player.y, Game.camera, Game.generatedTo].every(Number.isFinite)) throw new Error('non-finite game state');
      document.title = 'SELFTEST PASS · WORD RANGER';
      document.documentElement.dataset.selftest = 'pass';
    } catch (error) {
      document.title = 'SELFTEST FAIL · ' + error.message;
      document.documentElement.dataset.selftest = 'fail';
      console.error(error);
    }
  });
}
