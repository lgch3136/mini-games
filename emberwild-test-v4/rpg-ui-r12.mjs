import {SLOT_COUNT, createPressGate, createRpgControls, inventoryBinding, keyLabel, slotView, validateAlias} from './rpg-controls-r11.mjs';
import {createMinimap} from './minimap.mjs';
import {createTargetUi, paintPortrait} from './target-ui-r12.mjs';
import {materialInventoryRowsR12, paintMaterialIcon, setMaterialIconQuality} from './loot-icons-r12.mjs';
import {paintSpellIcon, setSpellIconQuality} from './spell-icons-r12.mjs';
import {registerProgressionPanel, PROGRESSION_STYLESHEET} from './progression-ui-r11.mjs';
import {quality} from './quality.mjs';

const text = (node, value) => { const next = String(value ?? ''); if (node.textContent !== next) node.textContent = next; };
const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };
const button = (label, className, action) => { const node = el('button', className, label); node.type = 'button'; if (action) node.addEventListener('click', action); return node; };
const labelForRelic = id => ({tower: '古塔余烬', pool: '月镜余烬'}[id] || '旅途余烬');
const saveLabels = {saved: '旅程已自动保存 · 进度、探索与设置保存在当前浏览器', loaded: '已恢复上次旅程 · 后续进度自动保存', migrated: '已恢复旧版旅程 · 后续进度自动保存', new: '新旅程 · 浏览器存储可用时自动保存', future: '发现较新版本存档，已保护原数据；本次旅程不能保存', unsupported: '存档包含当前版本不支持的数据，已保护原数据；本次旅程不能保存', corrupt: '存档无法读取，已保留原数据；本次旅程不能保存', conflict: '另一个标签页已更新这段旅程；本次会话不再保存，请重新加载以继续最新进度', unavailable: '浏览器存储不可用；本次旅程不能保存', protected: '现有存档已保护；本次旅程不能保存', full: '存档容量已满；最近进度尚未保存'};
const resultText = result => result?.reason || (result?.ok === false ? '暂时无法完成' : '已保存');
const saveStatusText = status => status?.message || saveLabels[typeof status === 'string' ? status : status?.status] || '旅程、探索和设置保存在当前浏览器中';
const success = result => result !== false && result?.ok !== false;
const iconIds = new Set(['potion', 'scrap', 'tower', 'pool', 'weapon', 'supplies', 'emberStrike', 'ward']);
const paintIcon = (node, id) => { const material=paintMaterialIcon(node,id),spell=paintSpellIcon(node,id); if(material||spell)return; node.classList.add('rpg-icon'); node.dataset.icon = iconIds.has(id) ? id : 'empty'; node.setAttribute('aria-hidden', 'true'); };
const makeIcon = id => { const node = el('span', 'rpg-icon'); paintIcon(node, id); return node; };
const costLabel = cost => typeof cost === 'number' ? `${cost} 星币` : cost ? `${cost.gold || 0} 星币${cost.scrap ? ` · ${cost.scrap} 锻片` : ''}` : '等待营地信息';

// A read-only projection: the host remains the only owner of inventory, effects,
// cooldown timers and mutations. Old hosts retain their existing skill data.
export function rpgUiSnapshot(snapshot) {
  const effects = snapshot.progression?.effects;
  if (!effects) return snapshot;
  const actual = (id, fallback) => Number.isFinite(effects[id]) ? effects[id] : fallback;
  const equipment = {...(snapshot.equipment || snapshot)};
  equipment.damage = actual('damage', equipment.damage);
  equipment.potionHealing = actual('potionHealing', equipment.potionHealing);
  const skills = snapshot.skills?.map(skill => {
    if (skill.id === 'potion') return {...skill, cooldown: actual('potionCooldown', skill.cooldown), description: `消耗 1 瓶恢复 ${equipment.potionHealing} 生命；满血不会消耗。`};
    if (skill.id === 'ward') { const duration = actual('wardDuration', skill.duration); return {...skill, cooldown: actual('wardCooldown', skill.cooldown), duration, description: `${duration} 秒内受到的伤害减少 65%。`}; }
    if (skill.id === 'emberStrike' && Number.isFinite(effects.emberStrikeBonus)) return {...skill, description: `下一次挥剑造成 +${effects.emberStrikeBonus} 伤害。重盾仍需绕后或等收招。`};
    return skill;
  });
  return {...snapshot, equipment, skills};
}

// Pure fallback for hosts migrating the old numeric quest snapshot.
export function questView(snapshot) {
  const supplied = snapshot.questDialogue || snapshot.quest?.dialogue;
  const relics = snapshot.quest?.relics || snapshot.inventory?.relics || [];
  const numeric = snapshot.quest?.stage || 0;
  const stage = numeric === 2 ? 'completed' : numeric === 0 ? 'available' : ['tower', 'pool'].every(id => relics.includes(id)) ? 'ready' : 'active';
  const result = supplied || {
    id: 'rekindle', stage, title: '灯火未眠',
    description: stage === 'completed' ? '灯火重燃了。营地永远欢迎你。修整装备，带上补给，再去看看林地深处吧。' : stage === 'ready' ? '你带回了两枚余烬。把它们交给我，让营地的灯再亮起来。' : '古塔与月镜池的灯芯熄灭了。沿金色路标寻回两枚余烬，带回灯火营地。守卫蓄力时先闪避，等它收招再进攻。',
    objectives: ['tower', 'pool'].map(id => ({id, label: labelForRelic(id), current: numeric === 2 || relics.includes(id) ? 1 : 0, target: 1, done: numeric === 2 || relics.includes(id)})),
    rewards: {gold: 100, xp: 70, scrap: 3}, canAccept: stage === 'available', canComplete: stage === 'ready',
  };
  return {...result, npc: {id: 'warden', name: '守灯人', portraitId: 'warden', role: '灯火营地', ...result.npc}, objectives: result.objectives || [], rewards: result.rewards || {}};
}

// These are views of real owned items, not a second inventory or equipment system.
export function inventoryView(snapshot) {
  snapshot = rpgUiSnapshot(snapshot);
  const equipment = snapshot.equipment || snapshot, inventory = snapshot.inventory || {};
  const potionCooldown = snapshot.progression?.effects?.potionCooldown ?? snapshot.skills?.find(skill => skill.id === 'potion')?.cooldown ?? 8;
  const relics = snapshot.quest?.stage === 2 ? [] : inventory.relics || [];
  return [
    {id: 'weapon', name: '旅者剑', type: '主手装备', badge: '已装备', quantity: 1, stat: `伤害 ${equipment.damage || 0} · 强化 ${equipment.weaponLevel || 0}/2`, description: '陪你穿过林地的钢刃。营地强化提高普通挥剑伤害。', offer: 'weapon', action: 'upgradeWeapon'},
    {id: 'supplies', name: '补给包', type: '旅途装备', badge: '已装备', quantity: 1, stat: `等级 ${equipment.supplyLevel || 0}/1 · 药剂恢复 ${equipment.potionHealing || 0}`, description: '随身携带的药剂与绷带。营地升级使每瓶药剂多恢复 15 生命，并获得 2 瓶药剂。', offer: 'supplies', action: 'upgradeSupplies'},
    {id: 'potion', name: '暖露药剂', type: '消耗品', badge: `×${inventory.potions || 0}`, quantity: inventory.potions || 0, stat: `恢复 ${equipment.potionHealing || 0} 生命 · 冷却 ${potionCooldown} 秒`, description: '饮用一瓶恢复生命。生命已满时不会消耗；所有槽位共用数量与冷却。', offer: 'potion', action: 'buyPotion'},
    {id: 'scrap', name: '锻片', type: '强化材料', badge: `×${inventory.scrap || 0}`, quantity: inventory.scrap || 0, stat: '用于营地工坊', description: '从守卫与宝箱中收集的金属残片。与星币一起用于强化旅者剑和升级补给包。'},
    ...['tower', 'pool'].filter(id => relics.includes(id)).map(id => ({id, name: labelForRelic(id), type: '任务物品', badge: '×1', quantity: 1, stat: '交还灯火营地的守灯人', description: id === 'tower' ? '从古塔寻回的温暖余烬。集齐两枚后带回营地，靠近守灯人互动。' : '从月镜池寻回的清冷余烬。集齐两枚后带回营地，靠近守灯人互动。'})),
    ...materialInventoryRowsR12(snapshot).filter(item => Number.isInteger(item.quantity) && item.quantity > 0),
  ];
}

export function createRpgUi({getSnapshot: readSnapshot, actions, pause, resume, clearInput = () => {}, enableProgression = false}) {
  const getSnapshot = () => rpgUiSnapshot(readSnapshot());
  const root = el('div', 'rpg-hud'); root.id = 'rpg-hud';
  setMaterialIconQuality(root, quality);
  setSpellIconQuality(root, quality);
  const live = el('div', 'rpg-sr'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); root.append(live);
  const notice = el('div', 'rpg-notice'); notice.setAttribute('aria-hidden', 'true'); root.append(notice);
  let noticeUntil = 0, lastUpdate = -Infinity, snapshot = getSnapshot(), selectedSlot = -1, selectedItem = 'potion';
  let currentPanel = null, capturing = null, chosen = null, pendingSwap = null, acquiredPause = false, previousFocus = null, modalMode = false;
  const inertState = new Map(), disposers = [], extensionPanels = new Map();
  const announce = message => { text(live, message); text(notice, message); noticeUntil = performance.now() + 3200; notice.classList.add('visible'); };

  const toolbar = el('nav', 'rpg-toolbar'); toolbar.setAttribute('aria-label', '旅程菜单');
  const inventoryButton = button('背包', '', () => currentPanel === 'inventory' ? closePanel() : openPanel('inventory'));
  const settingsButton = button('设置', '', () => openPanel('settings'));
  const header = document.querySelector('header');
  toolbar.append(inventoryButton, settingsButton);
  const originalPause = document.querySelector('#pause'); if (originalPause) toolbar.append(originalPause);
  header?.append(toolbar);
  const pauseSettings = button('旅程设置', 'secondary', () => openPanel('settings')); pauseSettings.hidden = true;
  document.querySelector('#dialog article')?.append(pauseSettings);

  const unitFrames = createTargetUi({mount: root, clearInput, onClearTarget: actions.clearTarget});
  const progress = el('div', 'rpg-progress');
  const levelLabel = el('span', 'rpg-level'); const xpLabel = el('span', 'rpg-xp-label'); const xp = el('progress', 'rpg-xp'); xp.setAttribute('aria-label', '等级经验');
  progress.append(levelLabel, xpLabel, xp); unitFrames.playerFooter.append(progress);

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
  setMaterialIconQuality(modal, quality);
  setSpellIconQuality(modal, quality);
  const panel = el('section', 'rpg-panel'); panel.tabIndex = -1; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'rpg-panel-title');
  panel.addEventListener('pointerdown', event => {
    clearInput();
    if (!event.target?.closest?.('button,input,textarea,select,a[href]')) panel.focus({preventScroll: true});
  });
  // The world stays active. Pointer gestures which start on UI never reach orbit/attack listeners.
  for (const surface of [panel, toolbar, barBox]) for (const name of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'click', 'dblclick', 'wheel', 'contextmenu']) surface.addEventListener(name, event => { event.stopPropagation(); if (name === 'pointerdown') clearInput(); if (name === 'contextmenu') event.preventDefault(); });
  const panelHeader = el('div', 'rpg-panel-header'); const panelTitle = el('h2', '', '旅程行囊'); panelTitle.id = 'rpg-panel-title';
  const closeButton = button('返回 ×', 'rpg-close', closePanel); closeButton.setAttribute('aria-label', '关闭菜单，返回旅程（Esc）');
  panelHeader.append(panelTitle, closeButton);
  const tabs = el('div', 'rpg-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '旅程管理');
  const tabButtons = {}, pages = {};
  for (const [id, label] of [['inventory', '背包'], ['hotbar', '技能栏'], ['settings', '设置']]) {
    const tab = button(label, '', () => showPage(id)); tab.id = `rpg-tab-${id}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `rpg-page-${id}`); tabs.append(tab); tabButtons[id] = tab;
    const page = el('div', 'rpg-page'); page.id = `rpg-page-${id}`; page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', tab.id); pages[id] = page;
  }
  pages.quest = el('div', 'rpg-page rpg-quest-page'); pages.quest.id = 'rpg-page-quest';
  const panelModeNotice = el('p', 'rpg-panel-mode'); panelModeNotice.id = 'rpg-panel-mode'; panel.setAttribute('aria-describedby', panelModeNotice.id);
  const panelStatus = el('p', 'rpg-panel-status'); panelStatus.setAttribute('role', 'status'); panelStatus.setAttribute('aria-live', 'polite');
  const saveStatus = el('p', 'rpg-save-status');
  panel.append(panelHeader, panelModeNotice, tabs, ...Object.values(pages), panelStatus, saveStatus); modal.append(panel); document.body.append(modal);

  const npcHeader = el('div', 'rpg-npc-header'), npcPortrait = el('img', 'rpg-npc-portrait'), npcCopy = el('div'), npcRole = el('span', 'rpg-npc-role'), npcName = el('strong', 'rpg-npc-name');
  npcPortrait.width = 72; npcPortrait.height = 72; npcPortrait.draggable = false; npcCopy.append(npcRole, npcName); npcHeader.append(npcPortrait, npcCopy);
  const questStage = el('span', 'rpg-quest-stage'), questTitle = el('h3', 'rpg-quest-title'), questBody = el('p', 'rpg-quest-body'); questTitle.id = 'rpg-quest-title';
  const objectiveHeading = el('h4', '', '任务目标'), questObjectives = el('ul', 'rpg-quest-objectives');
  const rewardHeading = el('h4', '', '完成奖励'), questRewards = el('div', 'rpg-quest-rewards');
  const questActions = el('div', 'rpg-quest-actions');
  const questAccept = button('接受任务', 'rpg-primary-action', () => runQuestAction('acceptQuest')); questAccept.dataset.action = 'acceptQuest';
  const questComplete = button('完成任务', 'rpg-primary-action', () => runQuestAction('completeQuest')); questComplete.dataset.action = 'completeQuest';
  const questClose = button('暂时离开', 'rpg-quest-close', closePanel);
  questActions.append(questAccept, questComplete, questClose);
  pages.quest.append(npcHeader, questStage, questTitle, questBody, objectiveHeading, questObjectives, rewardHeading, questRewards, questActions);

  const inventoryStats = el('div', 'rpg-inventory-stats');
  const goldLabel = el('span', 'rpg-gold'), healthLabel = el('span', 'rpg-bag-health'); inventoryStats.append(goldLabel, healthLabel);
  const bagHelp = el('p', 'rpg-bag-help', '点选物品查看详情 · 方向键切换');
  const equipmentHeading = el('h3', 'rpg-bag-section-title', '已装备'), equipmentGrid = el('div', 'rpg-equipment-grid'); equipmentGrid.setAttribute('role', 'group'); equipmentGrid.setAttribute('aria-label', '当前装备');
  const inventoryHeading = el('h3', 'rpg-bag-section-title', '随身物品'), inventoryGrid = el('div', 'rpg-inventory-grid'); inventoryGrid.setAttribute('role', 'group'); inventoryGrid.setAttribute('aria-label', '背包物品，方向键切换选择');
  const itemTiles = new Map();
  function ensureItemTile(item) {
    const {id} = item;
    if (itemTiles.has(id)) return itemTiles.get(id);
    const tile = button('', 'rpg-item', () => selectItem(id)); tile.dataset.item = id;
    const icon = makeIcon(id), name = el('span', 'rpg-item-name'), badge = el('span', 'rpg-item-badge'), kind = el('span', 'rpg-item-kind');
    for (const node of [name, badge, kind]) node.setAttribute('aria-hidden', 'true');
    tile.append(icon, name, badge, kind); tile.setAttribute('aria-controls', 'rpg-item-detail');
    tile.addEventListener('focus', () => selectItem(id));
    tile.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.code)) return;
      event.preventDefault(); event.stopPropagation();
      const items = inventoryView(getSnapshot()), current = items.findIndex(item => item.id === id);
      const columns = globalThis.innerWidth <= 380 ? 3 : 4;
      const step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns}[event.code] || 0;
      const next = event.code === 'Home' ? 0 : event.code === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, current + step));
      if (items[next]) { selectItem(items[next].id); ensureItemTile(items[next]).tile.focus({preventScroll: true}); }
    });
    const nodes = {tile, icon, name, badge, kind}; itemTiles.set(id, nodes); (id === 'weapon' || id === 'supplies' ? equipmentGrid : inventoryGrid).append(tile);
    return nodes;
  }
  // Seed hidden known rows, then let every snapshot create any newly owned row.
  for (const item of [...inventoryView({inventory: {relics: ['tower', 'pool']}}), ...materialInventoryRowsR12({})]) ensureItemTile(item);
  const emptySlots = Array.from({length: 12}, () => { const node = el('span', 'rpg-empty-item'); node.setAttribute('aria-hidden', 'true'); inventoryGrid.append(node); return node; });
  const relicStatus = el('p', 'rpg-relic-status');
  const itemDetail = el('section', 'rpg-item-detail'); itemDetail.id = 'rpg-item-detail'; itemDetail.setAttribute('aria-labelledby', 'rpg-item-name');
  const detailHeader = el('div', 'rpg-item-detail-header'), detailIcon = makeIcon('potion'), detailCopy = el('div'), detailKind = el('span', 'rpg-detail-kind'), detailName = el('h3'), detailStat = el('p', 'rpg-detail-stat'); detailName.id = 'rpg-item-name';
  detailCopy.append(detailKind, detailName, detailStat); detailHeader.append(detailIcon, detailCopy);
  const detailDescription = el('p', 'rpg-detail-description');
  const detailActions = el('div', 'rpg-item-actions');
  const usePotion = button('饮用药剂', 'rpg-primary-action', drinkPotion); usePotion.dataset.action = 'drinkPotion';
  const campAction = button('', 'rpg-camp-action', () => { const item = inventoryView(getSnapshot()).find(item => item.id === selectedItem); if (item?.action) runAction(item.action); });
  const assignPotion = button('放入技能栏', 'rpg-small-button', () => { showPage('hotbar'); choose({id: 'potion', source: null}); editorSlots[snapshot.hotbar.findIndex(id => !id) < 0 ? 0 : snapshot.hotbar.findIndex(id => !id)].focus(); });
  detailActions.append(usePotion, campAction, assignPotion);
  const actionReason = el('p', 'rpg-action-reason'); actionReason.id = 'rpg-item-action-reason'; usePotion.setAttribute('aria-describedby', actionReason.id); campAction.setAttribute('aria-describedby', actionReason.id);
  const campStatus = el('p', 'rpg-camp-status');
  itemDetail.append(detailHeader, detailDescription, detailActions, actionReason);
  pages.inventory.append(inventoryStats, equipmentHeading, equipmentGrid, inventoryHeading, inventoryGrid, bagHelp, itemDetail, relicStatus, campStatus);

  const editHelp = el('p', 'rpg-muted', '先选技能，再点目标槽位；先点已装备槽位，再点另一格可交换。也可拖放。数字 1–9 始终对应九个槽位。');
  const choiceLabel = el('p', 'rpg-choice', '选择要分配的技能，或选择要移动的槽位');
  const skillDescription = el('p', 'rpg-skill-description', '选择技能可查看效果；空槽位不会触发任何技能。');
  const catalog = el('div', 'rpg-catalog'); const catalogButtons = new Map();
  const emptyChoice = button('清空槽位', 'rpg-empty-choice', () => choose({id: null, source: null}));
  const cancelChoice = button('取消选择', '', () => choose(null));
  const choiceActions = el('div', 'rpg-choice-actions'); choiceActions.append(emptyChoice, cancelChoice);
  const editor = el('div', 'rpg-bar-editor'); editor.setAttribute('aria-label', '点击分配或交换槽位');
  const editorSlots = [];
  const editorNodes = [];
  for (let index = 0; index < SLOT_COUNT; index++) {
    const control = button('', '', () => assignOrChoose(index)); control.draggable = true;
    const icon = makeIcon(null), name = el('span'), key = el('span', 'rpg-editor-key', `${index + 1}`); control.append(key, icon, name); editorNodes.push({icon, name});
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
    if (typeof actions[name] !== 'function') { text(panelStatus, '当前操作暂不可用'); return; }
    const result = actions[name]();
    text(panelStatus, success(result) ? ({upgradeWeapon: '旅者剑已强化', upgradeSupplies: '补给已升级', buyPotion: '已购买一瓶暖露药剂', save: '旅程已保存'}[name] || '已完成') : saveLabels[result?.status] || resultText(result)); updateNow();
  }
  function selectItem(id) {
    if (!inventoryView(getSnapshot()).some(item => item.id === id)) return;
    selectedItem = id; snapshot = getSnapshot(); paintInventory();
  }
  function potionAvailability(current) {
    // Reuse the authoritative hotbar presentation rules without assigning or moving a slot.
    return slotView({...current, hotbar: ['potion']}, 0);
  }
  function drinkPotion() {
    snapshot = getSnapshot(); const view = potionAvailability(snapshot);
    if (!view.usable) { text(panelStatus, view.reason); paintInventory(); return; }
    if (typeof actions.drinkPotion !== 'function') { text(panelStatus, '当前药剂操作暂不可用'); return; }
    const result = actions.drinkPotion();
    text(panelStatus, success(result) ? '已饮用暖露药剂，生命已恢复' : resultText(result)); updateNow();
  }
  function runQuestAction(name) {
    if (currentPanel !== 'quest') return;
    snapshot = getSnapshot(); const quest = questView(snapshot), nearby = snapshot.npcNearby ?? snapshot.camp?.nearby ?? snapshot.atCamp;
    const allowed = name === 'acceptQuest' ? quest.canAccept : quest.canComplete;
    if (!allowed || nearby === false || snapshot.dead || !snapshot.playing || snapshot.paused || typeof actions[name] !== 'function') { paintQuest(); return; }
    const result = actions[name]();
    if (!success(result)) { text(panelStatus, resultText(result)); updateNow(); return; }
    closePanel(); announce(name === 'acceptQuest' ? '已接受：灯火未眠' : '任务完成 · 奖励已领取');
  }
  function paintQuest() {
    const quest = questView(snapshot), nearby = snapshot.npcNearby ?? snapshot.camp?.nearby ?? snapshot.atCamp;
    paintPortrait(npcPortrait, quest.npc.portraitId, quest.npc.name); text(npcRole, quest.npc.role); text(npcName, quest.npc.name);
    text(questStage, {available: '可接任务', active: '任务进行中', ready: '可以交付', completed: '任务已完成'}[quest.stage] || '营地交谈');
    questStage.dataset.stage = quest.stage; text(questTitle, quest.title); text(questBody, quest.description || quest.body);
    questObjectives.textContent = '';
    for (const objective of quest.objectives) {
      const row = el('li', objective.done ? 'is-complete' : '');
      row.append(el('span', 'rpg-objective-mark', objective.done ? '✓' : '◇'), el('span', '', objective.label), el('strong', '', `${objective.current ?? 0} / ${objective.target ?? 1}`)); questObjectives.append(row);
    }
    questRewards.textContent = '';
    for (const [key, label] of [['xp', '经验'], ['gold', '星币'], ['scrap', '锻片']]) {
      if (!quest.rewards[key]) continue;
      const reward = el('div', 'rpg-quest-reward'); reward.dataset.reward = key;
      if (key === 'scrap') reward.append(makeIcon('scrap'));
      reward.append(el('strong', '', quest.rewards[key]), el('span', '', label)); questRewards.append(reward);
    }
    text(rewardHeading, quest.stage === 'completed' ? '已领取奖励' : '完成奖励');
    questAccept.hidden = quest.stage !== 'available'; questComplete.hidden = !['active', 'ready'].includes(quest.stage);
    const unavailable = nearby === false || snapshot.dead || !snapshot.playing || snapshot.paused;
    questAccept.disabled = unavailable || !quest.canAccept || typeof actions.acceptQuest !== 'function';
    questComplete.disabled = unavailable || !quest.canComplete || typeof actions.completeQuest !== 'function';
    text(questComplete, quest.canComplete ? '完成任务' : '目标尚未完成');
    text(questClose, quest.stage === 'available' ? '暂不接受' : '告别');
  }
  function paintInventory() {
    const items = inventoryView(snapshot), camp = snapshot.camp || {nearby: snapshot.atCamp, upgrades: snapshot.upgrades};
    const removedFocusedItem = !items.some(item => item.id === selectedItem) && document.activeElement === itemTiles.get(selectedItem)?.tile;
    if (!items.some(item => item.id === selectedItem)) selectedItem = 'potion';
    text(goldLabel, `星币 ${snapshot.gold || 0}`); text(healthLabel, `生命 ${Math.ceil(snapshot.hp || 0)} / ${snapshot.maxHp || 100}`);
    const tileCountBefore = itemTiles.size;
    for (const item of items) ensureItemTile(item);
    for (const [id, nodes] of itemTiles) {
      const item = items.find(item => item.id === id); nodes.tile.hidden = !item;
      if (!item) { nodes.tile.tabIndex = -1; nodes.tile.setAttribute('aria-pressed', 'false'); continue; }
      paintIcon(nodes.icon, item.iconId || item.id);
      text(nodes.name, item.name); text(nodes.badge, item.badge); text(nodes.kind, item.type);
      nodes.tile.classList.toggle('is-equipped', item.badge === '已装备'); nodes.tile.classList.toggle('is-depleted', item.quantity === 0);
      nodes.tile.setAttribute('aria-pressed', String(id === selectedItem)); nodes.tile.tabIndex = id === selectedItem ? 0 : -1;
      const label = `${item.name}，${item.type}，${item.badge === '已装备' ? '已装备' : `数量 ${item.quantity}`}。${item.stat}`;
      nodes.tile.setAttribute('aria-label', label); nodes.tile.title = `${label}。${item.description}`;
    }
    // Keep empty cells after dynamically appended stacks, including late loot.
    if (itemTiles.size !== tileCountBefore) inventoryGrid.append(...emptySlots);
    const carriedCount = items.filter(item => !['weapon', 'supplies'].includes(item.id)).length;
    emptySlots.forEach((node, index) => { node.hidden = index >= Math.max(0, 12 - carriedCount); });
    text(inventoryHeading, `随身物品 · ${carriedCount} 种`);
    const item = items.find(item => item.id === selectedItem);
    paintIcon(detailIcon, item.iconId || item.id); text(detailKind, `${item.type}${item.badge === '已装备' ? ' · 已装备' : ` · 持有 ${item.quantity}`}`);
    text(detailName, item.name); text(detailStat, item.stat); text(detailDescription, item.description);
    const isPotion = item.id === 'potion', offer = camp.upgrades?.[item.offer] || snapshot.upgrades?.[item.offer];
    usePotion.hidden = !isPotion; assignPotion.hidden = !isPotion; campAction.hidden = !item.action;
    let reason = '';
    if (isPotion) {
      const availability = potionAvailability(snapshot); usePotion.disabled = !availability.usable || typeof actions.drinkPotion !== 'function';
      text(usePotion, availability.remaining > 0 ? `冷却 ${availability.remaining.toFixed(1)} 秒` : '饮用药剂');
      const assigned = snapshot.hotbar?.map((id, index) => id === 'potion' ? index + 1 : null).filter(Boolean) || [];
      text(assignPotion, assigned.length ? `技能栏 ${assigned.join(' / ')} · 调整` : '放入技能栏');
      reason = availability.reason || `饮用后恢复至 ${Math.min(snapshot.maxHp, snapshot.hp + (snapshot.equipment?.potionHealing || snapshot.potionHealing || 0))} 生命`;
    }
    if (item.action) {
      const title = {weapon: '强化旅者剑', supplies: '升级补给包', potion: '购买一瓶'}[item.offer];
      campAction.dataset.action = item.action;
      text(campAction, offer?.maxed ? item.id === 'potion' ? '药剂数量已满' : '强化已满级' : `${title} · ${costLabel(offer?.cost)}`);
      campAction.disabled = !camp.nearby || !offer?.available || !!offer.maxed || snapshot.dead || typeof actions[item.action] !== 'function';
      const campReason = !camp.nearby ? '需要回到灯火营地' : offer?.maxed ? '已达到本章上限' : !offer?.available ? '星币或锻片不足' : '营地工坊可用';
      campAction.title = campReason;
      if (!isPotion) reason = campReason;
    }
    text(actionReason, reason); actionReason.hidden = !reason;
    text(relicStatus, snapshot.quest?.stage === 2 ? '两枚余烬已交还守灯人' : `已寻回余烬 ${items.filter(item => item.type === '任务物品').length} / 2`);
    text(campStatus, camp.nearby ? '营火就在身旁 · 可强化装备和购买补给' : '营地工坊 · 回到灯火营地后可强化与补给');
    campStatus.classList.toggle('is-nearby', !!camp.nearby);
    if (removedFocusedItem) itemTiles.get(selectedItem).tile.focus({preventScroll: true});
  }
  function restoreBackground() {
    for (const [node, inert] of inertState) node.inert = inert; inertState.clear();
  }
  function setPanelMode(id) {
    let current = getSnapshot();
    if (id === 'settings' && !current.paused) {
      const result = pause('rpg-ui');
      if (!success(result)) { announce(resultText(result)); return false; }
      acquiredPause = true;
    } else if (id !== 'settings' && acquiredPause) {
      // Only release the pause this panel actually acquired. An Esc/dialog pause survives.
      if (current.mode === 'rpg-ui' && !current.dead) resume('rpg-ui');
      acquiredPause = false;
    }
    current = getSnapshot(); modalMode = id === 'settings' || current.paused;
    restoreBackground();
    if (modalMode) for (const node of document.body.children) {
      if (node === modal || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;
      inertState.set(node, node.inert); node.inert = true;
    }
    modal.classList.toggle('is-live-panel', !modalMode);
    panel.setAttribute('aria-modal', String(modalMode));
    text(panelModeNotice, modalMode ? '旅程已暂停 · 关闭后返回原来的状态' : '世界继续运行 · 点击场景操作 · Esc 关闭');
    panelModeNotice.title = modalMode ? '关闭设置只恢复本菜单发起的暂停' : '敌人和冷却不会暂停。点击场景继续操作；Esc 先关闭行囊，再按一次暂停。';
    clearInput(); return true;
  }
  function showPage(id) {
    if (!pages[id] || !setPanelMode(id)) return false;
    currentPanel = id; cancelCapture(); chosen = null; pendingSwap = null; swapBox.hidden = true;
    for (const [key, page] of Object.entries(pages)) { page.hidden = key !== id; if (tabButtons[key]) { tabButtons[key].setAttribute('aria-selected', String(key === id)); tabButtons[key].tabIndex = key === id ? 0 : -1; } }
    tabs.hidden = id === 'quest'; saveStatus.hidden = id === 'quest'; panel.dataset.panel = id;
    document.body.classList.add('rpg-panel-open');
    text(panelTitle, {inventory: '旅程行囊', hotbar: '编排技能栏', settings: '旅程设置', quest: '守灯人的委托'}[id] || extensionPanels.get(id)?.title || id); text(panelStatus, ''); updateNow(); return true;
  }
  function openPanel(id) {
    snapshot = getSnapshot();
    if (!snapshot.playing || snapshot.dead || !pages[id]) return false;
    if (id === 'quest' && ((snapshot.npcNearby ?? snapshot.camp?.nearby ?? snapshot.atCamp) === false || snapshot.paused)) return false;
    if (currentPanel) { if (!showPage(id)) return false; (id === 'quest' ? !questAccept.hidden && !questAccept.disabled ? questAccept : !questComplete.hidden && !questComplete.disabled ? questComplete : questClose : tabButtons[id]).focus(); return true; }
    previousFocus = document.activeElement; acquiredPause = false;
    controls.clear(); buttonGate.clear();
    modal.hidden = false; if (!showPage(id)) { modal.hidden = true; return false; }
    (id === 'quest' ? !questAccept.hidden && !questAccept.disabled ? questAccept : !questComplete.hidden && !questComplete.disabled ? questComplete : questClose : closeButton).focus({preventScroll: true}); return true;
  }
  function closePanel({restoreFocus = true} = {}) {
    if (!currentPanel) return;
    const current = getSnapshot(), shouldResume = acquiredPause && current.mode === 'rpg-ui' && current.playing && !current.dead;
    currentPanel = null; capturing = null; chosen = null; pendingSwap = null; modal.hidden = true;
    document.body.classList.remove('rpg-panel-open');
    restoreBackground(); controls.clear(); buttonGate.clear(); clearInput();
    if (shouldResume) resume('rpg-ui'); acquiredPause = false; modalMode = false;
    const after = getSnapshot();
    if (restoreFocus) {
      const target = after.dead || after.paused && after.mode !== 'rpg-ui' ? document.querySelector('#closeDialog') : after.playing && !after.paused ? document.querySelector('#world') : previousFocus?.isConnected ? previousFocus : document.querySelector('#world');
      target?.focus({preventScroll: true});
    }
    updateNow();
  }
  panel.addEventListener('keydown', event => {
    if (modalMode && event.code === 'Tab' && capturing === null) {
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
      paintIcon(nodes.icon, model.id); text(nodes.name, model.empty ? '空' : model.name);
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
      paintIcon(editorNodes[i].icon, skill?.id); text(editorNodes[i].name, skill?.name || '空槽位'); editorSlots[i].setAttribute('aria-label', `槽位 ${i + 1}：${skill?.name || '空槽位'}`); editorSlots[i].classList.toggle('selected', chosen?.source === i); editorSlots[i].setAttribute('aria-pressed', String(chosen?.source === i));
    }
    for (const skill of snapshot.skills || []) {
      if (!catalogButtons.has(skill.id)) {
        const control = button('', '', () => choose({id: skill.id, source: null})); control.draggable = true;
        const icon = makeIcon(skill.id), name = el('span', 'rpg-catalog-name'), meta = el('small', 'rpg-catalog-meta'); control.append(icon, name, meta);
        control.addEventListener('dragstart', event => { event.dataTransfer.setData('application/x-emberwild-skill', skill.id); event.dataTransfer.effectAllowed = 'copy'; });
        catalogButtons.set(skill.id, control); catalog.append(control);
      }
      const control = catalogButtons.get(skill.id), locked = skill.locked || (skill.unlockLevel || 1) > snapshot.level;
      text(control.querySelector('.rpg-catalog-name'), skill.name); text(control.querySelector('.rpg-catalog-meta'), locked ? `等级 ${skill.unlockLevel} 解锁` : `${skill.cooldown} 秒冷却`); control.disabled = !!locked; control.title = skill.description || ''; control.setAttribute('aria-label', `${skill.name}，${locked ? `等级 ${skill.unlockLevel} 解锁` : `冷却 ${skill.cooldown} 秒`}。${skill.description || ''}`); control.setAttribute('aria-pressed', String(chosen?.source === null && chosen?.id === skill.id));
    }
    for (let i = 0; i < SLOT_COUNT; i++) {
      const model = slotView(snapshot, i); text(aliases[i].name, `${i + 1} · ${model.empty ? '空槽位' : model.name}　${keyLabel(snapshot.aliases?.[i])}`);
      aliases[i].clear.disabled = !snapshot.aliases?.[i]; aliases[i].change.setAttribute('aria-label', `修改槽位 ${i + 1} 的字母快捷键`); aliases[i].clear.setAttribute('aria-label', `移除槽位 ${i + 1} 的字母快捷键`);
    }
  }
  function paintPanel() {
    paintInventory();
    paintEditor();
    for (const [key, control] of Object.entries(settingControls)) control.checked = snapshot.preferences?.[key] !== false;
    if (document.activeElement !== volume) volume.value = String(Math.round((snapshot.preferences?.musicVolume ?? 0.55) * 100));
    text(volumeValue, `${volume.value}%`);
    const attack = keyLabel(snapshot.baseBindings?.attack || 'KeyF'), interact = keyLabel(snapshot.baseBindings?.interact || 'KeyE');
    text(controlsSummary, `WASD 镜头方向移动 · 右键 + A/D 侧移 · 左拖独立观察 · 右拖转向 · 双键前进 · 滚轮缩放 · ${attack} 挥剑 · Shift 闪避 · 空格跳跃 · ${interact} 互动 · 1–9 技能 · ${keyLabel(snapshot.inventoryCode ?? inventoryBinding(snapshot))} 背包（不暂停） · Tab 选择目标· Esc 先关背包，再暂停。左拖松开后保持正在行走的方向；停止移动后，再按 WASD 使用新镜头方向。右键可立即对齐`);
    text(saveStatus, saveStatusText(snapshot.saveStatus));
    if (currentPanel === 'quest') paintQuest();
    extensionPanels.get(currentPanel)?.update?.(snapshot);
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
    if (currentPanel === 'quest' && ((snapshot.npcNearby ?? snapshot.camp?.nearby ?? snapshot.atCamp) === false || snapshot.paused)) { closePanel(); announce('交谈已结束'); }
    const inventoryCode = snapshot.inventoryCode ?? inventoryBinding(snapshot), inventoryKey = inventoryCode ? keyLabel(inventoryCode) : '菜单';
    inventoryButton.title = `背包与营地 · ${inventoryKey}`; if (inventoryCode) inventoryButton.setAttribute('aria-keyshortcuts', inventoryKey); else inventoryButton.removeAttribute('aria-keyshortcuts');
    text(inventoryButton, `背包${inventoryCode ? ` · ${inventoryKey}` : ''}`);
    unitFrames.update({playing: snapshot.playing, player: {...snapshot.player, name: snapshot.player?.name || '旅者', portraitId: snapshot.player?.portraitId || 'hero', level: snapshot.player?.level ?? snapshot.level, hp: snapshot.player?.hp ?? snapshot.hp, maxHp: snapshot.player?.maxHp ?? snapshot.maxHp, dead: snapshot.dead}, target: snapshot.target || null});
    text(levelLabel, `✦ ${snapshot.gold || 0}`); text(xpLabel, snapshot.nextLevelXp === 0 ? '本章最高等级' : `${snapshot.xp || 0} / ${snapshot.nextLevelXp || 1} XP`); xp.max = Math.max(1, snapshot.nextLevelXp || 1); xp.value = snapshot.nextLevelXp === 0 ? xp.max : Math.min(xp.max, snapshot.xp || 0); xp.setAttribute('aria-label', `等级 ${snapshot.level || 1}，${xpLabel.textContent}`);
    paintBar();
    mapBox.hidden = snapshot.preferences?.showMinimap === false;
    minimap.update(snapshot, now);
    const hint = document.querySelector('#hint'), attack = keyLabel(snapshot.baseBindings?.attack || 'KeyF'), interact = keyLabel(snapshot.baseBindings?.interact || 'KeyE');
    if (hint) { hint.hidden = snapshot.preferences?.showHints === false; text(hint, `WASD 移动　左拖观察 / 右拖转向　双键前进 / 滚轮缩放　${attack} 挥剑　Shift 闪避　空格跳跃　${interact} 互动　${keyLabel(snapshot.inventoryCode ?? inventoryBinding(snapshot))} 背包（不暂停） · Tab 选择目标　Esc 关闭 / 暂停`); }
    document.querySelector('#attack')?.setAttribute('aria-label', `挥剑（${attack}）`); document.querySelector('#interact')?.setAttribute('aria-label', `互动（${interact}）`);
    document.querySelector('#attack')?.setAttribute('aria-keyshortcuts', attack); document.querySelector('#interact')?.setAttribute('aria-keyshortcuts', interact);
    document.querySelector('#world')?.setAttribute('aria-label', `余烬旷野探索场景：WASD 按镜头方向移动，按住右键时 A D 侧移，左键拖动独立观察，右键拖动转向，双键前进，滚轮缩放，${attack} 挥剑，Shift 闪避，空格跳跃，${interact} 互动，1 至 9 技能，${keyLabel(snapshot.inventoryCode ?? inventoryBinding(snapshot))} 背包不暂停，Tab 选择目标，Esc 先关闭背包，再按暂停`);
    if (currentPanel) paintPanel();
    if (now >= noticeUntil) notice.classList.remove('visible');
  }
  updateNow();
  const ui = {
    update, openPanel, closePanel,
    openNpcDialog: () => openPanel('quest'), closeNpcDialog: () => { if (currentPanel === 'quest') closePanel(); },
    registerPanel(id, extension) {
      if (!/^[a-z][a-z0-9-]*$/.test(id) || pages[id]) throw new Error('Panel ID must be new and stable');
      const page = el('div', 'rpg-page'); page.id = `rpg-page-${id}`; page.hidden = true; page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', `rpg-tab-${id}`);
      const tab = button(extension.label || id, '', () => showPage(id)); tab.id = `rpg-tab-${id}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', page.id); tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1;
      tabs.append(tab); panel.append(page, panelStatus, saveStatus); pages[id] = page; tabButtons[id] = tab; extensionPanels.set(id, extension);
      extension.render?.({page, actions, getSnapshot, announce}); return page;
    },
    diagnostics: () => ({slots: SLOT_COUNT, keyboard: 'digits 1–9 plus validated letter aliases; B inventory; Tab target', panel: currentPanel, npcDialog: currentPanel === 'quest', modal: modalMode, units: unitFrames.diagnostics(), minimap: minimap.diagnostics()}),
    dispose() { closePanel(); controls.dispose(); disposers.forEach(dispose => dispose()); unitFrames.dispose(); if (originalPause) header?.append(originalPause); toolbar.remove(); pauseSettings.remove(); progress.remove(); root.remove(); modal.remove(); },
  };
  if (enableProgression) {
    const stylesheet = el('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = PROGRESSION_STYLESHEET;
    (document.head || document.body).append(stylesheet); disposers.push(() => stylesheet.remove());
    const progression = registerProgressionPanel(ui);
    for (const row of materialInventoryRowsR12(getSnapshot())) {
      const card = progression.page.querySelector(`[data-material="${row.id}"]`);
      const icon = card?.querySelector('.rpg-icon'); if (icon) paintIcon(icon, row.id);
    }
    // In the short touch rail the bag tabs are intentionally hidden. A real
    // toolbar entry keeps this opt-in page reachable without opening settings.
    const growthButton = button('研习', '', () => currentPanel === 'progression' ? closePanel() : openPanel('progression'));
    growthButton.setAttribute('aria-label', '天赋、营地配方与附近战利品'); growthButton.dataset.action = 'openProgression';
    toolbar.append(growthButton);
  }
  return ui;
}
