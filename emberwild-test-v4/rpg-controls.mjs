// Browser-independent binding rules live here so they can be tested without WebGL.
export const SLOT_COUNT = 9;
export const PROTECTED_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ShiftLeft', 'ShiftRight', 'Space', 'Escape', 'Tab',
  ...Array.from({length: 9}, (_, i) => `Digit${i + 1}`),
  ...Array.from({length: 9}, (_, i) => `Numpad${i + 1}`),
]);

export function keyLabel(code) {
  if (!code) return '未设置';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[1-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[1-9]$/.test(code)) return `小键盘 ${code.slice(6)}`;
  return {Space: '空格', Escape: 'Esc', Tab: 'Tab', ShiftLeft: '左 Shift', ShiftRight: '右 Shift'}[code] || code;
}

export function validateAlias(code, index, aliases = []) {
  if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) return {ok: false, reason: '槽位无效'};
  if (code === null) return {ok: true, code: null};
  if (PROTECTED_CODES.has(code)) return {ok: false, reason: `${keyLabel(code)} 是基础操作，不能覆盖`};
  if (!/^Key[A-Z]$/.test(code || '')) return {ok: false, reason: '请使用一个字母键，例如 Q、R、T、G'};
  const conflict = aliases.findIndex((binding, i) => i !== index && binding === code);
  if (conflict >= 0) return {ok: false, reason: `${keyLabel(code)} 已用于槽位 ${conflict + 1}，请先移除原绑定`};
  return {ok: true, code};
}

export function bindingForCode(code, aliases = []) {
  const number = /^(?:Digit|Numpad)([1-9])$/.exec(code || '');
  if (number) return Number(number[1]) - 1;
  if (PROTECTED_CODES.has(code)) return -1;
  return aliases.slice(0, SLOT_COUNT).findIndex(alias => alias && alias === code);
}

export function hasInputFocus(target) {
  return !!target?.closest?.('input, textarea, select, button, a[href], [role="textbox"], [contenteditable]:not([contenteditable="false"])');
}

export function ignoresEvent(event, {allowFocused = false} = {}) {
  return !!(event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || (!allowFocused && hasInputFocus(event.target)));
}

export function createPressGate() {
  const pressed = new Set();
  return {
    press(code, repeat = false) {
      if (repeat || pressed.has(code)) return false;
      pressed.add(code);
      return true;
    },
    release(code) { pressed.delete(code); },
    clear() { pressed.clear(); },
    size() { return pressed.size; },
  };
}

export function slotView(snapshot, index) {
  const id = snapshot.hotbar?.[index] || null;
  const skill = snapshot.skills?.find(skill => skill.id === id);
  const alias = snapshot.aliases?.[index] || null;
  if (!id || !skill) return {index, id: null, alias, name: '空槽位', icon: '—', empty: true, usable: false, reason: '空槽位 · 在技能栏设置中分配', remaining: 0, ratio: 0, charges: null};
  const remaining = Math.max(0, Number(snapshot.cooldowns?.[id]) || 0);
  const locked = !!skill.locked || (Number(skill.unlockLevel) || 1) > (Number(snapshot.level) || 1);
  const charges = id === 'potion' ? Math.max(0, Number(snapshot.inventory?.potions) || 0) : Number.isFinite(skill.charges) ? skill.charges : null;
  let reason = '';
  if (locked) reason = `等级 ${skill.unlockLevel || 1} 解锁`;
  else if (charges === 0) reason = '已耗尽 · 回营地补给';
  else if (remaining > 0) reason = `冷却 ${remaining.toFixed(1)} 秒`;
  else if (id === 'potion' && snapshot.hp >= snapshot.maxHp) reason = '生命已满';
  else if (snapshot.dead) reason = '请先回营地重试';
  else if (!snapshot.playing || snapshot.paused) reason = '旅程暂停中';
  return {index, id, alias, name: skill.name, icon: skill.icon || (id === 'potion' ? '＋' : id === 'ward' ? '◇' : '✦'), description: skill.description || '', empty: false, locked, charges, remaining, ratio: Math.min(1, remaining / Math.max(0.1, Number(skill.cooldown) || remaining)), usable: !reason, reason};
}

export function createRpgControls({target = globalThis.window, document = globalThis.document, getSnapshot, onSlot, onOpenInventory, onClose, panelOpen, captureIndex, onCapture, onCancelCapture}) {
  const gate = createPressGate();
  const consume = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const keydown = event => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
    const capture = captureIndex();
    if (capture !== null && capture !== undefined) {
      consume(event);
      if (!gate.press(event.code, event.repeat)) return;
      if (event.code === 'Escape') onCancelCapture();
      else if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) onCapture(null, '请单独按一个字母键，不要组合修饰键');
      else onCapture(event.code);
      return;
    }
    if (panelOpen()) {
      if (event.code === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        consume(event);
        if (gate.press(event.code, event.repeat)) onClose();
      }
      return;
    }
    if (ignoresEvent(event)) return;
    const snapshot = getSnapshot();
    if (!snapshot.playing || snapshot.paused || snapshot.dead) return;
    if (event.code === 'Tab') {
      consume(event);
      if (gate.press(event.code, event.repeat)) onOpenInventory();
      return;
    }
    const index = bindingForCode(event.code, snapshot.aliases);
    if (index < 0) return;
    consume(event);
    if (gate.press(event.code, event.repeat)) onSlot(index);
  };
  const keyup = event => gate.release(event.code);
  const clear = () => gate.clear();
  const focus = event => { if (hasInputFocus(event.target)) clear(); };
  target.addEventListener('keydown', keydown, true);
  target.addEventListener('keyup', keyup, true);
  target.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  document.addEventListener('focusin', focus);
  return {
    clear,
    dispose() {
      target.removeEventListener('keydown', keydown, true);
      target.removeEventListener('keyup', keyup, true);
      target.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      document.removeEventListener('focusin', focus);
    },
  };
}
