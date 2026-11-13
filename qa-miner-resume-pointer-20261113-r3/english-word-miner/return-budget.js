'use strict';
// Presentation-only projection of the existing fixed-step retraction and deadline order.
// A time bonus happens on delivery, so it cannot rescue a cargo that times out first.
(function (root) {
  function duration(distance, speed, step) {
    return Math.max(1, Math.ceil(Math.max(0, distance) / speed / step - 1e-9)) * step;
  }
  function tenth(seconds) { return (Math.ceil(Math.max(0, seconds) * 10 - 1e-8) / 10).toFixed(1); }
  function view(game, options) {
    const h = game && game.hook;
    if (!game || game.state !== 'playing' || game.timeLeft <= 0 || game.contractTimer > 0 ||
      !h || h.state !== 'retract' || !h.grabbed) return null;
    const it = h.grabbed, step = options.step;
    const speed = h.speed / it.weight * options.retractMul * (1 + game.strength * .2);
    if (![h.len, h.speed, it.weight, step, speed, game.timeLeft].every(Number.isFinite) ||
      h.speed <= 0 || it.weight <= 0 || step <= 0 || speed <= 0) return null;
    const seconds = duration(h.len - 46, speed, step);
    const emptySeconds = duration(h.len - 46, h.speed * 1.6, step);
    const savedSeconds = Math.max(0, seconds - emptySeconds);
    // timeout is checked BEFORE updateHook at each fixed step. Equality is not a delivery.
    const urgency = game.timeLeft <= seconds + 1e-8 ? 'late' : game.timeLeft - seconds <= 2 ? 'tight' : 'normal';
    const mineral = options.mineral;
    const name = it.kind === 'letter' ? `字母 ${it.letter}` : mineral ? mineral.name : it.kind === 'bomb' ? '炸弹' : '物品';
    const value = mineral ? ` +${mineral.amount}矿收` : it.kind === 'bomb' ? ` 送达扣${Math.min(100, Math.max(0, game.score))}分` : '';
    const sacrifice = mineral ? '放弃这份矿收' : it.kind === 'bomb' ? '避免本次炸弹扣分' : '本次不入账';
    const timing = urgency === 'late' ? `需${tenth(seconds)}秒 · 有超时风险` : `约${tenth(seconds)}秒送达${urgency === 'tight' ? ' · 时间紧' : ''}`;
    const canDiscard = it.kind !== 'letter' && options.count > 0;
    const action = it.kind === 'letter' ? '字母不可炸' : canDiscard ? 'X可放弃' : '雷管用尽';
    return { seconds, emptySeconds, savedSeconds, urgency, canDiscard,
      reference: `${name}${value} · ${timing} · ${action}`,
      label: canDiscard ? (savedSeconds >= .1 ? `💥 放弃 · 省约${tenth(savedSeconds)}秒` : '💥 放弃钩上物') : '💥 雷管',
      announcement: urgency === 'late' ? `回收${name}需要${tenth(seconds)}秒，当前有超时风险，钩上物品不计入合约。${canDiscard ? '可用一根雷管放弃。' : ''}`
        : urgency === 'tight' ? `回收${name}时间紧，只有送达才计入合约。` : '',
      detail: `回收${name}约需${tenth(seconds)}秒${urgency === 'late' ? '，当前有超时风险' : ''}。${canDiscard ? `X放弃耗1雷管，${sacrifice}，空钩回到摆动可省约${tenth(savedSeconds)}秒。` : action + '。'}` };
  }
  const api = Object.freeze({ view, duration });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MinerReturnBudget = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
