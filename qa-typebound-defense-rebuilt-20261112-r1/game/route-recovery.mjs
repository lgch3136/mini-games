// Read-only preview of the existing Journey.enter() recovery rule. It never
// enters a route, changes HP, draws random values, or reads persisted data.
export function routeRecovery(journey, route) {
  if (journey?.mode !== 'journey' || journey.phase !== 'map' ||
      !Number.isInteger(journey.depth) || journey.depth < 0 ||
      typeof route?.elite !== 'boolean') return null;
  if (route.elite) return { amount: 0, eligible: false, text: '本路无入场回复' };
  if (journey.depth === 0) return { amount: 0, eligible: false, text: '首页面无入场回复' };
  const { hp, maxHp } = journey;
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || hp < 0 ||
      maxHp <= 0 || hp > maxHp) return null;
  const amount = Math.min(maxHp, hp + 8) - hp;
  if (amount === 0) return { amount, eligible: true, text: '生命已满 · 无需回复' };
  const shown = Number(amount.toFixed(2));
  const approx = Math.abs(shown - amount) > 1e-9 ? '约 ' : '';
  return { amount, eligible: true, text: `入场回复 ${approx}${shown} 生命` };
}

// Old checkpoint routes may carry the old static "回复 8" description. Derive
// standard-route copy from live HP instead, without modifying route objects.
export function routeDescription(journey, route) {
  const recovery = routeRecovery(journey, route);
  if (!recovery?.eligible) return route?.desc || '';
  return route.kind === 'boss'
    ? `${route.desc} · ${recovery.text}`
    : `${recovery.text} · 标准敌人`;
}
