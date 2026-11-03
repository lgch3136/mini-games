// Read-only HUD wording. Weapon state, switching, reloading, and supply rules
// remain owned by the existing world and input modules.
export function reloadHint(p, weapons, {
  touch = false,
  emergencyReload = false,
  supplyAvailable = false,
} = {}) {
  if (p.reload > 0)
    return touch ? `装填 ${p.reload.toFixed(1)}s` : `装填中 / ${p.reload.toFixed(1)}s`;

  const current = p.weapon;
  const ammo = p.ammo[current];
  const weapon = weapons[current];
  if (p.reserve[current] > 0) {
    // Preserve the existing effective wording, including the emergency mode
    // override, for every state in which the current gun has reserve rounds.
    if (emergencyReload && ammo > 0 && ammo < weapon.mag)
      return `R / 换弹：丢弃余下 ${ammo} 发 · 装填时间75%`;
    const lowAmmo = ammo <= Math.ceil(weapon.mag * 0.25);
    if (touch)
      return lowAmmo ? "弹药不足 · 点换弹" : "点切枪 · 长按开火可拖动瞄准";
    return ammo === 0 ? "弹匣已空 · R 换弹"
      : lowAmmo ? "弹药不足 · R 换弹" : "R 换弹 · Q 切枪";
  }

  if (ammo > 0) return `剩余 ${ammo} 发可用 · 无备用弹`;

  // Both currently owned guns are fixed by the existing game. Do not list
  // hypothetical future weapons, and do not confuse reserve with loaded ammo.
  const other = 1 - current;
  const otherName = weapons[other].name.split(" / ").pop();
  const swap = touch ? `点切枪至${otherName}` : `Q 切至${otherName}`;
  if (p.ammo[other] > 0) return `本枪已空 · ${swap}`;
  if (p.reserve[other] > 0)
    return `本枪已空 · ${swap}后${touch ? "点换弹" : " R 换弹"}`;

  return supplyAvailable
    ? "双枪弹药耗尽 · 返回本区入口白色补给箱"
    : "双枪弹药耗尽";
}
