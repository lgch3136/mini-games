import {SLOT_COUNT, createPressGate, createRpgControls, keyLabel, slotView, validateAlias} from './rpg-controls.mjs';
import {createMinimap} from './minimap.mjs';

const text = (node, value) => { const next = String(value ?? ''); if (node.textContent !== next) node.textContent = next; };
const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };
const button = (label, className, action) => { const node = el('button', className, label); node.type = 'button'; if (action) node.addEventListener('click', action); return node; };
const labelForRelic = id => ({tower: '古塔余烬', pool: '月镜余烬'}[id] || '旅途余烬');
const saveLabels = {saved: '旅程已自动保存 · 进度、探索与设置保存在当前浏览器', loaded: '已恢复上次旅程 · 后续进度自动保存', migrated: '已恢复旧版旅程 · 后续进度自动保存', new: '新旅程 · 浏览器存储可用时自动保存', future: '发现较新版本存档，已保护原数据；本次旅程不能保存', corrupt: '存档无法读取，已保留原数据；本次旅程不能保存', unavailable: '浏览器存储不可用；本次旅程不能保存', protected: '现有存档已保护；本次旅程不能保存', full: '存档容量已满；最近进度尚未保存'};
const resultText = result => result?.reason || (result?.ok === false ? '暂时无法完成' : '已保存');
const success = result => result !== false && result?.ok !== false;

export function createRpgUi({getSnapshot, actions, pause, resume}) {
  const root = el('div', 'rpg-hud'); root.id = 'rpg-hud';
  const live = el('div', 'rpg-sr'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); root.append(live);
  const notice = el('div', 'rpg-notice'); notice.setAttribute('aria-hidden', 'true'); root.append(notice);
  let noticeUntil = 0, lastUpdate = -Infinity, snapshot = getSnapshot(), selectedSlot = -1;
  let currentPanel = null, capturing = null, chosen = null, pendingSwap = null, acquiredPause = false, previousFocus = null;
  const inertState = new Map(), disposers = [];
  const announce = message => { text(live, message); text(notice, message); noticeUntil = performance.now() + 3200; notice.classList.add('visible'); };

  const toolbar = el('nav', 'rpg-toolbar'); toolbar.setAttribute('aria-label', '旅程菜单');
  const inventoryButton = button('背包', '', () => openPanel('inventory')); inventoryButton.setAttribute('aria-keyshortcuts', 'Tab'); inventoryButton.title = '背包与营地 · Tab';
  const settingsButton = button('设置', '', () => openPanel('settings'));
  const header = document.querySelector('header');
  toolbar.append(inventoryButton, settingsButton);
  const originalPause = document.querySelector('#pause'); if (originalPause) toolbar.append(originalPause);
  header?.append(toolbar);
  const pauseSettings = button('旅程设置', 'secondary', () => openPanel('settings')); pauseSettings.hidden = true;
  document.querySelector('#dialog article')?.append(pauseSettings);

  const progress = el('div', 'rpg-progress');
  const levelLabel = el('span', 'rpg-level'); const xpLabel = el('span', 'rpg-xp-label'); const xp = el('progress', 'rpg-xp'); xp.setAttribute('aria-label', '等级经验');
  progress.append(levelLabel, xpLabel, xp); document.querySelector('#status')?.append(progress);

  const mapBox = el('aside', 'rpg-map'); mapBox.setAttribute('aria-label', '探索小地图');
  const mapCanvas = el('canvas'); mapCanvas.setAttribute('role', 'img'); mapCanvas.setAttribute('aria-label', '北方朝上的探索小地图'); mapCanvas.setAttribute('aria-describedby', 'rpg-map-description');
  const mapDescription = el('span', 'rpg-sr'); mapDescription.id = 'rpg-map-description';
  const mapLegend = el('span', 'rpg-map-legend', '◇ 地标 · ▲ 目标'); mapBox.append(mapCanvas, mapLegend, mapDescription); root.append(mapBox);
  const minimap = createMinimap(mapCanvas, mapDescription);

  const barBox = el('section', 'rpg-bar-box'); barBox.setAttribute('aria-label', '九格技能栏');
  const bar = el('div', 'rpg-hotbar');
  const barSlots = [];
  const buttonGate = createPressGate();
  const useSlot = index => {
    snapshot = getSnapshot(); selectedSlot = index;
    const view = slotView(snapshot, index);
    if (!view.usable) { announce(view.reason); paintBar(); document.querySelector('#world')?.focus({preventScroll: true}); return; }
    const result = actions.useSlot(index);
    if (!success(result)) announce(resultText(result));
    snapshot = getSnapshot(); paintBar(); document.querySelector('#world')?.focus({preventScroll: true});
  };
  for (let index = 0; index < SLOT_COUNT; index++) {
    const slot = button('', 'rpg-slot'); slot.dataset.slot = index; slot.draggable = true;
    const key = el('span', 'rpg-slot-key'), icon = el('span', 'rpg-slot-icon'), name = el('span', 'rpg-slot-name');
    const shade = el('span', 'rpg-slot-shade'), cooldown = el('span', 'rpg-slot-cooldown'), charges = el('span', 'rpg-slot-charges');
    for (const child of [key, icon, name, shade, cooldown, charges]) child.setAttribute('aria-hidden', 'true');
    slot.append(key, icon, name, shade, cooldown, charges);
    slot.addEventListener('click', () => useSlot(index));
    slot.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault(); event.stopPropagation();
      if (buttonGate.press(event.code, event.repeat)) useSlot(index);
    });
    slot.addEventListener('keyup', event => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      buttonGate.release(event.code);
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
    });
    slot.addEventListener('dragstart', event => {
      if (!snapshot.hotbar?.[index]) { event.preventDefault(); return; }
      event.dataTransfer.setData('application/x-emberwild-slot', String(index)); event.dataTransfer.effectAllowed = 'move';
    });
    bindDrop(slot, index);
    barSlots.push({slot, key, icon, name, cooldown, charges}); bar.append(slot);
  }
  const barFooter = el('div', 'rpg-bar-footer'); const ward = el('span', 'rpg-ward');
  const editBarButton = button('调整技能栏', 'rpg-small-button', () => openPanel('hotbar'));
  barFooter.append(ward, editBarButton); barBox.append(bar, barFooter); root.append(barBox);
  document.body.append(root);

  const modal = el('div', 'rpg-modal'); modal.hidden = true;
  const panel = el('section', 'rpg-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'rpg-panel-title');
  const panelHeader = el('div', 'rpg-panel-header'); const panelTitle = el('h2', '', '旅程行囊'); panelTitle.id = 'rpg-panel-title';
  const closeButton = button('返回 ×', 'rpg-close', closePanel); closeButton.setAttribute('aria-label', '关闭菜单，返回旅程（Esc）');
  panelHeader.append(panelTitle, closeButton);
  const tabs = el('div', 'rpg-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '旅程管理');
  const tabButtons = {}, pages = {};
  for (const [id, label] of [['inventory', '背包与营地'], ['hotbar', '技能栏'], ['settings', '设置']]) {
    const tab = button(label, '', () => showPage(id)); tab.id = `rpg-tab-${id}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `rpg-page-${id}`); tabs.append(tab); tabButtons[id] = tab;
    const page = el('div', 'rpg-page'); page.id = `rpg-page-${id}`; page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', tab.id); pages[id] = page;
  }
  const panelStatus = el('p', 'rpg-panel-status'); panelStatus.setAttribute('role', 'status'); panelStatus.setAttribute('aria-live', 'polite');
  const saveStatus = el('p', 'rpg-save-status');
  panel.append(panelHeader, tabs, ...Object.values(pages), panelStatus, saveStatus); modal.append(panel); document.body.append(modal);

  const inventoryStats = el('p', 'rpg-inventory-stats');
  const inventoryList = el('dl', 'rpg-inventory-list');
  const inventoryRows = {};
  for (const [id, title] of [['potions', '暖露药剂'], ['scrap', '锻片 · 材料'], ['relics', '余烬 · 任务物品'], ['weapon', '旅者剑 · 装备'], ['supplies', '补给包 · 装备']]) {
    const dt = el('dt', '', title), dd = el('dd'); inventoryRows[id] = dd; inventoryList.append(dt, dd);
  }
  const campHeading = el('h3', '', '营地工坊'); const campStatus = el('p', 'rpg-muted'); const campActions = el('div', 'rpg-camp-actions'); const upgradeButtons = {};
  for (const [id, actionName, title] of [['weapon', 'upgradeWeapon', '强化旅者剑'], ['supplies', 'upgradeSupplies', '升级补给'], ['potion', 'buyPotion', '购买药剂']]) {
    const control = button(title, '', () => runAction(actionName)); upgradeButtons[id] = {control, title}; campActions.append(control);
  }
  pages.inventory.append(inventoryStats, inventoryList, campHeading, campStatus, campActions);

  const editHelp = el('p', 'rpg-muted', '先选技能，再点目标槽位；先点已装备槽位，再点另一格可交换。也可拖放。数字 1–9 始终对应九个槽位。');
  const choiceLabel = el('p', 'rpg-choice', '选择要分配的技能，或选择要移动的槽位');
  const skillDescription = el('p', 'rpg-skill-description', '选择技能可查看效果；空槽位不会触发任何技能。');
  const catalog = el('div', 'rpg-catalog'); const catalogButtons = new Map();
  const emptyChoice = button('清空槽位', 'rpg-empty-choice', () => choose({id: null, source: null}));
  const cancelChoice = button('取消选择', '', () => choose(null));
  const choiceActions = el('div', 'rpg-choice-actions'); choiceActions.append(emptyChoice, cancelChoice);
  const editor = el('div', 'rpg-bar-editor'); editor.setAttribute('aria-label', '点击分配或交换槽位');
  const editorSlots = [];
  for (let index = 0; index < SLOT_COUNT; index++) {
    const control = button('', '', () => assignOrChoose(index)); control.draggable = true;
    control.addEventListener('dragstart', event => { if (!snapshot.hotbar?.[index]) { event.preventDefault(); return; } event.dataTransfer.setData('application/x-emberwild-slot', String(index)); event.dataTransfer.effectAllowed = 'move'; });
    bindDrop(control, index); editor.append(control); editorSlots.push(control);
  }
  const aliasHeading = el('h3', '', '左手快捷键');
  const aliasHelp = el('p', 'rpg-muted', 'Q / R 可直接使用；选择「改键」后按一个字母。E / F 如被基础操作占用，会先说明交换结果。移动、跳跃、闪避、Esc、Tab 和数字键保留。');
  const aliasRows = el('div', 'rpg-alias-list'), aliases = [];
  for (let index = 0; index < SLOT_COUNT; index++) {
    const row = el('div', 'rpg-alias-row'), name = el('span'), change = button('改键', '', () => beginCapture(index)), clear = button('移除', '', () => { const result = actions.setAlias(index, null); text(panelStatus, resultText(result)); updateNow(); });
    row.append(name, change, clear); aliasRows.append(row); aliases.push({name, change, clear});
  }
  const captureHelp = el('p', 'rpg-capture'); captureHelp.hidden = true; captureHelp.setAttribute('role', 'status');
  const swapBox = el('div', 'rpg-swap-confirm'); swapBox.hidden = true;
  const swapText = el('p');
  const confirmSwap = button('确认交换', '', () => {
    if (!pendingSwap) return;
    const {index, code} = pendingSwap; const result = actions.setAlias(index, code, {swapBase: true});
    pendingSwap = null; swapBox.hidden = true; text(panelStatus, success(result) ? '快捷键与基础操作已交换' : resultText(result)); updateNow();
  });
  const cancelSwap = button('保留原键位', '', () => { pendingSwap = null; swapBox.hidden = true; text(panelStatus, '已保留原键位'); });
  swapBox.append(swapText, confirmSwap, cancelSwap);
  pages.hotbar.append(editHelp, catalog, choiceActions, choiceLabel, skillDescription, editor, aliasHeading, aliasHelp, captureHelp, swapBox, aliasRows);

  const settingControls = {};
  function checkboxSetting(key, title, help) {
    const row = el('label', 'rpg-setting'); const input = el('input'); input.type = 'checkbox';
    const copy = el('span'); copy.append(el('strong', '', title), el('small', '', help)); row.append(input, copy);
    input.addEventListener('change', () => { const result = actions.setPreference(key, input.checked); if (!success(result)) text(panelStatus, resultText(result)); updateNow(); });
    settingControls[key] = input; pages.settings.append(row);
  }
  checkboxSetting('music', '原创背景音乐', '首次点击或按键后开启；暂停与后台时静音');
  const volumeLabel = el('label', 'rpg-setting rpg-volume'); const volumeText = el('span', '', '音乐音量');
  const volume = el('input'); volume.type = 'range'; volume.min = '0'; volume.max = '100'; volume.step = '5'; volume.setAttribute('aria-label', '音乐音量'); const volumeValue = el('output');
  volume.addEventListener('input', () => { text(volumeValue, `${volume.value}%`); const result = actions.setPreference('musicVolume', Number(volume.value) / 100); if (!success(result)) text(panelStatus, resultText(result)); });
  volumeLabel.append(volumeText, volume, volumeValue); pages.settings.append(volumeLabel);
  checkboxSetting('showMinimap', '显示探索小地图', '仅记录走过的地形、已发现地标与附近可见守卫');
  checkboxSetting('showHints', '显示操作提示', '保留当前实际键位与技能栏数字');
  const controlsSummary = el('p', 'rpg-controls-summary');
  const saveButton = button('保存旅程', '', () => runAction('save'));
  pages.settings.append(controlsSummary, saveButton);

  function bindDrop(node, index) {
    node.addEventListener('dragover', event => {
      if (Array.from(event.dataTransfer?.types || []).some(type => type === 'application/x-emberwild-slot' || type === 'application/x-emberwild-skill')) { event.preventDefault(); node.classList.add('drag-over'); }
    });
    node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
    node.addEventListener('drop', event => {
      event.preventDefault(); node.classList.remove('drag-over');
      const source = event.dataTransfer?.getData('application/x-emberwild-slot');
      const id = event.dataTransfer?.getData('application/x-emberwild-skill');
      let result;
      if (/^[0-8]$/.test(source || '')) result = (actions.swapSlots || actions.moveSlot)(Number(source), index);
      else if (id && snapshot.skills?.some(skill => skill.id === id && !skill.locked)) result = actions.setSlot(index, id);
      else return;
      announce(success(result) ? `已更新槽位 ${index + 1}` : resultText(result)); chosen = null; updateNow();
    });
  }
  function choose(value) {
    chosen = value;
    const skill = snapshot.skills?.find(skill => skill.id === value?.id), name = skill?.name;
    text(choiceLabel, !value ? '选择要分配的技能，或选择要移动的槽位' : value.source !== null ? `已选择槽位 ${value.source + 1} · ${name}，请点另一格交换` : value.id ? `已选择 ${name}，请点目标槽位` : '清空模式：请点要清空的槽位');
    text(skillDescription, skill ? `${skill.name}：${skill.description} 冷却 ${skill.cooldown} 秒。` : '选择技能可查看效果；空槽位不会触发任何技能。');
    paintEditor();
  }
  function assignOrChoose(index) {
    if (!chosen) { if (snapshot.hotbar?.[index]) choose({id: snapshot.hotbar[index], source: index}); else { text(panelStatus, '先从上方选择技能，再点这个空槽位'); } return; }
    const result = chosen.source !== null ? (actions.swapSlots || actions.moveSlot)(chosen.source, index) : actions.setSlot(index, chosen.id);
    text(panelStatus, success(result) ? `槽位 ${index + 1} 已更新` : resultText(result)); choose(null); updateNow();
  }
  function beginCapture(index) {
    capturing = index; pendingSwap = null; swapBox.hidden = true; captureHelp.hidden = false;
    text(captureHelp, `正在为槽位 ${index + 1} 改键：请按一个字母，Esc 取消`); aliases[index].change.focus();
    controls.clear();
  }
  function cancelCapture() { capturing = null; captureHelp.hidden = true; text(panelStatus, '已取消改键'); }
  function captureAlias(code, error) {
    if (error) { text(captureHelp, error); return; }
    const validation = validateAlias(code, capturing, snapshot.aliases);
    if (!validation.ok) { text(captureHelp, validation.reason); return; }
    const index = capturing, result = actions.setAlias(index, code);
    if (result?.baseConflict) {
      pendingSwap = {index, code}; capturing = null; captureHelp.hidden = true; swapBox.hidden = false;
      const conflict = result.baseConflict;
      text(swapText, `${keyLabel(conflict.from)} 将用于槽位 ${index + 1}；原${conflict.action === 'attack' ? '挥剑' : '互动'}操作改为 ${keyLabel(conflict.to)}。确认交换？`);
      confirmSwap.focus(); return;
    }
    if (!success(result)) { text(captureHelp, resultText(result)); return; }
    capturing = null; captureHelp.hidden = true; text(panelStatus, `槽位 ${index + 1}：${keyLabel(code)}；数字 ${index + 1} 仍然可用`); updateNow();
  }
  function runAction(name) {
    const result = actions[name]?.();
    text(panelStatus, success(result) ? ({upgradeWeapon: '旅者剑已强化', upgradeSupplies: '补给已升级', buyPotion: '已购买一瓶暖露药剂', save: '旅程已保存'}[name] || '已完成') : saveLabels[result?.status] || resultText(result)); updateNow();
  }
  function showPage(id) {
    currentPanel = id; cancelCapture(); chosen = null; pendingSwap = null; swapBox.hidden = true;
    for (const [key, page] of Object.entries(pages)) { page.hidden = key !== id; tabButtons[key].setAttribute('aria-selected', String(key === id)); tabButtons[key].tabIndex = key === id ? 0 : -1; }
    text(panelTitle, {inventory: '旅程行囊', hotbar: '编排技能栏', settings: '旅程设置'}[id]); text(panelStatus, ''); updateNow();
  }
  function openPanel(id) {
    snapshot = getSnapshot();
    if (!snapshot.playing || snapshot.dead) return;
    if (currentPanel) { showPage(id); tabButtons[id].focus(); return; }
    previousFocus = document.activeElement; acquiredPause = !snapshot.paused;
    if (acquiredPause) { const result = pause('rpg-ui'); if (!success(result)) { acquiredPause = false; announce(resultText(result)); return; } }
    controls.clear(); buttonGate.clear();
    for (const node of document.body.children) {
      if (node === modal || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;
      inertState.set(node, node.inert); node.inert = true;
    }
    modal.hidden = false; showPage(id); closeButton.focus({preventScroll: true});
  }
  function closePanel() {
    if (!currentPanel) return;
    const current = getSnapshot(), shouldResume = acquiredPause && current.mode === 'rpg-ui' && current.playing && !current.dead;
    currentPanel = null; capturing = null; chosen = null; pendingSwap = null; modal.hidden = true;
    for (const [node, inert] of inertState) node.inert = inert; inertState.clear();
    controls.clear(); buttonGate.clear();
    if (shouldResume) resume('rpg-ui'); acquiredPause = false;
    const target = shouldResume ? document.querySelector('#world') : previousFocus?.isConnected ? previousFocus : document.querySelector('#world');
    target?.focus({preventScroll: true}); updateNow();
  }
  panel.addEventListener('keydown', event => {
    if (event.code === 'Tab' && capturing === null) {
      const focusable = Array.from(panel.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter(node => !node.closest('[hidden]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.target.getAttribute?.('role') === 'tab' && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code)) {
      event.preventDefault(); const ids = Object.keys(tabButtons), i = ids.indexOf(currentPanel);
      const next = event.code === 'Home' ? 0 : event.code === 'End' ? ids.length - 1 : (i + (event.code === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
      showPage(ids[next]); tabButtons[ids[next]].focus();
    }
  });
  const controls = createRpgControls({getSnapshot, onSlot: useSlot, onOpenInventory: () => openPanel('inventory'), onClose: closePanel, panelOpen: () => !!currentPanel, captureIndex: () => capturing, onCapture: captureAlias, onCancelCapture: cancelCapture});
  const clearButtons = () => buttonGate.clear(), releaseButtonKey = event => buttonGate.release(event.code);
  window.addEventListener('keyup', releaseButtonKey, true); window.addEventListener('blur', clearButtons); document.addEventListener('visibilitychange', clearButtons);
  disposers.push(() => { window.removeEventListener('keyup', releaseButtonKey, true); window.removeEventListener('blur', clearButtons); document.removeEventListener('visibilitychange', clearButtons); });

  function paintBar() {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const model = slotView(snapshot, i), nodes = barSlots[i];
      text(nodes.key, `${i + 1}${model.alias ? ` · ${keyLabel(model.alias)}` : ''}`);
      text(nodes.icon, model.icon); text(nodes.name, model.empty ? '空' : model.name);
      text(nodes.cooldown, model.locked ? '锁定' : model.remaining > 0 ? model.remaining >= 10 ? Math.ceil(model.remaining) : model.remaining.toFixed(1) : '');
      text(nodes.charges, model.charges === null ? '' : `×${model.charges}`);
      nodes.slot.dataset.skill = model.id || 'empty'; nodes.slot.classList.toggle('is-empty', model.empty); nodes.slot.classList.toggle('is-unavailable', !model.usable && !model.empty); nodes.slot.classList.toggle('is-selected', selectedSlot === i);
      nodes.slot.style.setProperty('--cooldown', model.ratio); nodes.slot.setAttribute('aria-disabled', String(!model.usable));
      const label = `槽位 ${i + 1}${model.alias ? `，快捷键 ${keyLabel(model.alias)}` : ''}：${model.name}${model.charges !== null ? `，剩余 ${model.charges}` : ''}。${model.reason || model.description || '可以使用'}`;
      nodes.slot.setAttribute('aria-label', label); nodes.slot.setAttribute('aria-keyshortcuts', `${i + 1}${model.alias ? ` ${keyLabel(model.alias)}` : ''}`); nodes.slot.title = label;
    }
    text(ward, snapshot.wardRemaining > 0 ? `护盾 ${snapshot.wardRemaining.toFixed(1)} 秒` : '1–9 使用技能');
  }
  function paintEditor() {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const skill = snapshot.skills?.find(item => item.id === snapshot.hotbar?.[i]);
      text(editorSlots[i], `${i + 1} · ${skill?.name || '空槽位'}`); editorSlots[i].classList.toggle('selected', chosen?.source === i); editorSlots[i].setAttribute('aria-pressed', String(chosen?.source === i));
    }
    for (const skill of snapshot.skills || []) {
      if (!catalogButtons.has(skill.id)) {
        const control = button('', '', () => choose({id: skill.id, source: null})); control.draggable = true;
        control.addEventListener('dragstart', event => { event.dataTransfer.setData('application/x-emberwild-skill', skill.id); event.dataTransfer.effectAllowed = 'copy'; });
        catalogButtons.set(skill.id, control); catalog.append(control);
      }
      const control = catalogButtons.get(skill.id), locked = skill.locked || (skill.unlockLevel || 1) > snapshot.level;
      text(control, `${skill.icon || ''} ${skill.name}${locked ? ` · 等级 ${skill.unlockLevel}` : ''}`); control.disabled = !!locked; control.title = skill.description || ''; control.setAttribute('aria-pressed', String(chosen?.source === null && chosen?.id === skill.id));
    }
    for (let i = 0; i < SLOT_COUNT; i++) {
      const model = slotView(snapshot, i); text(aliases[i].name, `${i + 1} · ${model.empty ? '空槽位' : model.name}　${keyLabel(snapshot.aliases?.[i])}`);
      aliases[i].clear.disabled = !snapshot.aliases?.[i]; aliases[i].change.setAttribute('aria-label', `修改槽位 ${i + 1} 的字母快捷键`); aliases[i].clear.setAttribute('aria-label', `移除槽位 ${i + 1} 的字母快捷键`);
    }
  }
  function paintPanel() {
    const equipment = snapshot.equipment || snapshot, camp = snapshot.camp || {nearby: snapshot.atCamp, upgrades: snapshot.upgrades};
    text(inventoryStats, `等级 ${snapshot.level} · ${snapshot.nextLevelXp === 0 ? '本章最高等级' : `经验 ${snapshot.xp} / ${snapshot.nextLevelXp}`} · 星币 ${snapshot.gold}`);
    text(inventoryRows.potions, `${snapshot.inventory?.potions || 0} 瓶 · 每瓶恢复 ${equipment.potionHealing || 0} 生命`);
    text(inventoryRows.scrap, `${snapshot.inventory?.scrap || 0} 份`);
    text(inventoryRows.relics, snapshot.quest?.stage === 2 ? '两枚余烬已交还守灯人' : snapshot.inventory?.relics?.length ? snapshot.inventory.relics.map(labelForRelic).join('、') : '尚未取得');
    text(inventoryRows.weapon, `强化 ${equipment.weaponLevel || 0} · 伤害 ${equipment.damage || 0}`);
    text(inventoryRows.supplies, `等级 ${equipment.supplyLevel || 0} · 药剂恢复 ${equipment.potionHealing || 0}`);
    text(campStatus, camp.nearby ? '营火就在身旁，可以整理装备和补给。' : '回到灯火营地后可强化装备与购买补给。');
    for (const [id, {control, title}] of Object.entries(upgradeButtons)) {
      const upgrade = camp.upgrades?.[id] || snapshot.upgrades?.[id], cost = upgrade?.cost;
      const costText = typeof cost === 'number' ? `${cost} 星币` : cost ? `${cost.gold || 0} 星币${cost.scrap ? ` + ${cost.scrap} 锻片` : ''}` : '等待营地信息';
      text(control, `${title} · ${upgrade?.maxed ? '已满级' : costText}`); control.disabled = !camp.nearby || !upgrade?.available || !!upgrade.maxed;
      control.title = !camp.nearby ? '需要返回营地' : upgrade?.maxed ? '已达到本章上限' : !upgrade?.available ? '材料或星币不足' : title;
    }
    paintEditor();
    for (const [key, control] of Object.entries(settingControls)) control.checked = snapshot.preferences?.[key] !== false;
    if (document.activeElement !== volume) volume.value = String(Math.round((snapshot.preferences?.musicVolume ?? 0.55) * 100));
    text(volumeValue, `${volume.value}%`);
    const attack = keyLabel(snapshot.baseBindings?.attack || 'KeyF'), interact = keyLabel(snapshot.baseBindings?.interact || 'KeyE');
    text(controlsSummary, `WASD 移动 · 拖动镜头 · ${attack} 挥剑 · Shift 闪避 · 空格跳跃 · ${interact} 互动 · 1–9 技能 · Tab 背包 · Esc 暂停 / 关闭菜单`);
    text(saveStatus, snapshot.saveStatus?.message || saveLabels[snapshot.saveStatus] || '旅程、探索和设置保存在当前浏览器中');
  }
  function updateNow() { lastUpdate = -Infinity; update(performance.now()); }
  function update(now = performance.now()) {
    if (now - lastUpdate < 125) return;
    lastUpdate = now; snapshot = getSnapshot();
    root.hidden = !snapshot.playing; toolbar.hidden = !snapshot.playing; pauseSettings.hidden = !(snapshot.paused && snapshot.mode === 'pause');
    if (snapshot.mode === 'context-lost' && currentPanel) {
      closePanel(); const loading = document.querySelector('#loading'); loading?.setAttribute('tabindex', '-1'); loading?.focus({preventScroll: true}); return;
    }
    if (snapshot.dead && currentPanel) closePanel();
    text(levelLabel, `Lv.${snapshot.level || 1}`); text(xpLabel, snapshot.nextLevelXp === 0 ? '本章最高等级' : `${snapshot.xp || 0} / ${snapshot.nextLevelXp || 1} XP`); xp.max = Math.max(1, snapshot.nextLevelXp || 1); xp.value = snapshot.nextLevelXp === 0 ? xp.max : Math.min(xp.max, snapshot.xp || 0);
    paintBar();
    mapBox.hidden = snapshot.preferences?.showMinimap === false;
    minimap.update(snapshot, now);
    const hint = document.querySelector('#hint'), attack = keyLabel(snapshot.baseBindings?.attack || 'KeyF'), interact = keyLabel(snapshot.baseBindings?.interact || 'KeyE');
    if (hint) { hint.hidden = snapshot.preferences?.showHints === false; text(hint, `WASD 移动　${attack} 挥剑　Shift 闪避　空格跳跃　${interact} 互动　Tab 背包　Esc 暂停`); }
    document.querySelector('#attack')?.setAttribute('aria-label', `挥剑（${attack}）`); document.querySelector('#interact')?.setAttribute('aria-label', `互动（${interact}）`);
    document.querySelector('#attack')?.setAttribute('aria-keyshortcuts', attack); document.querySelector('#interact')?.setAttribute('aria-keyshortcuts', interact);
    document.querySelector('#world')?.setAttribute('aria-label', `余烬旷野探索场景：WASD 移动，拖动镜头，${attack} 挥剑，Shift 闪避，空格跳跃，${interact} 互动，1 至 9 技能，Tab 背包，Esc 暂停`);
    if (currentPanel) paintPanel();
    if (now >= noticeUntil) notice.classList.remove('visible');
  }
  updateNow();
  return {
    update, openPanel, closePanel,
    diagnostics: () => ({slots: SLOT_COUNT, keyboard: 'digits 1–9 plus validated letter aliases', panel: currentPanel, minimap: minimap.diagnostics()}),
    dispose() { closePanel(); controls.dispose(); disposers.forEach(dispose => dispose()); if (originalPause) header?.append(originalPause); toolbar.remove(); pauseSettings.remove(); progress.remove(); root.remove(); modal.remove(); },
  };
}
