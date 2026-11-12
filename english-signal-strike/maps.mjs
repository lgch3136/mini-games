// Authored layouts share the relay/checkpoint contract, not the same cover map.
export const MAPS = [
  {
    id: "harbor",
    name: "岸港接入",
    en: "HARBOR",
    brief: "均衡街区 · 低墙掩护，沿中路推进。",
    wall: 0xced4cd,
    floor: 0xd3d7d5,
    fog: 0x9dafb6,
    accent: 0x74d9d5,
    zones: ["岸港接入", "冷却中庭", "零界核心"],
  },
  {
    id: "foundry",
    name: "赤铜铸造厂",
    en: "FOUNDRY",
    brief: "侧翼双廊 · 中央炉体挡住直线火力，从两侧包抄。",
    wall: 0xafa099,
    floor: 0x807c80,
    fog: 0x827c89,
    accent: 0xffb775,
    zones: ["卸料月台", "双廊炉心", "铸造控制室"],
  },
  {
    id: "canal",
    name: "潮汐泵站",
    en: "TIDAL STATION",
    brief: "长距交火 · 输水主管分隔战线，穿过横向缺口换侧。",
    wall: 0xafcac7,
    floor: 0xa3b9c3,
    fog: 0xa0c4d0,
    accent: 0x69e5d2,
    zones: ["海堤入口", "交错泵房", "潮汐调度台"],
  },
  {
    id: "hangar",
    name: "星图机库",
    en: "STAR HANGAR",
    brief: "近距穿插 · 货架形成折线，突进穿越火力空隙。",
    wall: 0xa5afc9,
    floor: 0x787e98,
    fog: 0x838dac,
    accent: 0xbca9ff,
    zones: ["维修泊位", "星图阵列", "发射控制塔"],
  },
];

export function mapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}
// [x, local z, half width, half depth, height, material]
export function coverPlan(id, zone) {
  const mirror = zone % 2 ? -1 : 1;
  const plans = {
    foundry: [
      [0, -19, 4.4, 5.2, 5.4, "building"],
      [-9, -12, 2, 1.4, 1.4, "cover"],
      [9, -27, 2, 2, 2.5, "crate"],
      [-9, -35, 2.2, 1.3, 1.6, "cover"],
      [3, -36, 2, 1.4, 1.1, "cover"],
    ],
    canal: [
      [0, -18, 2, 5, 2.4, "conduit"],
      [0, -35, 2, 5, 2.4, "conduit"],
      [-9, -11, 2.3, 1.2, 1.2, "cover"],
      [9, -25, 2.2, 1.4, 1.2, "cover"],
      [-9, -34, 2, 1.3, 1.2, "cover"],
    ],
    hangar: [
      [-6, -13, 5.2, 1.5, 3.6, "crate"],
      [6, -24, 5.2, 1.5, 3.6, "crate"],
      [-6, -35, 5.2, 1.5, 3.6, "crate"],
      [12, -37, 1.3, 2.3, 2, "cover"],
      [0, -7, 1.4, 1.4, 1.1, "cover"],
    ],
  };
  return (plans[id] || []).map(([x, z, hx, hz, h, kind]) => [
    x * mirror,
    z,
    hx,
    hz,
    h,
    kind,
  ]);
}
export function enemyPlan(id, zone) {
  const plans = {
    harbor: [
      [-5, -24, "spider"],
      [6, -13, "drone"],
      [-9, -34, "sentry"],
      [9, -37, "spider"],
      [0, -43, "drone"],
    ],
    foundry: [
      [-9, -23, "spider"],
      [9, -16, "drone"],
      [-12, -39, "sentry"],
      [10, -38, "spider"],
      [0, -32, "drone"],
      [0, -43, "sentry"],
    ],
    canal: [
      [-11, -23, "sentry"],
      [10, -12, "drone"],
      [10, -39, "sentry"],
      [-6, -28, "spider"],
      [-11, -43, "drone"],
      [7, -33, "spider"],
    ],
    hangar: [
      [7, -15, "spider"],
      [-7, -24, "spider"],
      [9, -33, "drone"],
      [-11, -42, "sentry"],
      [2, -38, "spider"],
      [0, -19, "drone"],
    ],
  };
  const mirror = id !== "harbor" && zone % 2 ? -1 : 1;
  const spots = (plans[id] || plans.harbor).map(([x, z, kind]) => [
    x * mirror,
    z - zone * 52,
    kind,
  ]);
  if (zone === 2)
    spots.push([id === "harbor" ? 0 : 5, -zone * 52 - 43, "boss"]);
  return spots;
}
