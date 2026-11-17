/* Optional two-bomb relay. Private, unplayed implementation candidate.
 * Load after the established game.js. Never changes ordinary-run scoring. */
(() => {
  const originalStart = startOpening;
  const originalDrop = dropBomb;
  const originalCheck = checkOpeningExit;
  const originalFinish = finishOpening;
  const originalMission = updateMissionHud;
  const originalStock = updateBombStock;
  const active = () => Game.opening?.mode === 'relay';
  startOpening = function(mode = 'intro') {
    originalStart(mode === 'relay' ? 'intro' : mode);
    if (mode !== 'relay') return;
    Game.opening.mode = 'relay';
    Game.grid[3][5] = 0;
    Game.grid[5][9] = 0;
    Game.grid[3][7] = 2;
    Game.grid[3][9] = 2;
    Object.assign(Game.letters[0], {col:7,row:3});
    Object.assign(Game.letters[1], {col:9,row:3});
    Object.assign(Game.player, {col:7,row:5,px:OX+7.5*CELL,py:OY+5.5*CELL});
    Game.word.zh = '两弹接力 · 两次放弹内形成连锁，再按 G → O 进门';
    updateHud();
    showFeedback('先布一枚，再在两格射程内布第二枚；转向撤出两枚的火线');
    render();
  };
  dropBomb = function() {
    if (active() && (Game.state !== 'playing' || Game.opening.placed >= 2)) return;
    return originalDrop();
  };
  // These are called independently on every update/render, not only by updateHud.
  // Wrap the authoritative writers so the relay budget cannot revert to refillable stock.
  updateMissionHud = function() {
    if (!active()) return originalMission();
    $id('mission').textContent = `两弹接力 · 连锁 ${Math.min(1,Game.opening.chained)}/1 · 字母 ${Game.word.progress}/2 · ${nextGoalText()}`;
  };
  updateBombStock = function() {
    if (!active()) return originalStock();
    const remaining = Math.max(0,2-Game.opening.placed);
    const stock = bombStockView();
    const hint = Game.state === 'playing' && remaining && stock?.occupied ? ' · 本格已有弹，先换格' : '';
    $id('build-status').textContent = `剩余放弹 ${remaining}/2 · 火力2 · 引信2.1秒 · 碰火结束${hint}`;
  };
  checkOpeningExit = function() {
    if (!active()) return originalCheck();
    if (Game.state !== 'playing') return;
    if (Game.opening.placed === 2 && !Game.bombs.length && !Game.flames.length && !Game.opening.chained) {
      finishOpening(false);
      $id('opening-result-title').textContent = '未形成连锁';
      $id('opening-result-copy').textContent = '两枚已分别爆炸。重试时让第一枚火焰提前引爆第二枚；单纯双开砖不算连锁。';
      return;
    }
    if (Game.opening.placed === 2 && !Game.bombs.length && !Game.flames.length && Game.letters.some(letter => letter.hidden)) {
      finishOpening(false);
      $id('opening-result-title').textContent = '两弹未能开路';
      $id('opening-result-copy').textContent = '放弹次数已用完，但仍有目标砖。重试时把第二枚的火线对准另一块目标砖。';
      return;
    }
    if (Game.opening.chained >= 1) return originalCheck();
  };
  finishOpening = function(success) {
    if (!Game.opening || Game.opening.result) return;
    const relay = active();
    originalFinish(success);
    if (!relay) return;
    $id('opening-next-btn').classList.add('hidden');
    if (success) {
      $id('opening-result-title').textContent = '两弹接力完成';
      $id('opening-result-copy').textContent = '两次布弹内完成真实提前引爆、取齐双字并安全进门。本关不计普通局分数，也不代表普通局连锁奖励已验收。';
    }
  };
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-sub opening-entry';
  button.id = 'relay-btn';
  button.textContent = '可选 · 两弹接力（本地待实玩）';
  button.addEventListener('click', () => startOpening('relay'));
  $id('junction-btn').insertAdjacentElement('afterend', button);
})();
